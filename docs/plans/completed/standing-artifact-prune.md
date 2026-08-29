# ExecPlan：固化受限 artifact prune 授权与测试残留门禁

本计划只改变 `agent-task-orchestrator` 仓库的 maintainer Git-flow 授权和测试工具链；不改变产品 runtime、全局 skill 或任何外部仓库。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-29 17:49:00+08:00",
    "updated_at": "2026-08-29 18:53:26+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "User selected options 1A/2A and explicitly instructed the primary thread to execute the aligned repository-only scheme",
        "at": "2026-08-29 17:46:00+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "The current implementation instruction plus the repository Git-flow contract authorize the task commit, FF-only integration, and standing ordinary origin/master push",
        "at": "2026-08-29 17:46:00+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Grant this repository's coordinator a narrow, revocable standing authorization to run manifest-bound prune-artifacts, including removal of nonempty .task-artifacts scratch, without a repeated prompt only after every frozen safety condition passes; keep worktree/branch cleanup separately authorized; and add an observation-only Node test gate that detects terminal artifact-tree drift for a quiescent test process while allowing failed commands to retain diagnostic scratch for the final explicit coordinator prune.",
    "non_goals": [
      "Do not change the global harness-git-flow skill, its schema-v1 manifest format, coordinator state implementation, or another repository including D:\\quant.",
      "Do not grant or run coordinator cleanup, arbitrary recursive deletion, caller-selected path deletion, force operations, pull requests, release, deployment, secret access, or unrelated network access.",
      "Do not change the product Domain Core, SQLite persistence semantics, application service, product CLI, dispatcher, adapter, scheduler, MCP, or runtime authorization model.",
      "Do not make failed tests delete diagnostic scratch automatically or treat test success as permission for coordinator prune."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "docs/reference/local-agent-git-flow.md remains the sole normative owner of repository coordinator lifecycle and standing prune conditions; AGENTS.md and repository-governance.md only route and summarize that owner.",
        "source": "AGENTS.md authority order; docs/reference/repository-governance.md single-owner rule"
      },
      {
        "id": "C2",
        "statement": "Standing prune applies only to the exact schema-v1 task-frozen .task-artifacts root, after a task-result commit and before passed gates, when coordinator validation proves start-time absence, ignore policy, zero tracked overlap, exact repository/worktree identity, containment, unchanged task head and manifest blob, and a complete no-follow inventory. A failed pre-delete predicate refuses deletion and produces no receipt. After deletion starts, the coordinator may unlink an inventoried symlink/reparse alias without traversing its target, then remove regular files and real directories bottom-up; permission failure, identity drift, concurrency, or interruption may leave a truthful partial namespace contraction with no receipt. No receipt never implies rollback or byte preservation. A fresh retry of only the same frozen-root command re-inventories the remaining exclusive namespace, and success exists only after every root is absent and the head/blob-bound receipt is published.",
        "source": "User-selected option 1A; harness-git-flow SKILL.md and FLOW-SCHEMA.md; current local-agent Git-flow contract"
      },
      {
        "id": "C3",
        "statement": "A newer user instruction may revoke or narrow standing prune; the grant never implies coordinator cleanup, and cleanup remains a separate post-push action requiring separate current authorization and an ownership-safe empty inventory.",
        "source": "User-selected options 1A/2A; AGENTS.md authorization boundaries"
      },
      {
        "id": "C4",
        "statement": "The package test commands use one repository-owned wrapper that observes rather than deletes: it snapshots the root identity and recursively inventoried members before the Node test process, propagates test failure without a post-success cleanliness claim, and on test success fails unless the terminal snapshot exactly equals the baseline.",
        "source": "Aligned test-residue scheme and docs/reference/toolchain-contract.md"
      },
      {
        "id": "C5",
        "statement": "The test wrapper is an observation-only hygiene check, not a security receipt or deletion primitive. It rejects a symlink, junction, reparse, nonregular, identity-drifted, or inventory-drifted node that is present during an observation and deletes nothing. Public Node path APIs do not provide this runner with the coordinator's identity-bound no-follow Windows handles, so the result assumes no concurrent or surviving process replaces the observed tree; such a race is outside the wrapper guarantee and never weakens the coordinator's independent prune validation. Test-only fixtures remain creator-owned beneath .task-artifacts.",
        "source": "A1 F-A1-001; aligned no-delete hygiene boundary; harness-git-flow FLOW-SCHEMA coordinator handle contract"
      },
      {
        "id": "C6",
        "statement": "All development occurs only in coordinator-owned task/standing-artifact-prune at .worktrees/standing-artifact-prune; coordinator state uses fresh CAS, reservation precedes final review, receipts bind the exact task head, integration is FF-only, and push is ordinary non-force.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md; coordinator start receipt"
      },
      {
        "id": "C7",
        "statement": "Fresh independent A0 is required before activation, fresh independent A1 is required for the stable material diff, and each confirmed in-scope HIGH or MEDIUM repair requires fresh independent A2.",
        "source": "docs/plans/README.md; harness-exec-plan audit contracts"
      }
    ],
    "authorization": {
      "allowed": [
        "Read and edit only the declared task-owned paths inside the canonical task worktree.",
        "Run local targeted and full offline validation without secrets, external-project mutation, or dependency repair.",
        "Use independent read-only reviewers for A0, A1, and any required A2.",
        "Use harness-git-flow as sole coordinator-state writer; after the result commit invoke its manifest-bound prune-artifacts under the user's current explicit authorization and the new repository grant.",
        "Stage only task-owned paths, create one terminal task commit, record real exact-head gates, transition ready, integrate FF-only, and invoke the already standing-authorized ordinary non-force push to origin/master."
      ],
      "requires_reapproval": [
        "Any broader disposable root, manifest/schema change, caller-selected deletion, automatic test cleanup, coordinator cleanup, global skill change, external repository change, product runtime change, dependency addition, or weaker safety predicate.",
        "Any force/rebase/stash/reset/clean, pull request, release, deployment, secret access, arbitrary network use, or action outside the declared path and persistence envelope."
      ],
      "prohibited": [
        "Editing implementation files in the integration-only master checkout or hand-writing coordinator state, gate, prune, integration, or push receipts.",
        "Following a symlink/junction/reparse target, deleting an unregistered or caller-selected path, auto-deleting failed-test diagnostics, or treating test success as authorization.",
        "Running coordinator cleanup, force deletion, force push, PR, release, deployment, or any mutation in D:\\quant or the installed harness-git-flow skill."
      ],
      "persistence": {
        "required": true,
        "action": "Create one terminal task commit containing the completed plan, repository-only authorization contract, test wrapper, tests, and evidence; obtain the exact-head prune receipt; record gates; integrate FF-only; and ordinarily push origin/master without running cleanup.",
        "source": "Current user instruction and repository local Git-flow standing push contract"
      }
    },
    "scope": {
      "task_paths": [
        {"path": "AGENTS.md", "kind": "file"},
        {"path": "docs/plans/active/standing-artifact-prune.md", "kind": "file"},
        {"path": "docs/plans/completed/standing-artifact-prune.md", "kind": "file"},
        {"path": "docs/plans/evidence/standing-artifact-prune", "kind": "directory"},
        {"path": "docs/plans/proposal/standing-artifact-prune.md", "kind": "file"},
        {"path": "docs/reference/local-agent-git-flow.md", "kind": "file"},
        {"path": "docs/reference/repository-governance.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "docs/reference/validation-policy.md", "kind": "file"},
        {"path": "package.json", "kind": "file"},
        {"path": "scripts/repo-utils.mjs", "kind": "file"},
        {"path": "scripts/test-runner.mjs", "kind": "file"},
        {"path": "test/artifact-hygiene.test.mjs", "kind": "file"},
        {"path": "test/artifact-policy.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "The schema-v3 plan has a fixed repository-only authorization envelope, exact prune predicates, explicit cleanup exclusion, current base, recovery rules, binary gates, and fresh independent A0 activation evidence.",
        "validation_ids": ["V1"]
      },
      {
        "id": "M2",
        "outcome": "Repository authority grants the narrow revocable standing prune transition without changing the manifest or global coordinator, and tests mechanically reject any permission drift or cleanup inheritance.",
        "validation_ids": ["V2", "V5"]
      },
      {
        "id": "M3",
        "outcome": "Both complete and targeted Node test commands run through one no-delete baseline wrapper; native recursive Node discovery is preserved, a quiescent successful run preserves the terminal artifact baseline, failure may retain diagnostics, and a statically observed unsafe Windows path node is rejected without deletion.",
        "validation_ids": ["V3", "V4", "V6", "V7"]
      },
      {
        "id": "M4",
        "outcome": "Fresh independent A1 and any required A2 close; targeted and full offline validation pass at one material state; the completed plan is ready for one terminal commit, explicit prune receipt, exact-head gates, FF-only integration, and ordinary push while cleanup remains unrun.",
        "validation_ids": ["V1", "V2", "V3", "V4", "V5", "V6", "V7"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "ExecPlan lifecycle, exact scope, independent reviews, validation freshness, and terminal persistence",
        "criterion": "exec_plan.py trace exits 0 with schema v3, no error, warning, outside-scope path, stale audit, failed validation, or completion blocker; A0/A1 and required A2 are fresh and independent; all milestones and results are terminal before archival."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Repository standing prune authorization and cleanup separation",
        "criterion": "Targeted artifact-policy tests and manual authority review prove one normative owner and the exact revocable manifest-bound prune grant: every pre-delete predicate, safe nonempty scratch, no-follow unlink of inventoried in-root aliases without target traversal, truthful partial contraction with no receipt on a mid-prune stop, idempotent same-command retry to root absence and a head/blob-bound receipt, and no grant for coordinator cleanup, global skill changes, arbitrary path deletion, alias-target deletion, or another repository."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Successful-test artifact baseline preservation and failed-test diagnostic retention",
        "criterion": "Targeted artifact-hygiene tests exit 0 and prove absent and nonempty safe baselines are unchanged after success, a new/replaced/deleted member makes an otherwise successful run fail without deletion, and a failing child test returns failure while retaining its diagnostic member."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Single package-script and implementation owner",
        "criterion": "Configuration tests exit 0 and prove both test and test:persistence route through scripts/test-runner.mjs while scripts/repo-utils.mjs remains the sole package-script registry and .task-artifacts path owner."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Documentation links, owner uniqueness, capability truthfulness, and authorization boundaries",
        "criterion": "pnpm docs:check and git diff --check exit 0; manual review finds zero broken exact-case link, conflicting owner, runtime overclaim, cleanup inheritance, global/external scope leak, or historical evidence rewrite."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Complete offline regression and terminal artifact observation",
        "criterion": "A frozen task-local install followed by pnpm verify:offline exits 0 with every current route passing, no dependency repair or network use, the successful test wrapper reporting an unchanged baseline, and no new .task-artifacts member."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Windows path and reparse fail-closed behavior",
        "criterion": "On the current Windows host, targeted tests exit 0 and prove the observation-only wrapper rejects a root or descendant junction/symlink that is statically present without deleting it, explicitly makes no concurrent path-replacement guarantee, and preserves native recursive Node test discovery; separately, repository authority and existing coordinator contract evidence prove prune may unlink only an inventoried in-root alias without traversing or deleting its target, and existing creator-owned cleanup path-security regressions remain passing."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "Standing prune wording could be interpreted as general destructive cleanup or an authority inherited by other repositories."},
      {"id": "R2", "risk": "A successful test could leak a unique generation or replace an existing diagnostic member while a name-only check reports a clean result."},
      {"id": "R3", "risk": "A symlink, junction, reparse, or concurrent identity swap could make a path-based observer inspect an unintended namespace, or ambiguous wording could incorrectly promote that observer to the coordinator's handle-bound no-follow security level."},
      {"id": "R4", "risk": "A wrapper could hide the child test exit status, delete failed diagnostics, or diverge between complete and targeted test scripts."},
      {"id": "R5", "risk": "Coordinator or ExecPlan receipts could become stale between review, commit, prune, gates, integration, and push."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Encode authorization only in repository prose and contract tests; leave .codex/harness-git-flow.json at schema v1 with exactly disposable_roots=[\".task-artifacts\"].",
        "rationale": "The manifest selects mechanics, while current user and repository policy own authorization; mixing them would silently change the global coordinator contract."
      },
      {
        "id": "D2",
        "statement": "Use a single observation-only Node test wrapper that captures root identity plus recursive member metadata, runs native node --test discovery without a shell, checks baseline equality only after child success, and never deletes artifacts or publishes a security/prune receipt.",
        "rationale": "For a quiescent test process, terminal baseline equality detects retained additions, replacements, or removals while allowing pre-existing failed diagnostics to remain; coordinator prune remains the sole handle-bound deletion and terminal-absence owner."
      },
      {
        "id": "D3",
        "statement": "Keep explicit coordinator prune as the only terminal task-root contraction and keep coordinator cleanup separately authorized after verified push.",
        "rationale": "This separates bounded scratch disposal from branch/worktree lifecycle deletion and preserves observable partial success."
      }
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep the plan in proposal until fresh A0 is complete; if approval boundaries change, revise the contract and rerun A0."},
      {"id": "M2", "recovery": "Revert only task-owned prose/test deltas in the task worktree; never change coordinator state or manifest to make an authorization test pass."},
      {"id": "M3", "recovery": "A failed child test or hygiene assertion leaves diagnostic scratch untouched; persist evidence, repair in the task worktree, and defer exact-root deletion to final coordinator prune."},
      {"id": "M4", "recovery": "A failed gate leaves the reserved task editable. A pre-delete prune refusal changes no root; a mid-prune stop may leave partial contraction with no receipt and must be preserved, followed by fresh trace and an idempotent retry of only the same frozen-root prune command. A prune/gate/head change requires fresh receipts; failed push remains merged_local for ordinary retry and cleanup stays unrun."}
    ],
    "validation_bindings": [
      {"id": "V1", "state_binding": "material"},
      {"id": "V2", "state_binding": "material"},
      {"id": "V3", "state_binding": "material"},
      {"id": "V4", "state_binding": "material"},
      {"id": "V5", "state_binding": "material"},
      {"id": "V6", "state_binding": "material"},
      {"id": "V7", "state_binding": "material"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Name the exact repository, exact command, exact frozen root and every prerequisite; test explicit exclusions and revocation priority.", "recovery": "Fail closed on conflict or newer narrowing instruction; require fresh user authorization for any broader action."},
      {"id": "R2", "mitigation": "Compare direct-child node class and stable identity as well as names, and treat addition, removal, or replacement as failure.", "recovery": "Return a failed validation without deletion; preserve the observed tree for coordinator prune or human diagnosis."},
      {"id": "R3", "mitigation": "The wrapper rejects a static reparse/nonregular observation, compares terminal metadata, deletes nothing, and explicitly assumes no concurrent or surviving tree mutator. It is not a security receipt. Coordinator prune separately uses frozen inventory and anchored handles to unlink an in-root alias without following the target.", "recovery": "Any wrapper error or detected drift fails the test command and preserves the observed namespace for diagnosis. Suspected concurrent replacement invalidates wrapper evidence and requires quiescent rerun or human inspection. Coordinator pre-delete ambiguity refuses deletion; a mid-prune stop preserves actual partial contraction and retries only the same frozen-root command after fresh trace. Never traverse or delete an alias target."},
      {"id": "R4", "mitigation": "Spawn process.execPath directly, propagate nonzero/abnormal status, run post-check only on success, and route both package scripts through the same owner.", "recovery": "Keep child output and residue, return nonzero, and repair only task-owned wrapper/tests."},
      {"id": "R5", "mitigation": "Use fresh coordinator trace/CAS, reserve before final review, bind A1/validation/prune/gates to the exact terminal head, and use FF-only integrate plus ordinary push.", "recovery": "Recover a durable pending intent first. Because prune publishes no intent, a partial prune has no receipt and is resumed only by re-running the same frozen-root prune command with a fresh token; other idempotent transitions follow their documented retry rules."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "a2a898e13b5231a1dd061ad1a6bb77df146383ce",
      "current_material_base": "a2a898e13b5231a1dd061ad1a6bb77df146383ce",
      "base_transitions": []
    },
    "milestone_progress": [
      {
        "id": "M1",
        "status": "complete",
        "updated_at": "2026-08-29 18:02:00+08:00"
      },
      {
        "id": "M2",
        "status": "complete",
        "updated_at": "2026-08-29 18:19:00+08:00"
      },
      {
        "id": "M3",
        "status": "complete",
        "updated_at": "2026-08-29 18:39:07+08:00"
      },
      {
        "id": "M4",
        "status": "complete",
        "updated_at": "2026-08-29 18:53:26+08:00"
      }
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Run exec_plan.py trace against the completed schema-v3 plan after parent disposition of fresh A2 and inspect its exact scope, state bindings, audit closure, milestone, validation, and final-summary gates.",
        "evidence": "The completed-plan trace exits 0 with errors=[], warnings=[], outside_scope=[], completion_ready=true, current approval digest 84CFB59584259F6E797665F6EBD3086CBDE884FBC478107598E7E08A0FA3546F, and all material evidence plus A2 bound to git-sha1:8d7663cf66632db1277ff6b992e43f6d7d87e766.",
        "state_id": "git-sha1:8d7663cf66632db1277ff6b992e43f6d7d87e766"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Run the targeted artifact-policy suite, inspect the exact unchanged schema-v1 manifest, and manually compare AGENTS, repository-governance, and the authoritative local Git-flow contract with FLOW-SCHEMA prune semantics.",
        "evidence": "The final 22-test targeted route passed. The exact root remains only .task-artifacts; prose/tests bind the pathless revocable grant to task-frozen head/blob/ignore/tracked/inventory checks, safe nonempty scratch, anchored no-follow in-root alias unlink, truthful partial contraction and same-command retry, while excluding alias targets, caller paths, coordinator cleanup, global skill changes, D:\\quant, and adjacent actions.",
        "state_id": "git-sha1:8d7663cf66632db1277ff6b992e43f6d7d87e766"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Run node --test test/artifact-hygiene.test.mjs directly with bundled Node 24.19.0, then run both package test scripts through the wrapper.",
        "evidence": "All 8 targeted hygiene tests passed. Absent and nonempty baselines stayed equal; add/remove/replace caused a success-path hygiene failure without deleting bytes; a failing child retained its diagnostic; empty selectors discovered a nested test; and an unowned inherited NODE_TEST_CONTEXT made direct invocation fail nonzero. pnpm test passed 111/111 and pnpm test:persistence passed 56/56, each reporting artifactHygiene=passed and baselineEntries=terminalEntries=0.",
        "state_id": "git-sha1:8d7663cf66632db1277ff6b992e43f6d7d87e766"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Run configuration tests and repository lint against package.json and scripts/repo-utils.mjs exact command inventories.",
        "evidence": "Configuration tests passed and lint reported 115 files/13 production sources. Both test and test:persistence resolve only through scripts/test-runner.mjs; repo-utils remains the sole package-script registry and .task-artifacts path owner. The empty selector reaches native recursive discovery; only a Node context paired with the wrapper-owned child marker suppresses the discovered runner entry, while an unowned context fails closed.",
        "state_id": "git-sha1:8d7663cf66632db1277ff6b992e43f6d7d87e766"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Run node scripts/docs-check.mjs and git diff --check, then manually review changed authorities and capability claims.",
        "evidence": "Documentation passed with 59 Markdown files, 225 exact-case local links, and zero forbidden finding; diff check passed. Manual review found one workflow owner, two narrow independently revocable grants, no cleanup inheritance, no product-runtime or platform overclaim, no global/external scope leak, and no wrapper security/prune-receipt overclaim.",
        "state_id": "git-sha1:8d7663cf66632db1277ff6b992e43f6d7d87e766"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Seed the ignored task-local store from a verified reparse-free pushed EP-01B cache, run frozen pnpm install offline with zero downloads, then run pnpm verify:offline with npm/pnpm offline configuration and bundled runtime paths.",
        "evidence": "The final full gate passed: lint 115/13, strict typecheck/build, native-discovery Node 111/111 with 0-to-0 artifact baseline, docs 59/225/0, production dependencies 0, package smoke 53 files, real Windows SQLite with survivingGenerationMembers=0, and Codex externalE2E=not_run/supportClaim=false. No dependency repair or network result was used, and .task-artifacts was absent afterward.",
        "state_id": "git-sha1:8d7663cf66632db1277ff6b992e43f6d7d87e766"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Run the Windows hygiene and existing repo-utils path-security tests; separately inspect authoritative coordinator FLOW-SCHEMA and repository authorization prose.",
        "evidence": "Statically present Windows root and descendant junctions were rejected without target mutation; all existing internal/external junction, creator-receipt, generation-swap, quarantine-swap, and member-swap regressions passed. The nested native-discovery regression passed. Contract review denies the wrapper any concurrent replacement guarantee and separately binds coordinator prune to anchored inventoried in-root alias unlink without target traversal.",
        "state_id": "git-sha1:8d7663cf66632db1277ff6b992e43f6d7d87e766"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/standing_prune_a0",
        "independence": "Fresh read-only A0 attempt 3; reviewer did not draft the current approval revision, implement repairs, or modify files, Git, coordinator, permissions, or external state.",
        "scope": "Observation-only test hygiene contract, quiescent-process assumption, coordinator prune independent safety boundary, A1 F-A1-001/F-A1-002 and A2 routing, task scope and authorization, Tier-2 artifact transition, and current Git/coordinator facts.",
        "reviewed_at": "2026-08-29 18:32:05+08:00",
        "approval_sha256": "84CFB59584259F6E797665F6EBD3086CBDE884FBC478107598E7E08A0FA3546F",
        "reviewed_material_base": "a2a898e13b5231a1dd061ad1a6bb77df146383ce",
        "readiness": "ready_for_activation",
        "parent_disposition": "complete",
        "findings": [],
        "evidence": "Fresh trace returned errors=[], warnings=[], and outside_scope=[] at material state git-sha1:480fbf4a92e65294bd5c95270ea0f8756b9391f7; independent canonical recomputation matched the approval digest. The reviewer confirmed the wrapper is only a no-delete observation for a quiescent test process and makes no handle-bound/no-follow race, security, or prune-receipt claim; coordinator frozen-manifest validation, anchored prune, partial-contraction recovery, and receipt semantics remain independent and unchanged. Both current A1 MEDIUM findings remain routed to repaired material validation and fresh independent A2. Coordinator generation 92 was reserved with pending_operation=null, the exact schema-v1 .task-artifacts manifest remained frozen, and current authorization did not expand to cleanup, global skill changes, D:\\quant, dependencies, arbitrary deletion, force, PR, release, or deployment."
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/standing_prune_a1",
        "independence": "Fresh read-only A1; reviewer did not implement the candidate or modify files, Git/index/refs/worktrees, coordinator, permissions, network, or external state.",
        "scope": "Repository-only standing prune authorization, Node test artifact hygiene wrapper, Tier-2 authorization/receipt/partial-prune recovery boundary, and the complete task diff from base a2a898e13b5231a1dd061ad1a6bb77df146383ce.",
        "reviewed_at": "2026-08-29 18:23:48+08:00",
        "evidence": "Fresh trace reported errors=[], warnings=[], outside_scope=[] and state git-sha1:480fbf4a92e65294bd5c95270ea0f8756b9391f7. Coordinator generation 92 was reserved with pending_operation=null and the unchanged schema-v1 .task-artifacts policy. The reviewer examined every tracked/untracked material path, authorities, plan/evidence, FLOW-SCHEMA, package commands, runner, tests, and existing targeted/full results. Two in-scope MEDIUM gaps were confirmed: the path-based observer could not support the published handle-bound no-follow race guarantee, and test/*.test.mjs narrowed native recursive discovery.",
        "reviewed_state_id": "git-sha1:480fbf4a92e65294bd5c95270ea0f8756b9391f7",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-A1-001",
            "severity": "MEDIUM",
            "summary": "The path-based artifact snapshot cannot guarantee handle-bound no-follow observation under concurrent Windows path replacement.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Narrow the approval/public contract to an observation-only quiescent-process hygiene assertion, remove the false handle-bound/no-follow race guarantee, retain static reparse refusal and no-delete behavior, and keep coordinator prune as the independent anchored security owner; obtain fresh A0 for that contract revision.",
            "closure_evidence": "Fresh A0 approved the narrowed contract. The repaired material state git-sha1:8d7663cf66632db1277ff6b992e43f6d7d87e766 passed targeted and full offline validation, and fresh independent A2 at 2026-08-29 18:53:04+08:00 closed F-A1-001 with no residual finding.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-002",
            "severity": "MEDIUM",
            "summary": "The fixed test/*.test.mjs selector silently narrows native Node recursive test discovery.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Restore node --test default discovery, suppress main execution only when the runner itself is loaded under NODE_TEST_CONTEXT, and add a nested-discovery regression plus full-suite evidence.",
            "closure_evidence": "The final material state restored native discovery, added nested-discovery and unowned-context refusal regressions, passed targeted 22/22, pnpm test 111/111, persistence 56/56, and the full offline gate. Fresh independent A2 at 2026-08-29 18:53:04+08:00 closed F-A1-002 and the earlier same-family F-A2-001 residual.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/standing_prune_a2",
        "independence": "Fresh read-only A2 rerun; reviewer did not implement the repair or modify files, Git, coordinator, permissions, or external state.",
        "scope": "Current A1 F-A1-001 and F-A1-002, prior A2 residual F-A2-001, repair delta, adjacent wrapper/tests/documentation, state-bound targeted and full validation evidence, Windows static reparse behavior, native recursive discovery, observation-only safety boundary, and coordinator anchored prune contract.",
        "reviewed_at": "2026-08-29 18:53:04+08:00",
        "evidence": "Fresh trace returned errors=[], warnings=[], outside_scope=[] at exact state git-sha1:8d7663cf66632db1277ff6b992e43f6d7d87e766. The public contract consistently limits the wrapper to quiescent-process observation and denies concurrent-replacement, security, and prune-receipt guarantees while coordinator anchored prune remains unchanged. Empty selectors preserve native discovery; the wrapper-owned marker suppresses only its discovered runner child; direct invocation with an unowned NODE_TEST_CONTEXT fails nonzero. The reviewer confirmed targeted 22/22, hygiene 8/8, pnpm test 111/111, persistence 56/56, full offline, docs 59/225/0, Windows static reparse negatives, nested discovery, and terminal artifact absence.",
        "reviewed_state_id": "git-sha1:8d7663cf66632db1277ff6b992e43f6d7d87e766",
        "parent_disposition": "complete",
        "closes": ["F-A1-001", "F-A1-002"],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-A0-001", "F-A0-002"],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-08-29 17:56:51+08:00 bound digest 0AE5521FDA78AB142D60B2BB3329ACCA71A7FB7BEA9B4EFD2B7BE8D3FD6D6A51 and confirmed two MEDIUM approval gaps. F-A0-001 corrected the false atomic-failure claim: pre-delete refusal changes nothing, but a mid-prune stop may leave truthful partial contraction with no receipt and must be retried idempotently against the remaining frozen namespace. F-A0-002 separated coordinator no-follow unlink of an inventoried in-root alias from the test wrapper's stricter reparse-observation refusal, while forbidding traversal or deletion of the alias target. The revised approval contract requires fresh A0."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "The ready A0 bound digest D20484941779722A289224441954EFFBCD011C3506A3EB69C5FD7599AD366F19. Fresh independent A1 then proved public Node path APIs cannot support the approved handle-bound no-follow race guarantee for the observation-only wrapper. The contract now truthfully assumes a quiescent test process, denies security/prune receipt meaning, and leaves anchored deletion to coordinator prune; the approval digest changed and requires fresh A0 before repair."
      },
      {
        "audit": "A2",
        "attempt": 1,
        "report_status": "failed",
        "finding_ids": ["F-A2-001"],
        "disposition": "reopened",
        "reason": "Fresh independent A2 at 2026-08-29 18:45:31+08:00 bound git-sha1:7ba8cbdf4335665c4aa11b2dc8d73ccccf1ae911. It closed the root cause of F-A1-001 but found a same-family MEDIUM residual under F-A1-002: any inherited NODE_TEST_CONTEXT made the direct public runner silently exit 0 without tests. The parent confirmed it in scope and material, retained the stable repair/authorization envelope, and required an owner-marked child context, fail-closed direct invocation, regression coverage, refreshed validation, and fresh rerun of A2."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V2",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-29 18:27:00+08:00",
        "evidence": "The authorization tests and review passed before the A1 contract repair, but the material state changed when wrapper claims and adjacent validation wording were narrowed. The final V2 result reruns the complete targeted route at the repaired state.",
        "state_id": "git-sha1:480fbf4a92e65294bd5c95270ea0f8756b9391f7"
      },
      {
        "validation_id": "V3",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-08-29 18:08:00+08:00",
        "evidence": "The initial nested-runner fixtures inherited NODE_TEST_CONTEXT, so Node skipped them and two assertions failed. Removing that marker only for the independent child repaired those fixtures; later A1 work separately restored native discovery and added the final nested regression.",
        "state_id": null
      },
      {
        "validation_id": "V3",
        "attempt": 2,
        "classification": "superseded",
        "at": "2026-08-29 18:27:00+08:00",
        "evidence": "The 6/6 hygiene, 107/107 complete, and 56/56 persistence results passed before A1, but were bound to the fixed-selector implementation rejected by F-A1-002. The final V3 result covers the repaired native discovery state.",
        "state_id": "git-sha1:480fbf4a92e65294bd5c95270ea0f8756b9391f7"
      },
      {
        "validation_id": "V4",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-29 18:27:00+08:00",
        "evidence": "Configuration ownership passed at the pre-A1 state, but the runner's default selector changed under F-A1-002. The final V4 result revalidates both public scripts and native discovery at the repaired state.",
        "state_id": "git-sha1:480fbf4a92e65294bd5c95270ea0f8756b9391f7"
      },
      {
        "validation_id": "V5",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-29 18:27:00+08:00",
        "evidence": "Documentation and diff checks passed before A1, but the public wrapper safety claim required material correction. The final V5 result validates the truthful observation-only wording.",
        "state_id": "git-sha1:480fbf4a92e65294bd5c95270ea0f8756b9391f7"
      },
      {
        "validation_id": "V6",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-08-29 18:12:00+08:00",
        "evidence": "Fallback pnpm attempted denied registry bootstrap before project tests, then invalid --offline placement and a missing child Node PATH prevented two invocations. A verified task-local cache, explicit zero-download frozen offline install, bundled Node PATH, and offline configuration established the later valid route. Discovery recursion and the rejected directory selector were deterministic implementation issues, not environment evidence.",
        "state_id": null
      },
      {
        "validation_id": "V6",
        "attempt": 2,
        "classification": "superseded",
        "at": "2026-08-29 18:27:00+08:00",
        "evidence": "The full offline gate passed at the fixed-selector pre-A1 state. F-A1-001 and F-A1-002 changed the wrapper contract and implementation, so only the final repaired-state full gate is current.",
        "state_id": "git-sha1:480fbf4a92e65294bd5c95270ea0f8756b9391f7"
      },
      {
        "validation_id": "V7",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-29 18:27:00+08:00",
        "evidence": "Static Windows junction and creator-cleanup negatives passed before A1, but the wrapper guarantee was then narrowed and native recursive discovery added. The final V7 result binds both corrected claims at the repaired state.",
        "state_id": "git-sha1:480fbf4a92e65294bd5c95270ea0f8756b9391f7"
      },
      {
        "validation_id": "V2",
        "attempt": 2,
        "classification": "superseded",
        "at": "2026-08-29 18:45:31+08:00",
        "evidence": "The 21-test authorization/path route passed at the first repaired A1 state, but A2 F-A2-001 required a same-family material change and contract regression. The final V2 result is bound to the owner-marked fail-closed repair.",
        "state_id": "git-sha1:7ba8cbdf4335665c4aa11b2dc8d73ccccf1ae911"
      },
      {
        "validation_id": "V3",
        "attempt": 3,
        "classification": "superseded",
        "at": "2026-08-29 18:45:31+08:00",
        "evidence": "The 7-test hygiene, 110/110 complete, and 56/56 persistence results did not cover direct invocation with an inherited unowned NODE_TEST_CONTEXT. The final V3 result includes that negative regression and all affected reruns.",
        "state_id": "git-sha1:7ba8cbdf4335665c4aa11b2dc8d73ccccf1ae911"
      },
      {
        "validation_id": "V4",
        "attempt": 2,
        "classification": "superseded",
        "at": "2026-08-29 18:45:31+08:00",
        "evidence": "The public script owner and native discovery route passed before A2, but the executable entry could still be bypassed by an ambient context. The final V4 result proves owner-marked suppression and fail-closed direct invocation.",
        "state_id": "git-sha1:7ba8cbdf4335665c4aa11b2dc8d73ccccf1ae911"
      },
      {
        "validation_id": "V5",
        "attempt": 2,
        "classification": "superseded",
        "at": "2026-08-29 18:45:31+08:00",
        "evidence": "Documentation passed at the first repair state, but the loader-context ownership and refusal behavior were then added to the public contract. The final V5 result covers that wording and exact links.",
        "state_id": "git-sha1:7ba8cbdf4335665c4aa11b2dc8d73ccccf1ae911"
      },
      {
        "validation_id": "V6",
        "attempt": 3,
        "classification": "superseded",
        "at": "2026-08-29 18:45:31+08:00",
        "evidence": "The 110-test full offline gate passed before the A2 residual repair. The final V6 result reruns the entire offline gate with the owner marker, fail-closed direct context, and 111 discovered tests.",
        "state_id": "git-sha1:7ba8cbdf4335665c4aa11b2dc8d73ccccf1ae911"
      },
      {
        "validation_id": "V7",
        "attempt": 2,
        "classification": "superseded",
        "at": "2026-08-29 18:45:31+08:00",
        "evidence": "Windows static junction and native discovery coverage remained passing, but all material evidence was refreshed after the A2 same-family repair. The final V7 result is bound to that state.",
        "state_id": "git-sha1:7ba8cbdf4335665c4aa11b2dc8d73ccccf1ae911"
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-08-29 18:00:00+08:00",
        "summary": "Corrected prune partial-success recovery and explicitly separated coordinator alias unlink from wrapper reparse refusal after independent A0 findings F-A0-001 and F-A0-002.",
        "previous_approval_sha256": "0AE5521FDA78AB142D60B2BB3329ACCA71A7FB7BEA9B4EFD2B7BE8D3FD6D6A51"
      },
      {
        "at": "2026-08-29 18:27:00+08:00",
        "summary": "Narrowed the test wrapper to an observation-only quiescent-process hygiene assertion after A1 F-A1-001 while preserving coordinator prune's independent handle-bound safety contract.",
        "previous_approval_sha256": "D20484941779722A289224441954EFFBCD011C3506A3EB69C5FD7599AD366F19"
      }
    ],
    "final_summary": "Established the repository-only, revocable standing coordinator prune grant with cleanup kept separate; routed both Node test commands through a no-delete, observation-only artifact baseline wrapper; preserved native recursive discovery; added fail-closed inherited-context and Windows static-reparse coverage; and closed all A1/A2 findings at one fully validated material state."
  }
}
```

## Context

EP-01B 已在 `a2a898e13b5231a1dd061ad1a6bb77df146383ce` 推送。本任务启动时 coordinator state version 2 无 pending operation 或 reservation；随后从该 exact base 启动、冻结现有 schema-v1 `.task-artifacts` manifest，并已取得 exclusive integration reservation。用户明确选择 repository-only standing prune，不把授权写入全局 skill 或 `D:\quant`，并要求继续保持 coordinator cleanup 的单独授权边界。
