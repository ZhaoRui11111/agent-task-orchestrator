# ExecPlan：采用受管任务产物策略与默认普通推送

本计划只改变本仓库的 maintainer Git-flow 治理和现有 Node/SQLite feasibility 产物路由，不改变产品 Task 状态机、运行时持久化或任何外部项目。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-29 10:05:00+08:00",
    "updated_at": "2026-08-29 10:47:00+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "User request in primary thread 01a04379-fcbc-76a1-bee3-d31d3d8cadda to implement the recommended sequence",
        "at": "2026-08-29 10:05:00+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "User request authorizing the recommended commit, FF-only integration, and ordinary push sequence",
        "at": "2026-08-29 10:05:00+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Adopt one repository-owned .task-artifacts disposable-root policy for future coordinator tasks; route the existing Node package and Windows SQLite feasibility generations through that root with fail-closed Windows path handling; grant maintainers standing authorization to invoke the coordinator's ordinary non-force push immediately after exact-head gates and FF-only local integration; prove the governance, artifact, and path-security behavior; then create one terminal task commit, record exact-head gates, integrate FF-only, and push origin/master.",
    "non_goals": [
      "Do not change the product Domain Core, add an application service, persistence repository, dispatcher, adapter, scheduler, MCP component, product CLI, or orchestration runtime.",
      "Do not modify D:\\quant or copy its Python, pytest, campaign, private-skill, repository-domain, or exact gate conventions.",
      "Do not register node_modules, .pnpm-store, dist, runtime data, personal data, or any root other than .task-artifacts as coordinator-prunable material.",
      "Do not make coordinator cleanup automatic, run cleanup, force-remove a worktree or branch, or broaden prune authority beyond the manifest-frozen exact root.",
      "Do not grant standing authority for force push, pull requests, releases, deployment, secrets, arbitrary network access, destructive repository cleanup, or external repositories.",
      "Do not rewrite completed EP-00B evidence that truthfully records its historical .ep00b-tmp path."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "docs/reference/local-agent-git-flow.md remains the sole normative repository workflow owner, while .codex/harness-git-flow.json is the exact machine-readable disposable-root manifest consumed by the installed coordinator; no repository script becomes a second coordinator-state writer.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md; harness-git-flow FLOW-SCHEMA.md"
      },
      {
        "id": "C2",
        "statement": "The manifest is schema version 1 and contains exactly one disposable root, .task-artifacts; a task freezes the committed manifest blob and root identity only when start occurs after that policy is present on its base.",
        "source": "harness-git-flow FLOW-SCHEMA.md and current user-approved recommendation"
      },
      {
        "id": "C3",
        "statement": "Artifact pruning is a distinct explicit coordinator transition after the task result commit and before passed gates/ready; it accepts no caller path, deletes only the frozen exact root, publishes a head/blob/root-absence receipt, and fails closed on tracked overlap, unsafe inventory, reparse, identity drift, or ambiguous state.",
        "source": "harness-git-flow SKILL.md and FLOW-SCHEMA.md"
      },
      {
        "id": "C4",
        "statement": "Existing Node package-smoke and SQLite feasibility generations use one implementation owner for the repository artifact root, creator-owned unique child generations, no-follow/reparse checks, and ownership-safe child cleanup; no runtime database or user data is placed there.",
        "source": "scripts/repo-utils.mjs; docs/reference/toolchain-contract.md; docs/security/threat-model.md"
      },
      {
        "id": "C5",
        "statement": "The standing push grant is narrow: after current required gates bind the exact task head, ready succeeds, FF-only local integration succeeds, and authorization has not been revoked or narrowed by a newer user instruction, the maintainer agent invokes the coordinator's ordinary non-force push to configured origin/master without another prompt; push failure remains merged_local with reservation and is retried or reported, never reset or force-pushed.",
        "source": "Current user request; AGENTS.md authority order; docs/reference/local-agent-git-flow.md partial-success semantics"
      },
      {
        "id": "C6",
        "statement": "Standing push does not imply PR, merge outside local FF integration, release, deployment, cleanup, secret access, arbitrary network access, or another repository mutation; an explicit current user instruction can revoke or narrow the grant.",
        "source": "AGENTS.md authorization boundaries and current user-approved recommendation"
      },
      {
        "id": "C7",
        "statement": "The current task began before the manifest was committed and therefore has artifact_policy=null; no retrospective policy is fabricated. A separate fresh task after integration must provide the real manifest-backed lifecycle proof.",
        "source": "Coordinator v2 start semantics and task adopt-artifact-policy start receipt"
      },
      {
        "id": "C8",
        "statement": "All development occurs only in coordinator-owned task/adopt-artifact-policy at D:\\agent-task-orchestrator\\.worktrees\\adopt-artifact-policy; coordinator mutations use fresh trace and single-use CAS, reserve precedes final review, receipts bind the exact task head, integration is FF-only, and push is ordinary non-force.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md; current coordinator start receipt"
      },
      {
        "id": "C9",
        "statement": "The change starts from pushed EP-01A commit 71dc606d5e4c40de4f669d0732da653d81bc8f92 but is governance-only and does not become a product-roadmap predecessor; a future EP-01B must still record EP-01A as its strict product predecessor and separately assess this base delta.",
        "source": "docs/plans/README.md; current roadmap chain and coordinator evidence"
      },
      {
        "id": "C10",
        "statement": "Fresh independent A0 is required before activation, fresh independent A1 is required for the stable diff, and every confirmed in-scope HIGH or MEDIUM repair requires fresh independent A2; implementer self-review cannot substitute.",
        "source": "docs/plans/README.md; harness-exec-plan audit contracts"
      },
      {
        "id": "C11",
        "statement": "The artifact-policy and coordinator-state boundary is treated as Tier 2 persistence: reader/writer closure, Git-blob identity, pre-mutation validation, topology isolation, CAS, atomic receipt publication, interruption recovery, and ambiguous-state refusal must remain explicit and tested at the applicable seam.",
        "source": "harness-exec-plan PERSISTENCE-AUDIT.md; harness-git-flow FLOW-SCHEMA.md"
      }
    ],
    "authorization": {
      "allowed": [
        "Read and edit only declared task-owned paths inside the canonical task worktree.",
        "Run local targeted and full offline validation without secrets or external-project mutation.",
        "Use an independent read-only reviewer for A0, A1, and any required A2.",
        "Use harness-git-flow as the sole coordinator-state writer with fresh trace/CAS, reserve integration before final review, and explicitly prune only a future task's frozen .task-artifacts root.",
        "Stage only task-owned files and create one terminal task commit after completion-ready evidence.",
        "Record the nine real exact-head gates, transition the task to ready, perform FF-only local integration, and invoke ordinary non-force push to origin/master.",
        "After this task is pushed, create and complete one separate fresh manifest-backed verification task using the same standing ordinary-push grant."
      ],
      "requires_reapproval": [
        "Any change to the goal, manifest path or schema, disposable-root inventory, standing-push envelope, task path envelope, required gate set, validation criterion, or terminal persistence action.",
        "Any automatic cleanup, registration of node_modules/.pnpm-store/dist or another root, product runtime behavior, dependency/toolchain change, external repository mutation, secret use, force/rebase/stash/reset/clean, PR, release, or deployment."
      ],
      "prohibited": [
        "Developing or editing task files in the integration-only master checkout.",
        "Hand-writing coordinator state, passed gates, artifact policy receipts, or push receipts.",
        "Following or deleting an unowned link/reparse target, pruning a caller-selected path, or pruning without the task-frozen manifest policy.",
        "Modifying D:\\quant, enabling general automatic cleanup, registering broad generated roots, force pushing, opening a PR, releasing, deploying, or using secrets."
      ],
      "persistence": {
        "required": true,
        "action": "Create one terminal task commit containing the completed ExecPlan, policy, implementation, tests, and evidence; then record exact-head coordinator gates, ready, FF-only local integration, and an ordinary verified push receipt.",
        "source": "Current user instruction and docs/plans/README.md terminal persistence rule"
      }
    },
    "scope": {
      "task_paths": [
        {"path": ".codex/harness-git-flow.json", "kind": "file"},
        {"path": ".gitignore", "kind": "file"},
        {"path": "AGENTS.md", "kind": "file"},
        {"path": "docs/feasibility/sqlite-windows.md", "kind": "file"},
        {"path": "docs/feasibility/toolchain.md", "kind": "file"},
        {"path": "docs/plans/active/adopt-task-artifact-policy.md", "kind": "file"},
        {"path": "docs/plans/completed/adopt-task-artifact-policy.md", "kind": "file"},
        {"path": "docs/plans/evidence/adopt-task-artifact-policy", "kind": "directory"},
        {"path": "docs/plans/proposal/adopt-task-artifact-policy.md", "kind": "file"},
        {"path": "docs/reference/local-agent-git-flow.md", "kind": "file"},
        {"path": "docs/reference/repository-governance.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "docs/reference/validation-policy.md", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "scripts/repo-utils.mjs", "kind": "file"},
        {"path": "scripts/sqlite-feasibility.mjs", "kind": "file"},
        {"path": "test/artifact-policy.test.mjs", "kind": "file"},
        {"path": "test/repo-utils.test.mjs", "kind": "file"},
        {"path": "test/sqlite-feasibility.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "The governance-only schema-v3 plan has a fixed scope, explicit standing-push and prune authorization envelope, Tier-2 persistence analysis, exact pushed EP-01A base evidence, and fresh independent A0 activation evidence.",
        "validation_ids": ["V1"]
      },
      {
        "id": "M2",
        "outcome": "A committed schema-v1 manifest registers exactly .task-artifacts, the ignore boundary matches it, and repository policy explains task-start freezing, explicit prune receipt, root absence, fail-closed refusal, and non-retroactivity without depending on a private skill for public contribution.",
        "validation_ids": ["V2", "V4", "V7"]
      },
      {
        "id": "M3",
        "outcome": "Existing package and SQLite feasibility processes create only unique creator-owned child generations beneath .task-artifacts and remove only those children; Windows junction/reparse and identity-drift cases fail before target mutation.",
        "validation_ids": ["V3", "V5", "V6", "V8"]
      },
      {
        "id": "M4",
        "outcome": "Repository authority grants and bounds default ordinary push after exact-head readiness and FF-only integration, retains observable retry on partial failure, and expressly excludes cleanup and broader external actions.",
        "validation_ids": ["V4", "V7"]
      },
      {
        "id": "M5",
        "outcome": "Stable-diff A1 and any required A2 close; all targeted and full offline gates pass with no surviving .task-artifacts material; the completed plan and evidence are ready for one terminal commit, exact-head coordinator receipts, FF-only integration, and ordinary push.",
        "validation_ids": ["V1", "V4", "V5", "V6", "V7", "V8", "V9"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "ExecPlan lifecycle, scope, independent audits, Tier-2 persistence closure, and terminal persistence",
        "criterion": "exec_plan.py trace reports schema v3, exact task scope, no error/warning/outside-scope or stale evidence, fresh independent A0 and A1, required A2 closure-safe, every milestone/validation successful, a nonempty final summary, and no completion blocker before the one task commit."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Machine-readable artifact manifest and ignore contract",
        "criterion": "The targeted artifact-policy test exits 0 and proves .codex/harness-git-flow.json has exactly schema_version=1 and disposable_roots=[\".task-artifacts\"], the root is repository-relative and ignored, no tracked path overlaps it, .ep00b-tmp is no longer a live implementation or ignore path, and no broader generated root is registered."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Node artifact-root ownership and Windows path security",
        "criterion": "The targeted repository-utils tests exit 0 and prove a regular .task-artifacts root is checked before and after unique child creation, child identity remains contained, internal links are unlinked without traversal, external junctions and a pre-existing root junction are refused before target mutation, only the owned child is removed, and the empty exact root is removed without force."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Documentation links, authority uniqueness, capability truthfulness, and authorization envelope",
        "criterion": "pnpm docs:check and git diff --check exit 0; manual review finds one workflow/push/prune owner, one machine manifest, no conflicting permission copy, no claim of automatic cleanup or product runtime support, no private-skill requirement for public contributors, and no rewritten historical EP-00B evidence."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Complete Node regression and artifact cleanup",
        "criterion": "pnpm test exits 0 for the complete Node suite and .task-artifacts is absent at process completion; no test is skipped on the current Windows host when it owns a Windows path-security obligation."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Real Windows SQLite feasibility through the new root",
        "criterion": "pnpm spike:sqlite exits 0 on Windows with the complete existing concurrency, backup/publication, corruption, ambiguity, and reparse matrix, reports survivingGenerationMembers=0, and leaves .task-artifacts absent."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Repository inventory, frozen configuration, manifest JSON, and whitespace hygiene",
        "criterion": "pnpm lint exits 0 against the complete candidate inventory; all JSON and text checks pass; no forbidden, generated, sensitive, reparse, configuration-drift, source-boundary, or whitespace member is committed; staged inventory later contains only declared task-owned paths."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Offline package consumption through the new artifact root",
        "criterion": "pnpm package:smoke exits 0 using the frozen local dependency material, packs and consumes the declared package, uninstalls it, reports all package checks passed, and leaves .task-artifacts absent."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Full offline cross-cutting regression",
        "criterion": "A worktree-local frozen dependency install followed by pnpm verify:offline exits 0 across lint, typecheck, build, complete Node tests, docs, dependency shape, package smoke, real Windows SQLite, and Codex blocked-boundary checks, with no network repair and no surviving .task-artifacts root."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "A broad or mutable manifest could turn artifact pruning into arbitrary recursive deletion."},
      {"id": "R2", "risk": "A symlink/junction/reparse or identity swap could redirect creator cleanup or coordinator pruning outside the owned root."},
      {"id": "R3", "risk": "Renaming the feasibility root could leave one script, test, ignore rule, or document on the historical .ep00b-tmp path."},
      {"id": "R4", "risk": "Standing push wording could be mistaken for force, PR, release, deployment, cleanup, arbitrary network, or external-repository authorization."},
      {"id": "R5", "risk": "The current pre-manifest task could be falsely described as manifest-backed, weakening receipt truthfulness."},
      {"id": "R6", "risk": "Coordinator or ExecPlan state could become stale between reserve, review, commit, gate, integration, and push."},
      {"id": "R7", "risk": "A governance-only commit between EP-01A and EP-01B could be confused with the product roadmap predecessor chain."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Use .codex/harness-git-flow.json as the only machine-readable repository opt-in and register only .task-artifacts in schema v1.",
        "rationale": "One narrow frozen root makes coordinator pruning deterministic and auditable without granting authority over package stores, build output, runtime data, or caller-selected paths."
      },
      {
        "id": "D2",
        "statement": "Rename the shared repository utility root from .ep00b-tmp to .task-artifacts and keep package/SQLite scripts consuming that single implementation owner rather than duplicating paths.",
        "rationale": "The existing creator-owned generation mechanism already supplies bounded child ownership and Windows no-follow defenses; generalizing its root avoids a second artifact lifecycle."
      },
      {
        "id": "D3",
        "statement": "Define default completion for coordinator-managed maintainer tasks as pushed: after exact-head gates, ready, and FF-only integrate, call ordinary coordinator push unless the current user has revoked or narrowed the standing grant.",
        "rationale": "This removes repetitive push prompts while retaining a separate, mechanically observable push transition and the user's higher-priority ability to revoke it."
      },
      {
        "id": "D4",
        "statement": "Keep prune-artifacts explicit and cleanup manual; a manifest-backed task must prune its frozen root and obtain a fresh receipt before gates, but no worktree/branch cleanup is inferred or performed.",
        "rationale": "Task scratch removal and Git resource cleanup have different ownership/risk envelopes, and the user approved only the former exact-root operation."
      },
      {
        "id": "D5",
        "statement": "Treat this first task as null-policy historical fact and use a second task started after integration for the real manifest-backed lifecycle proof.",
        "rationale": "Coordinator v2 deliberately freezes policy at task start, so retrospective attachment would invalidate provenance."
      },
      {
        "id": "D6",
        "statement": "Keep this governance change outside the EP-00/EP-01 product chain and require the next product plan to assess the governance-only base delta while retaining EP-01A as its strict predecessor.",
        "rationale": "Repository workflow maintenance should not acquire product-domain sequencing authority."
      }
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep the unique plan in proposal and make no implementation edit if scope, authorization, base, Tier-2 obligations, or independent A0 is not exact."},
      {"id": "M2", "recovery": "Leave the manifest uncommitted and the task editable if schema, ignored-root, tracked-overlap, or policy-owner checks fail; do not hand-edit coordinator state."},
      {"id": "M3", "recovery": "Preserve the exact failing Windows fixture, refuse deletion, and repair only task-owned root/identity logic without force, clean, or target traversal."},
      {"id": "M4", "recovery": "Narrow ambiguous prose and keep push separately observable; do not execute broader external actions or infer cleanup authority."},
      {"id": "M5", "recovery": "Keep the task active/reserved on any audit, validation, inventory, gate, integrate, or push failure; recover only through fresh ExecPlan/coordinator traces and exact allowed transitions."}
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
      {"id": "V9", "state_binding": "material"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Freeze exact schema/key/root inventory at task start and accept no prune path argument; test ignored status and zero tracked overlap.", "recovery": "Refuse start or prune and leave the root untouched until the committed manifest and inventory are unambiguous."},
      {"id": "R2", "mitigation": "Validate root and child node class, real path, containment, device/inode identity, and reparse boundaries before mutation; remove only creator-owned children or the coordinator-frozen exact root.", "recovery": "Fail closed with the suspect node intact for human inspection; never follow, force-remove, or adopt it."},
      {"id": "R3", "mitigation": "Centralize the live path constant, search all current scripts/tests/docs/ignore rules, add an exact negative for .ep00b-tmp, and leave only immutable historical evidence unchanged.", "recovery": "Keep the task active and update every current consumer before rerunning targeted and full gates."},
      {"id": "R4", "mitigation": "State the exact prerequisites, configured ref target, ordinary non-force command, revocation rule, partial-failure state, and excluded actions in the single workflow owner and routed summaries.", "recovery": "Fail closed on ambiguity and request fresh user authority for any action outside the standing envelope."},
      {"id": "R5", "mitigation": "Record artifact_policy=null for this task and defer the genuine policy receipt check to a separately started post-integration task.", "recovery": "Do not fabricate or attach a receipt; report the proof as pending until the second task completes."},
      {"id": "R6", "mitigation": "Use fresh traces and single-use CAS, reserve before stable review, bind audits/validations/gates to exact material/head identities, integrate FF-only, and preserve merged_local on push failure.", "recovery": "Run only coordinator recover when pending intent exists; otherwise retry the exact idempotent transition or leave the reservation observable."},
      {"id": "R7", "mitigation": "Label this plan governance-only and document that EP-01B keeps EP-01A as strict predecessor plus a separate governance-base assessment.", "recovery": "Correct the successor plan before activation; never rewrite completed product-chain evidence."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "71dc606d5e4c40de4f669d0732da653d81bc8f92",
      "current_material_base": "71dc606d5e4c40de4f669d0732da653d81bc8f92",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-08-29 10:13:00+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-08-29 10:45:55+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-08-29 10:20:00+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-08-29 10:20:00+08:00"},
      {"id": "M5", "status": "complete", "updated_at": "2026-08-29 10:47:00+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Run exec_plan.py trace against the completed-plan path after recording all exact-state validation, milestone, audit, finding-closure, inventory, and final-summary evidence.",
        "evidence": "adopt-task-artifact-policy/V1/terminal at 2026-08-29 10:47:00+08:00. The terminal trace exited 0 with schema_version=3, lifecycle=completed, approval/current material base and HEAD all 71dc606d5e4c40de4f669d0732da653d81bc8f92, state git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f, errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], every milestone complete, V1-V9 passed at the current material state, independent A0 complete, independent A1 complete, F-A1-001 closed by independent A2 at the repaired state, final_summary_present=true, and completion_ready=true.",
        "state_id": "git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "From the canonical task worktree run the dedicated artifact-policy Node test and inspect the manifest, ignore result, tracked inventory, current consumer files, and exact disposable-root inventory.",
        "evidence": "adopt-task-artifact-policy/V2/current at 2026-08-29 10:20:00+08:00. The targeted Node command exited 0. The manifest is one regular non-link JSON file with exactly schema_version=1 and disposable_roots=[.task-artifacts]; git check-ignore accepted a child, git ls-files found zero tracked overlap, current implementation/ignore files contain no .ep00b-tmp path, and no broad generated root is registered.",
        "state_id": "git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Run the dedicated repository-utils Node tests on the current Windows host and inspect root/generation identity checks, creator receipts, junction fixtures, target inventories, and terminal root absence.",
        "evidence": "adopt-task-artifact-policy/V3/current at 2026-08-29 10:34:00+08:00. The repaired targeted artifact/repository-utils/SQLite suite exited 0 with 11 passed and no failure/skip. Cleanup atomically quarantined the exact receipt-bound generation and revalidated every member. Internal junction cleanup unlinked without traversal; external/root junctions and an unreceipted child were refused; deterministic post-inventory, post-quarantine, and per-member swaps failed closed while both owned and replacement bytes survived for recovery; ten further stress iterations passed; .task-artifacts was absent.",
        "state_id": "git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Run node scripts/docs-check.mjs and git diff --check, then manually review AGENTS.md plus the workflow, governance, toolchain, validation, and feasibility documentation against repository authority and the complete plan envelope.",
        "evidence": "adopt-task-artifact-policy/V4/current at 2026-08-29 10:34:00+08:00. Post-repair documentation check exited 0 with 54 Markdown files, 231 exact-case local links, and zero forbidden item; diff check exited 0. Manual review found one normative workflow/push/prune owner and one machine manifest. The narrow standing grant requires exact-head gates, ready, and FF-only integration, remains revocable, and excludes cleanup, force, PR, release, deployment, secret, arbitrary network, and external-repository actions. Creator cleanup now documents its receipt-bound same-root quarantine and member revalidation. Public contribution remains independent of maintainer skills; product/runtime support is unclaimed; completed EP-00B history is unchanged.",
        "state_id": "git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Run the complete Node test suite as part of the frozen offline pnpm verify:offline command and require no surviving artifact root after the process.",
        "evidence": "adopt-task-artifact-policy/V5/current at 2026-08-29 10:34:00+08:00 on Windows 10.0.22631 x64 and Node 24.19.0. The repaired complete suite exited 0 with 44 passed, 0 failed, 0 skipped, and 0 todo, including all three identity-swap failpoints, artifact policy, creator receipt, Windows junction, Domain Core, package/configuration, SQLite, and Codex boundary tests. .task-artifacts was absent afterward.",
        "state_id": "git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Run node scripts/sqlite-feasibility.mjs --json directly in the targeted suite and again inside the full offline gate; inspect the complete structured Windows result and root absence.",
        "evidence": "adopt-task-artifact-policy/V6/current at 2026-08-29 10:20:00+08:00 on Windows 10.0.22631 x64, Node 24.19.0, and SQLite 3.53.3. The real matrix passed foreign keys, WAL snapshot concurrency, bounded busy/pre-readiness failure, one claim winner, DELETE-mode backup, exact publication/CAS/readback, incomplete/extra/reparse/conflict/corruption/ambiguous-restart refusal, and survivingGenerationMembers=0. .task-artifacts was absent after both runs.",
        "state_id": "git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Run the complete lint route and git diff --check, then stage only the fifteen task-owned paths and compare the staged list, Git modes, ignored/generated inventory, and ExecPlan trace against the declared scope.",
        "evidence": "adopt-task-artifact-policy/V7/current at 2026-08-29 10:45:55+08:00. The repaired full offline gate had already passed lint with 89 checked files and 3 source files. Fresh git diff --cached --check exited 0; staged inventory exactly equaled all fifteen task-owned paths and contained no extra path; every staged entry had regular-file mode 100644; ExecPlan trace reported staged=task_owned, unstaged=[], untracked=[], outside_scope=[], overlap=[], and pre_existing_dirty=[]. Ignored .pnpm-store, node_modules, dist, and runtime artifacts were not staged, and .task-artifacts was absent.",
        "state_id": "git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Use the exact offline frozen install and run pnpm package:smoke through the authoritative package script; inspect its generation, pack, consumer, uninstall, and terminal root state.",
        "evidence": "adopt-task-artifact-policy/V8/current at 2026-08-29 10:20:00+08:00 with pnpm 11.19.0 and TypeScript 5.9.3. Package smoke exited 0 with 15 packed files and export, console, and uninstall all passed. Its unique .task-artifacts child and the empty root were removed; .pnpm-store remained outside the coordinator manifest.",
        "state_id": "git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "After copying 133 regular cached dependency files with zero reparse entry into the task-local ignored store, run pnpm install offline/frozen with zero downloads and then pnpm verify:offline with npm/pnpm offline mode and dependency repair disabled.",
        "evidence": "adopt-task-artifact-policy/V9/current at 2026-08-29 10:34:00+08:00. Exact TypeScript 5.9.3 remained installed from the zero-download frozen offline step. The repaired verify:offline exited 0 across lint 89/3, strict typecheck, build, Node 44/44, docs 54/231/0, zero-production dependency shape, package smoke 15 files, real Windows SQLite with zero surviving generation members, and Codex externalE2E=not_run/supportClaim=false. No network, repair, or surviving .task-artifacts root was used.",
        "state_id": "git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/artifact_policy_a0",
        "independence": "Fresh read-only review; reviewer did not draft the proposal, make its implementation decisions, or modify repository, Git, coordinator, permission, or external state.",
        "scope": "A0 activation audit of adopt-task-artifact-policy: goal/non-goals, authorization, standing ordinary-push envelope, exact .task-artifacts manifest/prune boundary, Tier-2 persistence closure, null-policy non-retroactivity, governance-only product-chain treatment, milestones, validations, recovery, current coordinator trace, and material base.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-29 10:12:19+08:00",
        "approval_sha256": "66A1ADC5BBE42020C31A4BB238E5547B6C0DCE299A7241D2C2E175B1DA6B2343",
        "reviewed_material_base": "71dc606d5e4c40de4f669d0732da653d81bc8f92",
        "evidence": "Fresh exec_plan trace exited 0 with schema v3, errors=[], warnings=[], outside_scope=[], approval/current material base and HEAD all 71dc606d5e4c40de4f669d0732da653d81bc8f92, and only the task-owned proposal untracked. Independent canonical UTF-8 sorted-key compact-JSON recomputation produced 15396 bytes and the exact approval SHA256 recorded here. Git verified that material base is the pushed EP-01A commit and equals master and origin/master. Fresh coordinator v2 trace showed generation 37, pending_operation=null, reservation=null, task adopt-artifact-policy active at the exact base, artifact_policy=null, artifact_prune_receipt=null, and the nine plan-matching frozen gates. Repository authority, workflow, validation, toolchain, current artifact implementation, A0 contract, and Tier-2 persistence lens were reviewed. The contract narrowly authorizes ordinary non-force push only after exact-head gates, ready, and FF-only integration; excludes cleanup and broader external actions; registers only the exact future .task-artifacts root; preserves current-task non-retroactivity; and routes genuine manifest-backed proof to a separate post-integration task. Writer/reader closure, Git-blob policy identity, pre-mutation refusal, topology isolation, no-follow/identity/CAS controls, terminal receipt/root-absence evidence, partial-success handling, and recovery are materially covered. The governance task remains outside the EP-00/EP-01 product predecessor chain.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/artifact_policy_a1",
        "independence": "Fresh read-only review; reviewer did not implement the candidate or modify repository, Git/index/refs/worktrees, coordinator state, permissions, network, or D:\\quant.",
        "scope": "A1 audit of the complete material diff from 71dc606d5e4c40de4f669d0732da653d81bc8f92, including artifact manifest/ignore policy, creator-owned Node/SQLite generations, Windows reparse and identity defenses, standing ordinary-push authorization, coordinator v2/null-policy semantics, documentation authority, product-chain boundary, validation evidence, and recovery.",
        "reviewed_at": "2026-08-29 10:27:00+08:00",
        "evidence": "Fresh exec_plan trace exited 0 with errors=[], warnings=[], outside_scope=[], HEAD/material base 71dc606d5e4c40de4f669d0732da653d81bc8f92 and exact state git-sha1:9fbd62695f3b42c9852b7d7d2dcc1bd31414e174. Fresh coordinator trace showed version=2, generation=38, pending_operation=null, adopt-artifact-policy reserved at the exact base, artifact_policy=null, artifact_prune_receipt=null, and nine pending frozen gates. Reviewed AGENTS.md, architecture and authoritative workflow/toolchain/validation/governance contracts, active schema-v3 plan, validation evidence, complete IMPLEMENTATION-AUDIT.md and Tier-2 PERSISTENCE-AUDIT.md, FLOW-SCHEMA.md, manifest, full task diff, scripts, tests, and current coordinator state. Manifest/schema/ignore/tracked-overlap, non-retroactivity, push exclusions, coordinator prune semantics, package/SQLite routing, historical EP-00B preservation, and governance-only product-chain treatment were otherwise coherent.",
        "reviewed_state_id": "git-sha1:9fbd62695f3b42c9852b7d7d2dcc1bd31414e174",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-A1-001",
            "severity": "MEDIUM",
            "summary": "Creator cleanup releases its receipt-bound identity check before recursive deletion, leaving a path-swap race that can delete a replacement regular directory.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Quarantine the receipt-bound generation through a same-root atomic rename, verify the moved dev/ino/real-path identity, revalidate root/quarantine and every inventoried member before a unique same-parent rename-and-delete boundary, retain recovery by restoring the exact quarantine when safe, and add deterministic post-inventory swap coverage proving replacement bytes remain untouched.",
            "closure_evidence": "Fresh independent A2 at 2026-08-29 10:41:22+08:00 reviewed the repaired quarantine/member identity strategy, deterministic swap fixtures, targeted 11/11, complete 44/44, ten stress iterations, full offline gate, and terminal root absence; it closed F-A1-001 at git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f with no adjacent residual finding.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/artifact_policy_a2",
        "independence": "Fresh read-only A2; reviewer did not implement the repair or modify files, Git/index/refs/worktrees, coordinator state, permissions, network, or D:\\quant.",
        "scope": "Closure audit of F-A1-001 and directly adjacent risks within the same .task-artifacts creator-cleanup root, quarantine strategy, and authorization envelope.",
        "reviewed_at": "2026-08-29 10:41:22+08:00",
        "evidence": "Fresh exec_plan trace exited 0 with errors=[], warnings=[], outside_scope=[], HEAD/material base 71dc606d5e4c40de4f669d0732da653d81bc8f92, and repaired material state git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f. Reviewed repository authority/contracts, complete IMPLEMENTATION-AUDIT.md and Tier-2 PERSISTENCE-AUDIT.md, active plan including A1 disposition, full repaired task diff, validation evidence, scripts/repo-utils.mjs, and test/repo-utils.test.mjs. removeOwnedGeneration now requires the creator receipt, captures inventory, revalidates after the post-inventory seam, atomically renames the exact receipt-bound generation to a unique same-root quarantine, verifies post-rename root/path/dev/ino identity, revalidates quarantine and each inventoried member, and moves every member to a unique same-parent tombstone with post-rename identity verification before deletion. Failure restores the exact quarantine only when identity and destination remain safe; otherwise ambiguous/replacement state is preserved. Deterministic post-inventory, post-quarantine, and per-member swaps assert refusal while both owned and replacement bytes survive. Current adjacent validation records 11/11 targeted tests, 44/44 complete tests, ten stress iterations, the full offline gate, and terminal .task-artifacts absence. No directly adjacent residual finding was identified.",
        "reviewed_state_id": "git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f",
        "parent_disposition": "complete",
        "closes": ["F-A1-001"],
        "findings": []
      }
    },
    "audit_attempts": [],
    "validation_attempts": [
      {"validation_id": "V2", "attempt": 1, "classification": "superseded", "at": "2026-08-29 10:34:00+08:00", "evidence": "The pre-A1 manifest result passed at git-sha1:9fbd62695f3b42c9852b7d7d2dcc1bd31414e174 but became stale when the confirmed F-A1-001 cleanup repair changed material state; the same criterion was rerun and is current above.", "state_id": "git-sha1:9fbd62695f3b42c9852b7d7d2dcc1bd31414e174"},
      {"validation_id": "V3", "attempt": 1, "classification": "superseded", "at": "2026-08-29 10:34:00+08:00", "evidence": "The pre-A1 Windows identity result at git-sha1:9fbd62695f3b42c9852b7d7d2dcc1bd31414e174 lacked post-validation swap coverage and was superseded by the quarantine/member-revalidation repair and current failpoint evidence.", "state_id": "git-sha1:9fbd62695f3b42c9852b7d7d2dcc1bd31414e174"},
      {"validation_id": "V4", "attempt": 1, "classification": "superseded", "at": "2026-08-29 10:34:00+08:00", "evidence": "The pre-A1 documentation result passed at the earlier state but became stale when toolchain authority and evidence documented the repaired cleanup boundary; the complete documentation gate was rerun.", "state_id": "git-sha1:9fbd62695f3b42c9852b7d7d2dcc1bd31414e174"},
      {"validation_id": "V5", "attempt": 1, "classification": "superseded", "at": "2026-08-29 10:34:00+08:00", "evidence": "The 41-test pre-A1 suite passed at the earlier state but did not contain the three deterministic identity-swap regressions; the repaired current suite passes 44 tests.", "state_id": "git-sha1:9fbd62695f3b42c9852b7d7d2dcc1bd31414e174"},
      {"validation_id": "V6", "attempt": 1, "classification": "superseded", "at": "2026-08-29 10:34:00+08:00", "evidence": "The pre-A1 SQLite matrix passed but its creator-cleanup implementation changed; the complete real Windows matrix was rerun through the repaired cleanup path.", "state_id": "git-sha1:9fbd62695f3b42c9852b7d7d2dcc1bd31414e174"},
      {"validation_id": "V8", "attempt": 1, "classification": "superseded", "at": "2026-08-29 10:34:00+08:00", "evidence": "The pre-A1 package smoke passed but its creator-cleanup implementation changed; the complete package consumer and cleanup route was rerun at the repaired state.", "state_id": "git-sha1:9fbd62695f3b42c9852b7d7d2dcc1bd31414e174"},
      {"validation_id": "V9", "attempt": 1, "classification": "superseded", "at": "2026-08-29 10:34:00+08:00", "evidence": "The pre-A1 full offline gate passed but became stale after the cleanup repair; the entire gate was rerun without network or repair and is current above.", "state_id": "git-sha1:9fbd62695f3b42c9852b7d7d2dcc1bd31414e174"}
    ],
    "contract_revisions": [],
    "final_summary": "Adopted the sole .task-artifacts manifest and matching ignore/governance contract for future coordinator tasks; routed current Node package-smoke and Windows SQLite feasibility generations through creator-owned receipt-bound cleanup with same-root quarantine and per-member identity revalidation; documented a narrow revocable standing ordinary-push grant while leaving cleanup and broader external actions separately authorized; preserved this pre-manifest task's truthful artifact_policy=null; passed independent A0, A1, and A2 plus all targeted and complete offline validation at material state git-sha1:933fc46a5150c491fd913ab45f3dde9c0668c44f. The remaining manifest-backed lifecycle proof is intentionally assigned to a new post-integration task."
  }
}
```

## Context

The local coordinator was upgraded from state version 1 to version 2 only after EP-01A was ordinarily pushed and its reservation cleared. The start receipt for this task records `artifact_policy=null`, base `71dc606d5e4c40de4f669d0732da653d81bc8f92`, and the nine frozen gates named in this plan. Completed EP-00B evidence continues to describe the historical `.ep00b-tmp` implementation that existed at that terminal commit.
