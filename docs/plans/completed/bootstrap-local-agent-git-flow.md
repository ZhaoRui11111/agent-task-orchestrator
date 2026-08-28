# ExecPlan: bootstrap the local agent Git workflow

This plan introduces the repository-development workflow only. It does not
implement product runtime workspaces or copy project-specific Quant policy into
the orchestrator core.

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-28 11:58:25+08:00",
    "updated_at": "2026-08-28 14:27:39+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "user request on 2026-08-28 to revert uncommitted work and integrate a Git workflow modeled on D:\\quant",
        "at": "2026-08-28 11:58:25+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "user request on 2026-08-28 to integrate the local Git workflow",
        "at": "2026-08-28 11:58:25+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Make task-branch and linked-worktree development the documented maintainer workflow for agent-task-orchestrator, with master reserved as a clean integration checkout, durable harness-git-flow coordination, caller-bound gate receipts, FF-only local integration, separately authorized ordinary push, crash recovery, and ownership-safe cleanup; initialize the local coordinator only after its clean and synchronized Git preconditions are genuinely satisfied.",
    "non_goals": [
      "Do not implement the product WorkspaceBackend, ProjectPolicy, dispatcher, task model, CLI, MCP server, Codex adapter, or any runtime capability.",
      "Do not copy Quant domain rules, Quant validation commands, A0/A1/A2 as runtime task states, or D:\\quant paths into generic repository workflow contracts.",
      "Do not vendor or modify the installed harness-git-flow skill, make public contribution depend on one maintainer's private installation, or create a second coordinator-state writer.",
      "Do not create a task worktree for this one-time bootstrap, modify D:\\quant, commit, push, open a pull request, merge, release, deploy, or destructively clean resources without the separately required authorization."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "The installed harness-git-flow script is the sole coordinator-state writer; repository documentation may describe its contract but must not duplicate mutable implementation state or invent another writer.",
        "source": "harness-git-flow SKILL.md and FLOW-SCHEMA.md; repository single-owner governance"
      },
      {
        "id": "C2",
        "statement": "The canonical development unit is one normalized task id, task/<task-id> branch, .worktrees/<task-id> linked worktree, and one primary Codex thread; subagents for that task share the same worktree.",
        "source": "D:\\quant current local-agent-git-flow contract after abstraction; harness-git-flow contract"
      },
      {
        "id": "C3",
        "statement": "Master remains the integration branch and its root checkout must be clean, remain on master, and receive task material only through coordinator-controlled FF-only integration after exact-head required gates pass.",
        "source": "user-selected master branch; harness-git-flow Git invariants"
      },
      {
        "id": "C4",
        "statement": "Required gate names are frozen at task start by the parent Agent from the repository impact matrix; harness-git-flow stores opaque exact-head receipts and never decides semantic sufficiency or ExecPlan A0/A1/A2 outcomes.",
        "source": "harness-git-flow boundary; docs/reference/validation-policy.md; docs/plans/README.md"
      },
      {
        "id": "C5",
        "statement": "Push remains separately authorized for this repository. A local FF integration or passed gate does not grant push, PR, merge, release, deployment, secret, network, or destructive-cleanup authority.",
        "source": "AGENTS.md authorization boundary; repository governance; user did not authorize push in the current request"
      },
      {
        "id": "C6",
        "statement": "Coordinator initialization occurs only when state is ABSENT, the canonical integration checkout is clean and on master, local master equals origin/master, origin resolves as the configured remote, and the configured canonical .worktrees path is an immediate child of the integration checkout whose existing node, if any, is a real directory; any failed precondition leaves state absent.",
        "source": "harness-git-flow init contract and FLOW-SCHEMA.md"
      },
      {
        "id": "C7",
        "statement": "The workflow is maintainer automation and repository governance, not an implemented product workspace feature or a mandatory dependency for public contributors.",
        "source": "AGENTS.md public contribution boundary; README current capability boundary"
      },
      {
        "id": "C8",
        "statement": "Repository policy must retain the installed coordinator's Tier-2 guarantees: stable OS locking and single-use CAS for every state mutation; persisted intent before Git side effects; atomic canonical publication with exact readback; exact pre-state or target-state recovery only; refusal of corrupt, ambiguous, nonregular, reparse, identity-drift, or inventory-drift state; and cleanup limited to coordinator-owned resources after a verified push receipt.",
        "source": "harness-git-flow SKILL.md and FLOW-SCHEMA.md; harness-exec-plan Tier-2 persistence lens"
      }
    ],
    "authorization": {
      "allowed": [
        "Read D:\\quant workflow documentation and coordinator facts without modifying that repository.",
        "Edit only the declared task-owned governance, navigation, ignore, contribution, and lifecycle-plan paths in D:\\agent-task-orchestrator.",
        "Use the current clean master checkout as a one-time workflow-bootstrap exception without creating a linked worktree.",
        "Run read-only Git and harness-git-flow trace commands and repository documentation validations.",
        "After all C6 prerequisites are genuinely satisfied, invoke harness-git-flow init once to create only D:\\agent-task-orchestrator\\.git\\harness-git-flow coordinator state."
      ],
      "requires_reapproval": [
        "Any local Git commit or push, including the commit and push needed to make master clean and synchronized before coordinator initialization.",
        "Any mutation of D:\\quant or another repository, any network or secret access, or any modification/vendor copy of the installed skill.",
        "Any change to coordinator schema, branch naming, integration branch, remote, worktree root, required transition semantics, or public contribution requirements.",
        "Any cleanup, force operation, reset, stash, automatic rebase, merge commit, pull request, release, deployment, or publication."
      ],
      "prohibited": [
        "Create or use a linked worktree for this bootstrap task before coordinator initialization.",
        "Initialize or hand-edit coordinator state while local master differs from origin/master, the integration checkout is dirty, or state identity is ambiguous.",
        "Describe the repository workflow as a product WorkspaceBackend or claim unvalidated platform/runtime capability.",
        "Copy Quant-specific gates, paths, domain rules, continuous push authorization, or active coordinator task state."
      ],
      "persistence": {
        "required": true,
        "action": "Initialize the local harness-git-flow coordinator state only after a separately authorized commit and push make the integration checkout clean and synchronize master with origin/master.",
        "source": "user request to integrate the Git workflow; harness-git-flow init preconditions"
      }
    },
    "scope": {
      "task_paths": [
        {
          "path": ".gitignore",
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
          "path": "CONTRIBUTING.md",
          "kind": "file"
        },
        {
          "path": "README.md",
          "kind": "file"
        },
        {
          "path": "docs/README.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/contract-ownership.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/local-agent-git-flow.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/proposal/bootstrap-local-agent-git-flow.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/active/bootstrap-local-agent-git-flow.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/completed/bootstrap-local-agent-git-flow.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/evidence/bootstrap-local-agent-git-flow",
          "kind": "directory"
        }
      ],
      "external_paths": [
        "D:\\agent-task-orchestrator\\.git\\harness-git-flow"
      ],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "One authoritative local-agent Git-flow contract and ownership route describe the repository-specific policy while delegating coordinator mechanics to harness-git-flow.",
        "validation_ids": [
          "V1",
          "V2"
        ]
      },
      {
        "id": "M2",
        "outcome": "Agent, human, contributor, architecture, documentation, and ignore entry points consistently route maintainers to task branches/worktrees while preserving public contribution and authorization boundaries.",
        "validation_ids": [
          "V1",
          "V2",
          "V4"
        ]
      },
      {
        "id": "M3",
        "outcome": "The local coordinator is initialized from an exact clean and synchronized master, or remains truthfully blocked with state ABSENT and the exact separately authorized commit/push prerequisite reported.",
        "validation_ids": [
          "V3"
        ]
      },
      {
        "id": "M4",
        "outcome": "The complete candidate has current independent review and repository documentation, scope, capability-truthfulness, and Git-state evidence without modifying another repository or creating a worktree.",
        "validation_ids": [
          "V1",
          "V4",
          "V5"
        ]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "manual",
        "target": "Authority, navigation, and capability truthfulness",
        "criterion": "A fresh review finds exactly one repository-policy owner for local agent Git flow, every root and documentation link resolves to that owner, all summaries agree, and no statement describes product workspace behavior, hosted automation, push authorization, or platform support that has not been implemented and evidenced."
      },
      {
        "id": "V2",
        "type": "manual",
        "target": "Git-flow contract fidelity and Quant abstraction boundary",
        "criterion": "The local contract preserves task/branch/worktree/thread ownership, the sole state writer, stable-lock and single-use-CAS mutation, persisted intent before Git side effects, atomic canonical publication with exact readback, reservation and refresh receipts, exact-head gates, FF-only integration, partial push recovery, exact pre-or-target recover semantics, corrupt/ambiguous/nonregular/reparse/identity-or-inventory-drift refusal, and push-receipt-bound owned cleanup from harness-git-flow, while containing no D:\\quant path, Quant gate name, Quant domain rule, or continuous push authorization."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Coordinator bootstrap and synchronization precondition",
        "criterion": "After separately authorized commit and push, git status is clean on master, local master equals refs/remotes/origin/master, git worktree list contains only the integration checkout, pre-init trace returns state_sha256=ABSENT, init exits 0, and post-init trace reports version=1, generation=0, integration branch=master, remote=origin, canonical integration/worktree-root paths, reservation=null, pending_operation=null, and tasks={}; if commit/push remains unauthorized, state must remain ABSENT and M3 remains incomplete rather than being waived."
      },
      {
        "id": "V4",
        "type": "manual",
        "target": "Public contribution and authorization boundaries",
        "criterion": "CONTRIBUTING and AGENTS make the installed skill optional maintainer automation rather than a public build/test dependency; commit, push, PR, merge, release, deploy, cleanup, network, and secret permissions remain separate; the current bootstrap is the only documented direct-master exception."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Repository candidate integrity",
        "criterion": "Every repository-relative Markdown link resolves to an existing regular file, git diff --check succeeds, the complete staged inventory contains only declared task paths and no local roadmap, runtime state, coordinator state, credential, worktree content, or D:\\quant material, and git worktree list shows no task worktree created by this bootstrap."
      }
    ],
    "risks": [
      {
        "id": "R1",
        "risk": "Local master currently differs from origin/master, and the documentation candidate itself will make the checkout dirty, so coordinator initialization cannot safely occur before a separately authorized task-owned commit and synchronized push."
      },
      {
        "id": "R2",
        "risk": "Copying Quant prose mechanically could import domain-specific gates, continuous push authority, or policy that conflicts with this independent OSS repository."
      },
      {
        "id": "R3",
        "risk": "Duplicating FLOW-SCHEMA details in multiple repository documents could drift from the installed sole writer and create competing authority."
      },
      {
        "id": "R4",
        "risk": "Making public contributors depend on one machine's installed skill would violate the public contribution boundary."
      },
      {
        "id": "R5",
        "risk": "Using the integration checkout for ordinary development after bootstrap would defeat isolation and contaminate coordinator preconditions."
      }
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Create one repository-specific reference that owns policy and links to the installed harness for command/schema mechanics; keep root documents as concise routes and summaries.",
        "rationale": "This mirrors Quant's proven authority layout without copying implementation or maintaining parallel state rules."
      },
      {
        "id": "D2",
        "statement": "Use master, origin, task/<task-id>, and .worktrees/<task-id>; add only /.worktrees/ to source ignore rules while coordinator state remains in the Git common directory.",
        "rationale": "These are the harness defaults and the user-selected integration branch, and they keep runtime/source distributions separate from local development worktrees."
      },
      {
        "id": "D3",
        "statement": "Freeze required gate names per task from the impact matrix rather than copying Quant's exact gate list; require execplan-audit only when the task independently requires an ExecPlan.",
        "rationale": "Gate sufficiency belongs to this repository and evolves as executable validation lands."
      },
      {
        "id": "D4",
        "statement": "Treat the current direct-master edit as a one-time bootstrap exception and do not initialize coordinator state until commit/push authorization makes the exact candidate clean and synchronized.",
        "rationale": "The workflow cannot govern its own first uncommitted installation, and bypassing init preconditions would invalidate the state contract."
      }
    ],
    "milestone_recovery": [
      {
        "id": "M1",
        "recovery": "Keep the plan in proposal or active and remove conflicting copies before proceeding; do not initialize coordinator state against ambiguous authority."
      },
      {
        "id": "M2",
        "recovery": "Retain the task-owned diff on master as the bootstrap candidate, correct only declared paths, and preserve all ignored local content."
      },
      {
        "id": "M3",
        "recovery": "If trace is ABSENT and any documented init precondition fails, perform no init and report the exact prerequisite. Init itself has no pending operation: after an init interruption, fresh trace must show either ABSENT or one valid initialized state, while corrupt or ambiguous state fails closed. Only a later start/refresh/integrate/push/cleanup operation with a verified pending_operation may route to recover."
      },
      {
        "id": "M4",
        "recovery": "Leave the plan active and the candidate uncommitted when review, documentation, inventory, or authorization gates fail; do not create a successor task or worktree."
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
      }
    ],
    "risk_controls": [
      {
        "id": "R1",
        "mitigation": "Record the exact local and remote-tracking heads and keep init as a failed-closed terminal gate until separate commit/push authorization exists.",
        "recovery": "Leave coordinator state ABSENT and request only the missing commit/push authorization."
      },
      {
        "id": "R2",
        "mitigation": "Use D:\\quant only as read-only evidence and independently rewrite the contract around this repository's validation and authorization owners.",
        "recovery": "Remove any Quant-specific condition and rerun authority/capability review."
      },
      {
        "id": "R3",
        "mitigation": "Keep schema/command details in the installed harness and one bounded repository reference; other documents link and summarize only stable policy.",
        "recovery": "Converge duplicate normative prose into the reference owner before activation."
      },
      {
        "id": "R4",
        "mitigation": "Document the skill as optional maintainer automation and retain repository-readable requirements for all contributors.",
        "recovery": "Remove any public install prerequisite and keep manual branch/review contribution paths available."
      },
      {
        "id": "R5",
        "mitigation": "Label this plan as the sole bootstrap exception; after initialization require start-created task worktrees for every new implementation task.",
        "recovery": "Stop direct-master mutation and create the next task only through fresh coordinator trace/start."
      }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "3273011ab1ebc78c25f1d37e4cbac4a359dfaab9",
      "current_material_base": "3273011ab1ebc78c25f1d37e4cbac4a359dfaab9",
      "base_transitions": []
    },
    "milestone_progress": [
      {
        "id": "M1",
        "status": "complete",
        "updated_at": "2026-08-28 12:20:13+08:00"
      },
      {
        "id": "M2",
        "status": "complete",
        "updated_at": "2026-08-28 12:20:13+08:00"
      },
      {
        "id": "M3",
        "status": "complete",
        "updated_at": "2026-08-28 14:26:46+08:00"
      },
      {
        "id": "M4",
        "status": "complete",
        "updated_at": "2026-08-28 12:32:32+08:00"
      }
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Review AGENTS.md, ARCHITECTURE.md, README.md, CONTRIBUTING.md, docs/README.md, the contract inventory, and the authoritative local-agent Git-flow contract; enumerate all repository-relative Markdown links from the tracked and staged inventory with exact-case regular-file checks.",
        "evidence": "Primary agent at 2026-08-28 12:28:50+08:00 on Windows NT 10.0.22631.0/PowerShell 7.6.4/Git 2.53.0; fresh post-repair authority and capability review found docs/reference/local-agent-git-flow.md as the sole semantic owner, all entry points as consistent routes or bounded summaries, no product-runtime implementation claim, and the link checker exited 0 with MARKDOWN_FILES=42, LOCAL_LINKS=199, and INVENTORY_FILES=48. Unrun applicable gates: none.",
        "state_id": "git-sha1:b6edadaa3d3edaad0fa7a469b1af345d0a0e72a1"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Compare docs/reference/local-agent-git-flow.md with the installed harness-git-flow SKILL.md and FLOW-SCHEMA.md, then scan that authoritative repository contract for D:\\quant paths, Quant audit/gate names, terminal-commit policy, and continuous or ongoing push authorization.",
        "evidence": "Primary agent at 2026-08-28 12:28:50+08:00; fresh post-repair comparison confirmed every V2 mechanism including exclusive same-directory temp/fsync/atomic replace/exact readback, refresh pre/target inventory receipts, three no-intent/idempotent paths, and protected-seam path behavior. The executable content assertion exited 0 with CONTRACT_FIDELITY=PASSED, REQUIRED=13, and QUANT_SPECIFIC_TERMS=ABSENT. Unrun applicable gates: none.",
        "state_id": "git-sha1:b6edadaa3d3edaad0fa7a469b1af345d0a0e72a1"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Inspect branch, local and remote-tracking heads, staged/unstaged inventory and worktree topology, then run the installed harness-git-flow trace without invoking init when its preconditions fail.",
        "evidence": "Primary agent at 2026-08-28 14:26:46+08:00; after explicitly authorized commit af19692dd34f6440823589c03324457d3837880c and ordinary push, branch=master, status was clean, local master equaled origin/master, one integration worktree existed, .worktrees was absent, and pre-init trace returned state_sha256=ABSENT. Init exited 0 with generation=0 and state_sha256=sha256:459B9A1E6B083AA4A7A71E3F840DC3FA214E9616E471AC5605F274CE5A24F69C. Post-init trace reported version=1, generation=0, integration branch=master, remote=origin, canonical worktree D:\\agent-task-orchestrator, worktree_root D:\\agent-task-orchestrator\\.worktrees, reservation=null, pending_operation=null, tasks={}, and matching live integration/remote heads af19692dd34f6440823589c03324457d3837880c. Unrun applicable gates: none.",
        "state_id": "git-sha1:b6edadaa3d3edaad0fa7a469b1af345d0a0e72a1"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Manually review AGENTS.md, CONTRIBUTING.md, README.md, and docs/reference/local-agent-git-flow.md for the public-contribution, authorization, and one-time bootstrap boundaries.",
        "evidence": "Primary agent at 2026-08-28 12:28:50+08:00; fresh post-repair review found all four documents still make the installed skill optional maintainer automation, keep durable requirements repository-readable, separate commit/push/PR/merge/release/deploy/cleanup/network/secret authorization, and identify this bootstrap as the only direct-master exception. Unrun applicable gates: none.",
        "state_id": "git-sha1:b6edadaa3d3edaad0fa7a469b1af345d0a0e72a1"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Run exact-case regular-file Markdown link validation, git diff --cached --check, staged name and numstat inventory, ignore-source checks, local-artifact presence checks, harness trace, and git worktree list from D:\\agent-task-orchestrator.",
        "evidence": "Primary agent at 2026-08-28 12:28:50+08:00; fresh post-repair link checker exited 0 with MARKDOWN_FILES=42, LOCAL_LINKS=199, and INVENTORY_FILES=48; candidate check exited 0 with STAGED=9, OUTSIDE=0, MISSING=0, UNSTAGED=0, UNTRACKED=0, UNSAFE=0, REPARSE=0, and ROADMAP_INDEXED=0; coordinator and .worktrees state remain absent and worktree list contains only D:/agent-task-orchestrator on master. Unrun applicable gates: none.",
        "state_id": "git-sha1:b6edadaa3d3edaad0fa7a469b1af345d0a0e72a1"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "independent subagent /root/gitflow_a0_review",
        "independence": "Fresh same-family read-only A0 rerun; prior participation was limited to reporting attempts 1 and 2 findings. The reviewer did not author or disposition the revisions, implement the workflow, or alter files, index, refs, worktrees, permissions, network, coordinator state, or D:\\quant.",
        "scope": "Complete revised schema-v3 bootstrap-local-agent-git-flow proposal; attempts 1 and 2 history and both contract revisions; full approval and execution contracts; repository authority, validation and ownership contracts; harness-exec-plan A0 and Tier-2 persistence requirements; harness-git-flow SKILL.md, FLOW-SCHEMA and authoritative init behavior; current Quant abstraction source; current Git, material-base, scope and coordinator facts; closure of F-A0-001, F-A0-002 and F-A0-003 plus adjacent authorization, recovery and public-contribution boundaries.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-28 12:12:19+08:00",
        "approval_sha256": "9EDC803ABD0D78DE8EBF511D32A8752F8272804B2C405EC1779827961040EAEB",
        "reviewed_material_base": "3273011ab1ebc78c25f1d37e4cbac4a359dfaab9",
        "evidence": "Helper trace completed with errors=[], warnings=[], outside_scope=[], schema_version=3, exact reviewed material base, state_id git-sha1:024cc17d89bb1bbe6ff9f5ad0f0a613e0687a48d, sole untracked proposal task-owned, and attempts 1 and 2 correctly reopened. Independent canonical serialization produced 11611 UTF-8 bytes and SHA-256 9EDC803ABD0D78DE8EBF511D32A8752F8272804B2C405EC1779827961040EAEB. Current Git and coordinator facts, corrected init preconditions, bounded Tier-2 guarantees, implementation/persistence versus commit/push authorization, Quant abstraction, public contribution, milestones, validations, risks and recovery are coherent. No current finding remains.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "independent subagent /root/gitflow_a0_review",
        "independence": "Fresh read-only A1 reviewer; did not implement or stage the candidate and made no file, index, ref, worktree, coordinator, network, permission, or D:\\quant change.",
        "scope": "Complete active schema-v3 ExecPlan; one current helper trace; all nine staged paths and the full material diff relative to 3273011ab1ebc78c25f1d37e4cbac4a359dfaab9; V1-V5 results; repository authority, ownership and validation contracts; installed harness-git-flow SKILL.md, FLOW-SCHEMA.md and directly adjacent path/publication behavior; authorization, recovery, ignored-roadmap, worktree and external-project boundaries.",
        "reviewed_at": "2026-08-28 12:25:38+08:00",
        "evidence": "The single current trace returned errors=[], warnings=[], outside_scope=[], a0_ready=true and exact state git-sha1:2cf9ec4b9354eb061140cdebc6d5d79baf242a84. The candidate contained exactly nine staged task-owned paths, no unstaged or untracked path, and passed git diff --cached --check. The ignored .local roadmap remained present and ignored; .pnpm-store, .worktrees and coordinator state remained absent; only the master integration checkout existed; no D:\\quant material or Quant-specific term was staged. V3 correctly remained failed. Independent contract comparison found the two confirmed in-scope findings recorded below; remaining authorization, contribution, runtime non-claim, ownership and inventory boundaries were coherent.",
        "reviewed_state_id": "git-sha1:2cf9ec4b9354eb061140cdebc6d5d79baf242a84",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-A1-001",
            "severity": "MEDIUM",
            "summary": "docs/reference/local-agent-git-flow.md described one unconditional persisted-intent sequence, omitted canonical-byte exact readback and refresh pre/target dirty-inventory receipts, and omitted the safe no-intent retry paths for same-base refresh, same-head integrate, and already-target push.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Expanded the authoritative Tier-2 section to require same-directory exclusive temp publication, fsync, atomic replace, exact canonical-byte readback, refresh inventory receipts, exact recovery observations, and the three no-intent/idempotent paths with their ordinary retry behavior.",
            "closure_evidence": "The repaired state/concurrency/recovery section in docs/reference/local-agent-git-flow.md now matches FLOW-SCHEMA.md lines 85-97; fresh V1, V2 and V5 evidence and independent A2 are required against the repaired material state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-002",
            "severity": "MEDIUM",
            "summary": "docs/reference/local-agent-git-flow.md overclaimed that every symlink and wrong-case alias is rejected instead of distinguishing canonical same-identity aliases from protected nonregular/reparse seams.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Narrowed the path contract to canonical exact resource identity, explicitly allowed same-identity spelling or case aliases, and limited nonregular/reparse and handle-identity refusal claims to protected coordinator, namespace, worktree, and inventoried-file seams.",
            "closure_evidence": "The repaired topology/path paragraph now matches the installed canonical-path, same-path, real-directory, regular-file, and handle-identity behavior; fresh V1, V2 and V5 evidence and independent A2 are required against the repaired material state.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "independent subagent /root/gitflow_a0_review",
        "independence": "Fresh read-only A2 reviewer; did not implement the repairs, alter the approval or execution contracts, or modify files, index, refs, worktrees, coordinator state, permissions, network, or D:\\quant.",
        "scope": "Current active schema-v3 ExecPlan and single current trace; A1 findings F-A1-001 and F-A1-002 with parent dispositions; exact repair delta for docs/reference/local-agent-git-flow.md; complete nine-path staged candidate; fresh V1-V5 evidence; installed harness-git-flow SKILL.md, FLOW-SCHEMA.md and directly adjacent canonical-path, node-class, handle-identity, state-publication, refresh, integrate and push seams; authorization, ignored-roadmap, worktree and coordinator boundaries.",
        "reviewed_at": "2026-08-28 12:32:32+08:00",
        "evidence": "Current trace returned errors=[], warnings=[], outside_scope=[], a0_ready=true, closure_required=true, and exact state git-sha1:b6edadaa3d3edaad0fa7a469b1af345d0a0e72a1. F-A1-001 is closed by exact publication/readback, refresh inventory receipts, and all three no-intent/idempotent retry paths. F-A1-002 is closed by canonical same-identity alias semantics and bounded protected-seam node/reparse/handle-identity checks. Fresh V1, V2, V4 and V5 bind the reviewed state; V2 reports CONTRACT_FIDELITY=PASSED, V5 reports nine task-owned paths with zero outside, unstaged, untracked, unsafe, reparse or indexed-roadmap material, and cached diff check passes. Coordinator and task worktrees remain absent, the ignored roadmap remains preserved, D:\\quant remains untouched, and the deliberately failed V3 authorization gate is not a residual defect.",
        "reviewed_state_id": "git-sha1:b6edadaa3d3edaad0fa7a469b1af345d0a0e72a1",
        "parent_disposition": "complete",
        "closes": [
          "F-A1-001",
          "F-A1-002"
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
          "F-A0-001",
          "F-A0-002"
        ],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-08-28 12:06:43+08:00 confirmed two MEDIUM approval gaps under digest 1032F21E7803DE92304F219F4BCDC58FB670353C71F0F063F331FFA3A82FE154: C6 overstated init namespace preconditions, and V2/M3 did not fully bind the Tier-2 intent/publication/recovery boundary. The approval contract and recovery text were revised and require fresh A0."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-003"
        ],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-08-28 12:10:04+08:00 closed the Tier-2 gap but found one LOW fact drift under digest 80F841EE639A32DA1DFB989519B83C2E3ED4646CBAEECAC2C69462781760DAC1: C6 incorrectly required .worktrees to exist as a real directory before init, while the authoritative harness permits an absent path and validates it if present. C6 was corrected and requires fresh A0."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V1",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-28 12:27:13+08:00",
        "evidence": "The initial authority/capability and link result passed at git-sha1:2cf9ec4b9354eb061140cdebc6d5d79baf242a84, then A1-required contract repairs changed the material state and required fresh evidence.",
        "state_id": "git-sha1:2cf9ec4b9354eb061140cdebc6d5d79baf242a84"
      },
      {
        "validation_id": "V2",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-28 12:27:13+08:00",
        "evidence": "The initial fidelity result at git-sha1:2cf9ec4b9354eb061140cdebc6d5d79baf242a84 was superseded because A1 found missing Tier-2 no-intent, exact-readback, inventory-receipt, and protected-seam precision.",
        "state_id": "git-sha1:2cf9ec4b9354eb061140cdebc6d5d79baf242a84"
      },
      {
        "validation_id": "V3",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-08-28 12:20:13+08:00",
        "evidence": "Coordinator bootstrap deterministically remained blocked and state ABSENT because local master differed from origin/master, the candidate was staged, and commit/push lacked separate authorization.",
        "state_id": "git-sha1:2cf9ec4b9354eb061140cdebc6d5d79baf242a84"
      },
      {
        "validation_id": "V3",
        "attempt": 2,
        "classification": "deterministic_failure",
        "at": "2026-08-28 12:28:50+08:00",
        "evidence": "The repaired material candidate still correctly left coordinator state ABSENT because master remained dirty and unsynchronized and commit/push had not yet received the separately required authorization.",
        "state_id": "git-sha1:b6edadaa3d3edaad0fa7a469b1af345d0a0e72a1"
      },
      {
        "validation_id": "V4",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-28 12:27:13+08:00",
        "evidence": "The initial public-contribution and authorization review passed at git-sha1:2cf9ec4b9354eb061140cdebc6d5d79baf242a84, then material contract repairs required fresh state-bound evidence even though this boundary was unchanged.",
        "state_id": "git-sha1:2cf9ec4b9354eb061140cdebc6d5d79baf242a84"
      },
      {
        "validation_id": "V5",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-28 12:27:13+08:00",
        "evidence": "The initial candidate-integrity result passed at git-sha1:2cf9ec4b9354eb061140cdebc6d5d79baf242a84, then the A1 repair changed staged bytes and required a fresh complete inventory check.",
        "state_id": "git-sha1:2cf9ec4b9354eb061140cdebc6d5d79baf242a84"
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-08-28 12:10:00+08:00",
        "summary": "Aligned coordinator init preconditions with the authoritative harness and added explicit Tier-2 lock/CAS/intent/atomic-publication/exact-recovery/refusal acceptance coverage.",
        "previous_approval_sha256": "1032F21E7803DE92304F219F4BCDC58FB670353C71F0F063F331FFA3A82FE154"
      },
      {
        "at": "2026-08-28 12:12:00+08:00",
        "summary": "Corrected the init path precondition so an absent .worktrees path is allowed and an existing node must be a real directory.",
        "previous_approval_sha256": "80F841EE639A32DA1DFB989519B83C2E3ED4646CBAEECAC2C69462781760DAC1"
      }
    ],
    "final_summary": "Repository-local maintainer Git-flow governance is current, the reviewed nine-path bootstrap candidate is committed and pushed, and coordinator version 1 generation 0 is initialized on synchronized master with no task, reservation, pending operation, or linked task worktree."
  }
}
```

## Context

The failed EP-00B working state was explicitly reverted before this proposal.
At proposal creation the repository baseline was clean at local master `3273011`, while
`origin/master=dfb4fd3`; the ignored local roadmap remains present and the
failed task's `.pnpm-store` was removed. The authorized bootstrap commit was
pushed and `harness-git-flow init` created the verified empty coordinator state;
Quant remained read-only reference evidence only.
