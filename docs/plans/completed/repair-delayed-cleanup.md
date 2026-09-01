# ExecPlan：修复已推送任务的延迟清理判定

本计划修复已安装 `harness-git-flow` skill 的 cleanup 判定，使历史任务在后续任务已正常快进并推送后仍可安全退场；仓库本身只保存本次 Tier 2 外部变更的可审计计划。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-01 20:27:34+08:00",
    "updated_at": "2026-09-01 21:24:13+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "User explicitly authorized modifying the installed harness-git-flow skill after reviewing the delayed-cleanup failure and proposed invariant",
        "at": "2026-09-01 20:27:34+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "The same explicit skill-modification authorization permits persisting the three declared external skill files, including the authoritative FLOW-SCHEMA, and the repository audit plan; the repository contract separately authorizes exact-head FF-only integration and ordinary origin/master push",
        "at": "2026-09-01 20:27:34+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Permit coordinator cleanup of an exact pushed task after later synchronized fast-forward descendants have advanced master, while preserving proof that the task branch is still the exact pushed head, that current local integration equals remote tracking, that the task head is an ancestor of current integration, and that every existing identity, ownership, cleanliness, artifact, recovery, and no-force safeguard still passes.",
    "non_goals": [
      "Do not change product runtime, repository Git-flow policy, coordinator state by hand, public APIs, or another repository.",
      "Do not permit cleanup of an unpushed, rewritten, moved, dirty, unregistered, non-ancestor, remotely divergent, pending, reserved, or artifact-bearing task.",
      "Do not add a compatibility branch for the rejected exact-current-head rule or preserve obsolete cleanup behavior.",
      "Do not delete the integration checkout, Codex worktrees, .local content, user files, or any path outside an exact coordinator-owned task cleanup transition."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "Historical push provenance remains exact: push receipt local_head and remote_head, task ready_head, and the live task branch head must all be the same commit.",
        "source": "User-approved invariant; harness-git-flow cleanup and push receipt contracts"
      },
      {
        "id": "C2",
        "statement": "Current integration_head and remote_tracking_head must be equal, and the exact task head must be an ancestor of that synchronized current head; equality is allowed for immediate cleanup and strict ancestry is allowed for delayed cleanup.",
        "source": "User-approved delayed-cleanup invariant; docs/reference/local-agent-git-flow.md merged-ancestry rule"
      },
      {
        "id": "C3",
        "statement": "Existing cleanup requirements for pushed status, no reservation or pending operation, integration identity, registered task identity, clean task inventory, fresh artifact-prune receipt when required, zero ignored material, intent journaling, recovery, and ownership-safe deletion remain unchanged and fail closed.",
        "source": "AGENTS.md; harness-git-flow SKILL.md and FLOW-SCHEMA.md"
      },
      {
        "id": "C4",
        "statement": "Command preconditions and cleanup pending-state validation must encode one coherent descendant-safe invariant so a valid delayed cleanup neither fails schema validation after intent publication nor weakens recovery matching.",
        "source": "harness-git-flow Tier 2 coordinator-state contract"
      },
      {
        "id": "C5",
        "statement": "The external change is limited to the installed skill implementation, its test file, and the authoritative FLOW-SCHEMA cleanup wording; the repository change is limited to this plan's proposal, active, and completed lifecycle paths.",
        "source": "Current user authorization; AGENTS.md task-owned scope rule"
      },
      {
        "id": "C6",
        "statement": "Development uses only task/repair-delayed-cleanup in its registered worktree; harness-git-flow remains the sole coordinator-state writer, receipts bind exact heads, integration is FF-only, and push is ordinary non-force.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md"
      },
      {
        "id": "C7",
        "statement": "Fresh independent A0 is required before activation, fresh independent A1 is required for the stable external implementation and plan material, and each confirmed in-scope HIGH or MEDIUM repair requires fresh independent A2.",
        "source": "harness-exec-plan A0/A1/A2 contracts"
      }
    ],
    "authorization": {
      "allowed": [
        "Read and edit only the declared repository lifecycle paths in the task worktree and the three declared installed-skill files: implementation, regression test, and authoritative FLOW-SCHEMA.",
        "Run local read-only inspection, focused and full external skill tests, skill quick validation, repository plan validation, and Git diff checks without dependency repair or network access.",
        "Use independent read-only reviewers for A0, A1, and any required A2.",
        "Stage and commit only the repository plan paths, record exact-head gates, integrate FF-only, and invoke the standing-authorized ordinary non-force push to origin/master.",
        "After the repaired skill is validated and published, invoke only the separately authorized coordinator cleanup transitions for the exact previously inventoried clean pushed tasks, each with fresh trace/CAS and direct postcondition verification."
      ],
      "requires_reapproval": [
        "Any change to external files beyond the declared implementation, regression test, and FLOW-SCHEMA, any repository product or policy change, any weaker provenance/synchronization/ancestry/cleanliness predicate, or any broader deletion target.",
        "Any force, rebase, stash, reset, clean, manual ref/state/receipt edit, pull request, release, deployment, secret access, dependency repair, or unrelated network access.",
        "Any cleanup target not already covered by the user's separate cleanup authorization and exact coordinator ownership evidence."
      ],
      "prohibited": [
        "Hand-writing coordinator state, receipts, refs, branches, or worktree metadata to bypass cleanup refusal.",
        "Treating a merely pushed historical receipt as sufficient without exact live task-head provenance, current local/remote synchronization, and merged ancestry.",
        "Deleting the integration checkout, Codex worktrees, .local content, user files, dirty worktrees, nonempty inventories, or unregistered paths.",
        "Using reset, force deletion, force push, or history rewrite to manufacture a passing cleanup state."
      ],
      "persistence": {
        "required": true,
        "action": "Persist the approved external implementation, regression tests, and FLOW-SCHEMA cleanup contract, then create one terminal repository plan commit, obtain exact-head gates, integrate FF-only, and ordinarily push origin/master before using the repaired cleanup behavior.",
        "source": "Current user authorization and repository local Git-flow standing push contract"
      }
    },
    "scope": {
      "task_paths": [
        {"path": "docs/plans/proposal/repair-delayed-cleanup.md", "kind": "file"},
        {"path": "docs/plans/active/repair-delayed-cleanup.md", "kind": "file"},
        {"path": "docs/plans/completed/repair-delayed-cleanup.md", "kind": "file"}
      ],
      "external_paths": [
        "C:\\Users\\Administrator\\.codex\\skills\\harness-git-flow\\scripts\\git_flow.py",
        "C:\\Users\\Administrator\\.codex\\skills\\harness-git-flow\\tests\\test_git_flow.py",
        "C:\\Users\\Administrator\\.codex\\skills\\harness-git-flow\\references\\FLOW-SCHEMA.md"
      ],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "The schema-v3 approval contract fixes the descendant-safe cleanup invariant, exact scope, Tier 2 persistence boundary, binary validations, and recovery rules, and fresh independent A0 authorizes activation.",
        "validation_ids": ["V1"]
      },
      {
        "id": "M2",
        "outcome": "The installed coordinator and its authoritative FLOW-SCHEMA apply one coherent delayed-cleanup invariant in command preconditions, pending-state schema validation, and contract wording while retaining every prior fail-closed condition and recovery transition.",
        "validation_ids": ["V2", "V5"]
      },
      {
        "id": "M3",
        "outcome": "Regression coverage proves delayed cleanup succeeds after a later synchronized FF push and refuses moved task heads, unsynchronized integration/remote state, non-ancestry, dirty or material inventories, and other existing unsafe states.",
        "validation_ids": ["V2", "V3", "V4"]
      },
      {
        "id": "M4",
        "outcome": "External hashes are fresh, fresh independent A1 and any required A2 close, and the completed plan is precommit-ready for a separately verified exact-head gate, FF-only integration, and ordinary push sequence that must finish before operational cleanup resumes.",
        "validation_ids": ["V1", "V3", "V4", "V5", "V6", "V7"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "ExecPlan schema, exact scope, approval digest, activation readiness, and non-self-referential terminal lifecycle control",
        "criterion": "Before activation, exec_plan.py trace exits 0 with schema v3, no error, warning, or outside-scope path, and fresh independent A0 ready_for_activation; after all validation records and audits are truthfully terminal, the parent performs a separate fresh completion-readiness trace rather than using that derived result as V1's own prerequisite."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Focused delayed-cleanup behavior and negative safety boundaries",
        "criterion": "Focused external tests exit 0 and prove task A can be cleaned after task B advances and pushes synchronized master, while a moved task branch, local/remote divergence, or non-ancestor task head is refused before cleanup intent and all immediate-cleanup behavior remains passing."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Complete installed skill regression suite",
        "criterion": "The complete harness-git-flow unittest suite exits 0 with no failure, error, skip introduced by this change, or mutation outside isolated temporary repositories/coordinator fixtures."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Installed skill structure and instruction quality",
        "criterion": "skill-creator quick_validate.py exits 0 for the installed harness-git-flow skill, and no undeclared external file changes."
      },
      {
        "id": "V5",
        "type": "manual",
        "target": "Cleanup invariant coherence across implementation and authority, recovery preservation, and absence of obsolete compatibility code",
        "criterion": "Manual review finds exactly one provenance/synchronization/ancestry invariant expressed consistently by command, pending-state validation, and FLOW-SCHEMA; no exact-current-head compatibility fallback remains, and identity, cleanliness, artifact, intent, recovery, or ownership checks are not weakened."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "External-file freshness and repository path ownership",
        "criterion": "Immediately before A1 and again immediately before the terminal plan commit, SHA256 inspection matches the reviewed implementation, test, and FLOW-SCHEMA bytes; git status and staged inventory contain only the declared plan lifecycle path, and git diff --check exits 0."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Precommit readiness for exact-head coordinator persistence",
        "criterion": "Immediately before the terminal plan commit, fresh coordinator trace shows this exact registered task/worktree, no pending operation, no unrelated integration reservation, the frozen required-gate set and artifact policy unchanged, and no manual coordinator/ref mutation; actual post-commit prune, gates, ready, FF-only integration, and ordinary push are verified from coordinator receipts outside the immutable terminal plan blob."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "Relaxing current-head equality without binding the historical receipt to the live task branch could delete a rewritten or never-pushed task."},
      {"id": "R2", "risk": "Allowing descendant cleanup while local integration and remote tracking diverge could treat an unpublished or stale topology as durable."},
      {"id": "R3", "risk": "Updating only the command precondition could publish an intent that the coordinator's pending-state schema rejects or cannot recover coherently."},
      {"id": "R4", "risk": "The installed skill may drift between review, validation, repository commit, and later cleanup because it is outside the Git material state."},
      {"id": "R5", "risk": "Sequential cleanup of many historical tasks can partially succeed, leaving a truthful mixed set of cleaned and pushed tasks that must not be disguised as rollback."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Replace exact equality between current integration/remote heads and the historical push receipt with a conjunction: receipt local_head equals receipt remote_head equals ready_head equals live task_head; current integration_head equals remote_tracking_head; and task_head is an ancestor of current integration_head.",
        "rationale": "This permits legitimate FF descendants while preserving exact pushed-task provenance and current publication synchronization."
      },
      {
        "id": "D2",
        "statement": "Apply the same relation to cleanup pending-state validation and truth-sync FLOW-SCHEMA, while leaving recovery's exact stored pre/target topology matching and all non-ref safety checks intact.",
        "rationale": "Command authorization, durable intent validation, and recovery must agree on the state transition they accept."
      },
      {
        "id": "D3",
        "statement": "Add a two-task delayed-cleanup regression plus fail-before-intent negatives for moved task provenance and current local/remote divergence, and retain the complete existing suite as the compatibility gate.",
        "rationale": "The real failure requires a later push to reproduce, while adjacent unsafe topologies must remain mechanically refused."
      },
      {
        "id": "D4",
        "statement": "Do not use the repaired behavior until external validation, independent review, the terminal plan commit, exact gates, FF integration, and ordinary push have completed.",
        "rationale": "This keeps the Tier 2 coordinator mutation auditable and avoids circularly using an unreviewed cleanup rule to finish its own task."
      }
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep the plan in proposal until fresh A0 is complete; revise the contract and rerun A0 if any approval boundary changes."},
      {"id": "M2", "recovery": "If implementation or schema validation disagrees, restore only the task-owned external edits with apply_patch and leave coordinator state, refs, and existing worktrees untouched."},
      {"id": "M3", "recovery": "A failed isolated test retains its temporary evidence; repair only declared external files, refresh hashes, and rerun every affected validation."},
      {"id": "M4", "recovery": "External drift invalidates review and validation and requires fresh hashes and reruns. A failed gate leaves the task editable; a failed ordinary push remains merged_local for ordinary retry. Operational cleanup stops at the first refusal, preserves actual completed transitions, and resumes only from fresh trace/CAS evidence."}
    ],
    "validation_bindings": [
      {"id": "V1", "state_binding": "material"},
      {"id": "V2", "state_binding": "none"},
      {"id": "V3", "state_binding": "none"},
      {"id": "V4", "state_binding": "none"},
      {"id": "V5", "state_binding": "none"},
      {"id": "V6", "state_binding": "none"},
      {"id": "V7", "state_binding": "material"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Require receipt local/remote, ready_head, and live task_head to be identical before ancestry is considered.", "recovery": "Refuse before intent on any mismatch; never move the branch or edit the receipt to pass."},
      {"id": "R2", "mitigation": "Require current integration_head and remote_tracking_head equality and prove ancestry against that synchronized commit.", "recovery": "Refuse before intent; resolve publication state only through separately authorized normal Git-flow actions."},
      {"id": "R3", "mitigation": "Change and test command preconditions and pending-state schema validation together; preserve exact recovery snapshot matching.", "recovery": "Treat any intent/schema mismatch as a blocking defect and do not run cleanup against real historical tasks."},
      {"id": "R4", "mitigation": "Record before/after SHA256 values and refresh all three external hashes immediately before A1 and terminal commit.", "recovery": "Any unexplained hash change invalidates affected evidence and requires inspection, rerun, and fresh independent review."},
      {"id": "R5", "mitigation": "Process only the exact pre-inventoried clean tasks serially with fresh trace/CAS and verify each worktree/branch postcondition.", "recovery": "Stop at the first refusal or ambiguous result; report the exact cleaned and remaining sets without reset, force cleanup, or receipt rewriting."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "c2b05cb99dd8a0d233107461645b8360fa3ab420",
      "current_material_base": "c2b05cb99dd8a0d233107461645b8360fa3ab420",
      "base_transitions": []
    },
    "milestone_progress": [
      {
        "id": "M1",
        "status": "complete",
        "updated_at": "2026-09-01 20:45:56+08:00"
      },
      {
        "id": "M2",
        "status": "complete",
        "updated_at": "2026-09-01 20:57:02+08:00"
      },
      {
        "id": "M3",
        "status": "complete",
        "updated_at": "2026-09-01 20:57:02+08:00"
      },
      {
        "id": "M4",
        "status": "complete",
        "updated_at": "2026-09-01 21:24:13+08:00"
      }
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Run schema-v3 trace on the exact staged proposal, independently recompute the approval digest, and perform fresh independent A0 after each approval-contract revision.",
        "evidence": "Final activation trace exited 0 with errors=[], warnings=[], outside_scope=[], base/head c2b05cb99dd8a0d233107461645b8360fa3ab420 and state git-sha1:8d53c032834832e28f72e4a7ee8590dc417e65fc. Fresh A0 attempt 3 independently matched the 11200-byte digest E2C019529E518982B86A7479117482A9A61895B5B50F5AE95403736939737BC0 and returned ready_for_activation with findings=[]. Final completion readiness remains a separate parent trace after all results are terminal.",
        "state_id": "git-sha1:8d53c032834832e28f72e4a7ee8590dc417e65fc"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Run the table-driven pending/recovery validator, delayed descendant cleanup, and immediate cleanup as a focused repair route, then confirm every moved-head, unsynchronized-ref, non-ancestor, ignored-material, and delayed-acceptance case in the final complete suite.",
        "evidence": "The focused repair route ran 3 tests in 29.036s and exited 0: both new canonical malformed cleanup intents were rejected, delayed cleanup after a later synchronized push succeeded, and immediate cleanup still succeeded. The final complete 42-test suite also passed every command-level moved-head, current-ref divergence, non-ancestor, ignored-material, and delayed-acceptance regression.",
        "state_id": null
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Run python -m unittest discover -s . -p test_*.py from the installed harness-git-flow tests directory.",
        "evidence": "After the A1 repair, the complete installed skill suite ran 42 tests in 360.555s and exited 0 with OK; no failure, error, or skip was reported.",
        "state_id": null
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Run skill-creator quick_validate.py against the installed harness-git-flow root and inspect the skill tree for generated Python cache nodes.",
        "evidence": "After the A1 repair, quick_validate.py again exited 0 with 'Skill is valid!'. Recursive inspection returned no __pycache__ directory or .pyc file. The only intentional external writes were apply_patch updates to the three declared files; current hashes are git_flow.py=F3105168168EE51F498845D419A87C79ACF73F327600EA15C395F5AD8CC998A5, test_git_flow.py=7752A0151EFF1468D70D2FE064BC2A80090FD9C38843711B0CC6BC351247633C, and FLOW-SCHEMA.md=3E3E16F540FCE3D4CCDB1428C46BDE54F2E92BE4FFE7EB5F9A579EE5FF2AA9C9.",
        "state_id": null
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Manually inspect command_cleanup, cleanup pending-state validation, recovery matching, FLOW-SCHEMA cleanup clauses, and the added positive/negative regressions.",
        "evidence": "Command and pending validator now both require receipt local_head == remote_head == ready_head == live/pre task_head plus current integration_head == remote_tracking_head. Command preflight then proves task-head ancestry before intent. FLOW-SCHEMA states the same split. The old exact-current-head checks were removed with no fallback; existing pushed/no-reservation, integration/task identity, clean tracked/untracked/ignored inventory, artifact receipt, exact intent snapshots, recovery, and non-force owned deletion paths remain unchanged.",
        "state_id": null
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Refresh SHA256 for all three declared external files after A2 and immediately before terminalization; run staged and unstaged diff checks and inspect the exact repository inventory.",
        "evidence": "Final external hashes exactly match the A2-reviewed bytes: git_flow.py=F3105168168EE51F498845D419A87C79ACF73F327600EA15C395F5AD8CC998A5, test_git_flow.py=7752A0151EFF1468D70D2FE064BC2A80090FD9C38843711B0CC6BC351247633C, and FLOW-SCHEMA.md=3E3E16F540FCE3D4CCDB1428C46BDE54F2E92BE4FFE7EB5F9A579EE5FF2AA9C9. They differ from the recorded pre-edit hashes only through the declared implementation/test/contract repair. Both diff checks exited 0; before lifecycle archival the repository inventory contained only the declared active plan, with no unstaged or untracked path and no Python cache node.",
        "state_id": null
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Run a fresh harness-git-flow trace on the integration root and select the registered repair-delayed-cleanup identity, frozen gates, artifact policy, refs, pending operation, and reservation.",
        "evidence": "Coordinator generation 580 and CAS sha256:CDE9AE58013575771D631364954CCCC13DFAD83477C17D2D3EA64E40572ABD4B report pending_operation=null and reservation=null. Integration and remote-tracking heads both equal c2b05cb99dd8a0d233107461645b8360fa3ab420. The exact task is active on task/repair-delayed-cleanup at its registered D:\\agent-task-orchestrator\\.worktrees\\repair-delayed-cleanup path and same current_base; frozen gates remain cleanup-contract, documentation, execplan-audit, external-skill, tests; schema-v1 .task-artifacts policy remains frozen and prune receipt is null before the result commit. No manual coordinator or ref mutation occurred.",
        "state_id": "git-sha1:8d53c032834832e28f72e4a7ee8590dc417e65fc"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/rc09_a0_final",
        "independence": "Fresh independent read-only A0 attempt 3. Reviewer did not participate in the current approval-contract revision or implementation and performed no file, Git, coordinator, permission, test, or external-state mutation.",
        "scope": "Exact schema-v3 proposal docs/plans/proposal/repair-delayed-cleanup.md at approval material base c2b05cb99dd8a0d233107461645b8360fa3ab420, together with the applicable repository authority, harness-exec-plan A0/schema/persistence requirements, and the declared harness-git-flow implementation, regression-test, and FLOW-SCHEMA contract surfaces needed to assess the Tier 2 delayed-cleanup repair.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-01 20:44:06+08:00",
        "approval_sha256": "E2C019529E518982B86A7479117482A9A61895B5B50F5AE95403736939737BC0",
        "reviewed_material_base": "c2b05cb99dd8a0d233107461645b8360fa3ab420",
        "evidence": "A current read-only trace exited 0 with base/head/actual_head c2b05cb99dd8a0d233107461645b8360fa3ab420, state git-sha1:8d53c032834832e28f72e4a7ee8590dc417e65fc, and empty errors, warnings, outside_scope, overlap, unstaged, and untracked sets. Independent canonical serialization matched 11200 bytes and the stored digest. Full contract review confirmed exact historical task provenance, current local/remote synchronization, merged ancestry, all pre-existing fail-closed safeguards, coherent command/pending semantics, exactly three declared external paths, and non-circular validation/persistence ordering.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/rc09_a0_accept",
        "independence": "Fresh independent read-only A1 reviewer. Did not implement or repair repair-delayed-cleanup and made no file, Git, index, ref, coordinator, permission, test, or external-state mutation.",
        "scope": "Stable repair-delayed-cleanup implementation at repository material state git-sha1:8d53c032834832e28f72e4a7ee8590dc417e65fc: complete active plan and staged repository inventory; harness-git-flow command_cleanup, cleanup pending-state validation, intent publication, snapshot matching and recovery; authoritative FLOW-SCHEMA and repository Git-flow policy; focused cleanup regressions and adjacent state-validator tests; historical v1/v2 task and pending-intent compatibility; external-file freshness and obsolete exact-current-head residue.",
        "reviewed_at": "2026-09-01 21:08:30+08:00",
        "evidence": "Fresh trace exited 0 with errors=[], warnings=[], outside_scope=[], a0_ready=true, base/head c2b05cb99dd8a0d233107461645b8360fa3ab420, and state git-sha1:8d53c032834832e28f72e4a7ee8590dc417e65fc. Repository status contained only the staged active plan, with no unstaged or untracked path and clean diff checks. Reviewed external hashes were git_flow.py=F3105168168EE51F498845D419A87C79ACF73F327600EA15C395F5AD8CC998A5, test_git_flow.py=F8CD1126C0498AF19A500F40202F233F280B97746EAF02168CB05AAE5CAE5752, and FLOW-SCHEMA.md=3E3E16F540FCE3D4CCDB1428C46BDE54F2E92BE4FFE7EB5F9A579EE5FF2AA9C9. Source review found no runtime bug, historical compatibility break, exact-current-head fallback, or weakened safety check, but confirmed one missing durable-validator negative-coverage boundary.",
        "reviewed_state_id": "git-sha1:8d53c032834832e28f72e4a7ee8590dc417e65fc",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-A1-CLEANUP-PENDING-NEGATIVE-COVERAGE",
            "severity": "MEDIUM",
            "summary": "The durable cleanup pending-state validator's new synchronization and full provenance-tuple constraints were not independently pinned by negative schema regressions.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Extend the table-driven pending-state validation regression with canonical cleanup intents that preserve the generic task-head-only movement shape but are rejected because current integration and remote-tracking refs differ, or because equal receipt heads differ from ready/pre-task head; retain command-level fail-before-intent tests.",
            "closure_evidence": "The repaired table adds cleanup-unsynchronized-current-refs and cleanup-receipt-ready-tuple cases. Focused pending/delayed/immediate tests passed 3/3, the complete suite passed 42/42, quick validation passed, no Python cache exists, and refreshed external hashes are git_flow.py=F3105168168EE51F498845D419A87C79ACF73F327600EA15C395F5AD8CC998A5, test_git_flow.py=7752A0151EFF1468D70D2FE064BC2A80090FD9C38843711B0CC6BC351247633C, FLOW-SCHEMA.md=3E3E16F540FCE3D4CCDB1428C46BDE54F2E92BE4FFE7EB5F9A579EE5FF2AA9C9. Fresh independent A2 at 2026-09-01 21:22:58+08:00 proved each candidate uniquely fails without its corresponding production predicate, preserved delayed acceptance and exact recovery matching, and closed the finding with no same-family residual.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/rc09_a0",
        "independence": "Fresh independent read-only A2 reviewer. Did not implement the original repair or the A1 test repair and made no file, Git, index, ref, coordinator, permission, test, or external-state mutation.",
        "scope": "Closure of current A1 finding F-A1-CLEANUP-PENDING-NEGATIVE-COVERAGE at git-sha1:8d53c032834832e28f72e4a7ee8590dc417e65fc: exact two-case test repair delta in test_git_flow.py, cleanup pending-state provenance and synchronization validation, adjacent command preflight and recovery matching, retained command-level negatives, provided focused/full/quick-validation evidence, and current external-file freshness.",
        "reviewed_at": "2026-09-01 21:22:58+08:00",
        "evidence": "Removing only the two new candidate blocks in memory reproduced the A1-reviewed pre-repair test hash exactly. cleanup-unsynchronized-current-refs preserves task_head as the sole ref movement but is accepted if and only if the new integration/remote synchronization predicate is removed. cleanup-receipt-ready-tuple keeps receipt local_head==remote_head across retained/pre/target task snapshots but is accepted if and only if the receipt-to-ready/pre-task provenance predicate is removed. Existing command-level moved-head, current-ref divergence, non-ancestor, and delayed-acceptance regressions remain. Command preflight still completes every safety check before intent; pending validation and recovery retain exact snapshots and topology. Reviewed evidence is focused 3/3, complete 42/42, quick validation success, exact final hashes, and no Python cache.",
        "reviewed_state_id": "git-sha1:8d53c032834832e28f72e4a7ee8590dc417e65fc",
        "parent_disposition": "complete",
        "closes": ["F-A1-CLEANUP-PENDING-NEGATIVE-COVERAGE"],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-DELAYED-CLEANUP-CONTRACT-OWNER",
          "F-A0-DELAYED-CLEANUP-TRACE-CYCLE",
          "F-A0-DELAYED-CLEANUP-PUSH-CYCLE"
        ],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-09-01 20:37:11+08:00 bound approval digest FBCD771F527D7652827A05CD3006C17C2E29767361349170BCF5896B549DF0FF and confirmed three MEDIUM contract gaps. This revision adds authoritative FLOW-SCHEMA.md to external scope and replaces self-referential completion/push validations with activation and precommit-readiness criteria; fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-A0-R2-FLOW-SCHEMA-AUTHORIZATION"],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-09-01 20:41:44+08:00 bound approval digest E02358485521EEA060D7DF6CE01B2E8AC8968F12B16068BC5CB35A1CE8FF28B7 and found that scope already declared FLOW-SCHEMA.md but four authorization clauses still said two files or implementation/test only. This revision consistently names all three external files; fresh A0 is required."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V2",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-09-01 21:08:30+08:00",
        "evidence": "The initial 6/6 focused command route passed before A1, but F-A1-CLEANUP-PENDING-NEGATIVE-COVERAGE required two additional durable-validator negatives. The final V2 result binds the repaired test surface.",
        "state_id": null
      },
      {
        "validation_id": "V3",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-09-01 21:08:30+08:00",
        "evidence": "The initial complete suite passed 42/42 in 374.323s before the A1 test-only repair. The final V3 result is the full rerun after both pending-validator negatives were added.",
        "state_id": null
      },
      {
        "validation_id": "V4",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-09-01 21:08:30+08:00",
        "evidence": "Initial quick validation passed at pre-A1 test hash F8CD1126C0498AF19A500F40202F233F280B97746EAF02168CB05AAE5CAE5752. The final V4 result refreshes validation and hashes after the required test repair.",
        "state_id": null
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-09-01 20:38:53+08:00",
        "summary": "Added the authoritative FLOW-SCHEMA cleanup contract to external scope and removed self-referential trace and post-commit push requirements from completion-bound validations after A0 findings.",
        "previous_approval_sha256": "FBCD771F527D7652827A05CD3006C17C2E29767361349170BCF5896B549DF0FF"
      },
      {
        "at": "2026-09-01 20:42:14+08:00",
        "summary": "Aligned lifecycle, allowed, reapproval, and persistence wording with the already declared three-file external scope including FLOW-SCHEMA.md.",
        "previous_approval_sha256": "E02358485521EEA060D7DF6CE01B2E8AC8968F12B16068BC5CB35A1CE8FF28B7"
      }
    ],
    "final_summary": "Repaired harness-git-flow delayed cleanup so an exact pushed task may be cleaned after later synchronized fast-forward descendants, while retaining exact task push provenance, current local/remote synchronization, merged ancestry, and every prior identity, cleanliness, artifact, intent, recovery, and ownership safeguard; truth-synced FLOW-SCHEMA and added command plus durable pending-state regression coverage."
  }
}
```

## Context

RC09 已在 `c2b05cb99dd8a0d233107461645b8360fa3ab420` 推送并清理。对 27 个目标任务的精确预检和缓存清理完成后，首个历史任务在 coordinator cleanup 的 intent 前因 `cleanup_ref_drift` 安全拒绝：其有效 push receipt 绑定旧 task head，而当前 `master`/`origin/master` 已被后续合法 FF 推送推进。其余 26 个旧任务 worktree 均为 clean、ignored inventory 为零且仍处于 `pushed`，因此本计划先修复并审计协调器契约，再恢复已单独授权的逐任务清理。
