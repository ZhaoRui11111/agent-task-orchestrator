# ExecPlan：修复任务产物 generation 的并发生命周期

本计划只修复仓库维护工具在多个 Node 测试进程共享
`.task-artifacts` 根目录时的创建与空根回收竞态。它不改变 coordinator
`prune-artifacts` 的清单、授权、锚定删除或收据语义。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-30 12:53:57+08:00",
    "updated_at": "2026-08-30 14:52:21+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user directive to execute the converged repairs serially through one goal",
        "at": "2026-08-30 12:53:57+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "current user execution directive plus the repository standing task-commit, manifest-prune, FF-only integration, and ordinary origin/master push grants",
        "at": "2026-08-30 12:53:57+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Make creator-owned .task-artifacts generation creation and cleanup deterministic under concurrent Node test processes: each worker removes only its exact receipt-bound generation and never reclaims the shared root, concurrent stable-root creation produces no EEXIST gate failure, a higher-level owner reclaims an empty fixed root only after its workers are quiescent, unsafe or ambiguous path state still fails closed, successful quiescent routes restore the exact artifact baseline, and the existing coordinator prune authorization and security guarantees remain unchanged.",
    "non_goals": [
      "Do not change .codex/harness-git-flow.json, add a disposable root, broaden manifest-bound prune, add caller-selected cleanup paths, or authorize coordinator cleanup.",
      "Do not weaken generation receipt, quarantine, no-follow, reparse, containment, member-inventory, identity-drift, replacement-byte preservation, or failed-diagnostic retention checks.",
      "Do not implement product persistence, runtime cleanup, EP-02, dispatcher, scheduler, adapter, MCP, Project mutation, or any external side effect.",
      "Do not add or update dependencies, use dependency/network repair, modify existing migrations, rewrite completed plans or historical evidence, or mutate another repository.",
      "Do not claim that the path-based test wrapper is a security boundary or that quiescent terminal observation protects against an actively mutating external process."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "scripts/repo-utils.mjs remains the sole package-script and creator-generation path owner; .task-artifacts remains the exact sole ignored coordinator-registered root.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md; .codex/harness-git-flow.json; scripts/repo-utils.mjs"
      },
      {
        "id": "C2",
        "statement": "A creator receipt owns one exact direct-child generation, not the shared root namespace. A worker may create or remove only that generation and must never reclaim the shared root, even when it observes the root as empty.",
        "source": "Observed 269/270 full-test ENOENT at scripts/repo-utils.mjs empty-root inspection; Tier-2 persistence transition lens"
      },
      {
        "id": "C3",
        "statement": "Before and throughout generation mutation, the current root and generation must remain regular, contained, and identity-matched. The exact generation identity is captured immediately after mkdtemp, before any post-issue seam, revalidated coherently with the root, and carried unchanged into receipt publication. Root or generation disappearance, replacement, or identity change during issue is a fail-closed protocol violation that is never retried or silently adopted. Only residue still visible inside the exact frozen .task-artifacts root may later be handled by manifest prune; external, hidden, or location-unknown residue is preserved for explicit human disposition without inferred cleanup authority.",
        "source": "docs/reference/local-agent-git-flow.md repository artifact policy; existing repo-utils identity and replacement tests"
      },
      {
        "id": "C4",
        "statement": "Root creation performs one atomic mkdir attempt, accepts only EEXIST as the expected concurrent stable-root result, and then strictly inspects that existing root before issuing a generation. There is no retry loop; ENOENT, permission, reparse, containment, identity, or other unexpected errors propagate without masking.",
        "source": "Tier-2 lock/stage/CAS/no-follow and failure-propagation requirements"
      },
      {
        "id": "C5",
        "statement": "The public test runner's snapshot comparator remains observation-only. The route separately performs a success-only fixed-root contraction only after its complete native Node test child exits and only when the baseline root was absent and the current root is regular and empty. While any native Node test context is active, every nested consumer, including SQLite feasibility, removes only its exact generation and defers shared-root contraction to that outer runner. Package-smoke and genuinely standalone SQLite invocations use the same fixed-root reclaimer only after their complete local worker/generation boundary is quiescent. This path-based empty-directory contraction makes no guarantee against an actively replacing process and is not coordinator prune.",
        "source": "docs/reference/toolchain-contract.md; docs/reference/local-agent-git-flow.md; scripts/test-runner.mjs"
      },
      {
        "id": "C6",
        "statement": "This is Tier-2 shared-state concurrency work: writer/reader closure, root/generation identity, contained topology, partial failure, retry, terminal absence, and cross-process stress evidence are explicit and independently audited.",
        "source": "harness-exec-plan persistence lens; docs/reference/validation-policy.md"
      },
      {
        "id": "C7",
        "statement": "Fresh independent A0 is required before activation, fresh independent A1 after the stable diff, and every confirmed in-scope HIGH or MEDIUM repair requires fresh independent A2. The implementer cannot act as reviewer.",
        "source": "docs/plans/README.md; harness-exec-plan audit contract"
      },
      {
        "id": "C8",
        "statement": "The task uses only its coordinator-owned branch/worktree, one terminal task commit, explicit manifest prune, exact-head gates, FF-only local integration, and the standing-authorized ordinary origin/master push. Cleanup remains unauthorized.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md; current user serial execution directive"
      }
    ],
    "authorization": {
      "allowed": [
        "Read repository material and modify only declared task-owned paths in the coordinator-owned repair-artifact-concurrency worktree.",
        "Implement generation-only worker cleanup, immediate post-mkdtemp generation identity binding carried into receipt publication, one atomic root mkdir with EEXIST-only stable-root handling, and fixed-path regular-empty-root contraction performed only by the named test-runner after global native-child quiescence or by package-smoke and standalone SQLite after their complete local worker/generation boundary is quiescent. A SQLite invocation nested in any native Node test context must defer root contraction to the outer runner; absence, nonempty state, unsafe identity, and unexpected errors remain no-delete or fail-closed as specified, and none of these routes is coordinator prune.",
        "Create deterministic multi-process fixtures beneath only the task-owned .task-artifacts root and run local offline tests, repeated stress, package smoke, and SQLite feasibility routes.",
        "Use fresh sequential read-only independent reviewers for A0, A1, and any required A2; reviewers may not edit repository or external state.",
        "Create task-owned implementation and terminal commits, invoke the pathless manifest-bound prune after the result commit, record exact-head gates, perform coordinator FF-only local integration, and invoke the repository standing-authorized ordinary origin/master push after all prerequisites remain exact."
      ],
      "requires_reapproval": [
        "Any change to the goal, shared-root ownership model, public task-artifact guarantee, authorization boundary, disposable-root manifest, task-path envelope, external-path set, binary validation criteria, or required gate set.",
        "Any change that deletes or adopts a different regular root identity, suppresses an unsafe-node or unexpected filesystem error, adds unbounded retry, or weakens receipt/member/path identity checks.",
        "Any dependency installation or network action other than the repository standing-authorized ordinary origin/master push, or any secret/account use, PR, release, deployment, cleanup, force, reset, rebase, stash, or cross-repository mutation."
      ],
      "prohibited": [
        "Modify another repository, user/runtime data, dependency stores, migrations, completed plan history, secrets, accounts, external Projects, or coordinator state outside the harness-git-flow commands.",
        "Use arbitrary deletion, caller-selected prune paths, force push, reset, rebase, stash, clean, ACL/ownership changes, coordinator cleanup, PR creation, release, or deployment.",
        "Treat a successful test, approved plan, artifact absence, or creator receipt as authorization for an adjacent filesystem, Git, network, or product action."
      ],
      "persistence": {
        "required": true,
        "action": "task-owned commits culminating in one completed-plan terminal commit, followed by manifest-bound prune, exact-head gate receipts, coordinator FF-only local integration, and the standing-authorized ordinary origin/master push",
        "source": "Current user serial execution directive; AGENTS.md; docs/reference/local-agent-git-flow.md"
      }
    },
    "scope": {
      "task_paths": [
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "docs/plans/proposal/repair-artifact-concurrency.md", "kind": "file"},
        {"path": "docs/plans/active/repair-artifact-concurrency.md", "kind": "file"},
        {"path": "docs/plans/completed/repair-artifact-concurrency.md", "kind": "file"},
        {"path": "docs/plans/evidence/repair-artifact-concurrency", "kind": "directory"},
        {"path": "docs/feasibility/sqlite-windows.md", "kind": "file"},
        {"path": "docs/feasibility/toolchain.md", "kind": "file"},
        {"path": "docs/reference/local-agent-git-flow.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "docs/reference/validation-policy.md", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "scripts/repo-utils.mjs", "kind": "file"},
        {"path": "scripts/sqlite-feasibility.mjs", "kind": "file"},
        {"path": "scripts/test-runner.mjs", "kind": "file"},
        {"path": "test/artifact-concurrency.test.mjs", "kind": "file"},
        {"path": "test/artifact-hygiene.test.mjs", "kind": "file"},
        {"path": "test/artifact-policy.test.mjs", "kind": "file"},
        {"path": "test/fixtures/artifact-concurrency-worker.mjs", "kind": "file"},
        {"path": "test/repo-utils.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "One reviewed approval/execution contract defines the shared-root ownership distinction, benign race outcomes, fail-closed boundaries, authorization, recovery, and exact validation surface without changing coordinator prune semantics.",
        "validation_ids": ["V1", "V5"]
      },
      {
        "id": "M2",
        "outcome": "Workers create and remove only immediately identity-bound, receipt-bound generations under one stable shared root; the outer test runner, package smoke, and standalone SQLite owners alone perform fixed-path empty-root reclamation at globally valid quiescent boundaries, nested Node-test consumers defer to the outer runner, and all receipt, containment, quarantine, inventory, and identity checks remain strict.",
        "validation_ids": ["V2", "V3"]
      },
      {
        "id": "M3",
        "outcome": "Deterministic multi-process regression evidence and existing package/SQLite consumers prove no lost generation, leaked task artifact, hidden unsafe path, or flaky test gate.",
        "validation_ids": ["V2", "V4", "V6", "V7"]
      },
      {
        "id": "M4",
        "outcome": "The complete offline repository gate and fresh independent stable-diff review accept one exact material state, with every required repair closed by the applicable A2 route.",
        "validation_ids": ["V8", "V9"]
      },
      {
        "id": "M5",
        "outcome": "The completed plan, evidence, implementation, tests, and documentation form one task-owned terminal commit ready for manifest prune, exact-head receipts, FF-only integration, and ordinary push.",
        "validation_ids": ["V10"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "manual",
        "target": "Approval, scope, authorization, Tier-2 transition guarantees, recovery, and implementation readiness",
        "criterion": "Fresh independent A0 reports complete and ready_for_activation against the exact approval digest and reviewed material base, parent disposition is complete, and there are zero unresolved findings, schema errors, scope errors, or unapproved guarantees."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Deterministic shared-root/generation transition closure and supplementary cross-process stress",
        "criterion": "The targeted artifact concurrency test exits 0 and deterministically proves: absent-root creation and pre-existing regular-root EEXIST both issue unique receipt-bound generations; a worker cleanup removes only its generation and leaves the shared root; injected disappearance before generation issue fails with no issued generation; injected root replacement after issue fails with preserved residue; injected same-path generation replacement after mkdtemp fails while preserving both the original generation and replacement bytes because the original identity was already bound; only a globally quiescent fixed-root reclaimer removes a regular empty root; absent and newly nonempty roots are no-delete outcomes; different or unsafe identity fails without target deletion; a sibling creator paused after root inspection still succeeds after nested SQLite completes because nested Node-test SQLite defers root contraction; and no fixture creates or adopts sibling residue outside its owned fixture. The same route then runs at least eight independent Node child processes with at least twenty-five create/remove cycles each, zero child failure or duplicate generation, and outer-parent quiescent reclamation leaves .task-artifacts absent."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Windows path security and existing creator-cleanup negative guarantees",
        "criterion": "The targeted repo-utils/path-security tests exit 0 and continue to reject root or descendant junctions, missing receipts, generation/quarantine/member replacement, containment escape, unexpected node classes, and identity drift without deleting replacement or alias-target bytes; deterministic injected ENOENT/ENOTEMPTY outcomes are handled only at the documented quiescent reclaim seam, while injected EACCES/EPERM and every other unexpected removal error propagate unchanged."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Complete Node test-gate determinism and artifact baseline",
        "criterion": "Three consecutive fresh invocations of the public complete Node test wrapper each exit 0, discover and pass every test with no skip/todo/failure, report equal absent-root zero-member artifact baselines after parent quiescent reclamation, and leave .task-artifacts absent; a failed nested child still bypasses reclamation and retains its diagnostic baseline."
      },
      {
        "id": "V5",
        "type": "manual",
        "target": "Repository authority, capability truthfulness, documentation links, and diff hygiene",
        "criterion": "Repository docs checking and git diff --check exit 0; manual review finds one task-artifact owner, no coordinator-prune or security-claim expansion, no broken repository link, and no planned product capability described as implemented."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Toolchain type and build integrity",
        "criterion": "The exact frozen TypeScript 5.9.3 strict noEmit and declaration build routes exit 0 without dependency repair, fallback compiler, diagnostic, or tracked build output."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Every existing creator-generation consumer",
        "criterion": "From an externally verified absent .task-artifacts root, a fresh standalone package-smoke route exits 0 and external observation proves the exact root absent; the same absent-start, exit-0, exact-root-absent sequence independently passes for the fresh standalone Windows SQLite feasibility route. Deterministic injected unexpected reclaim failure makes each owning route nonzero without swallowing the error, and all prior package/SQLite safety evidence remains passing."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Full cross-cutting repository gate",
        "criterion": "The frozen network-disabled full offline gate starts with an externally verified absent .task-artifacts root and exits 0 end-to-end with lint, strict typecheck/build, all tests, docs, dependency shape, package smoke, SQLite feasibility, Codex boundary truthfulness, equal absent-root artifact baseline, and an externally verified absent terminal .task-artifacts root rather than a merely empty directory."
      },
      {
        "id": "V9",
        "type": "manual",
        "target": "Stable-diff independent review and closure",
        "criterion": "Fresh independent A1 is complete at the exact stable material state, every finding has a schema-valid parent disposition, every confirmed HIGH/MEDIUM repair has fresh closure-safe A2 evidence, and exec_plan trace reports no review, freshness, scope, or completion blocker."
      },
      {
        "id": "V10",
        "type": "manual",
        "target": "Terminal task inventory and Git-flow readiness",
        "criterion": "The staged inventory contains only declared task-owned regular files, excludes all ignored/runtime/generated/sensitive artifacts, the completed ExecPlan trace is completion-ready, git diff checks pass, and one clean task-owned terminal commit is eligible for explicit manifest prune and exact-head coordinator gates."
      }
    ],
    "risks": [
      {
        "id": "R1",
        "risk": "Allowing a worker or a locally quiescent nested consumer to reclaim the shared root can race another active test worker's generation issue and either delete or orphan another process's namespace."
      },
      {
        "id": "R2",
        "risk": "Catching broad filesystem failures could turn reparse, permission, containment, or identity attacks into silent success."
      },
      {
        "id": "R3",
        "risk": "Retrying root disappearance or capturing generation identity only after issue-time replacement can silently adopt a new namespace or replacement generation and leave the actually created generation without a valid receipt."
      },
      {
        "id": "R4",
        "risk": "Scheduling stress alone could pass without executing the exact EEXIST, disappearance, replacement, benign reclaim, and unexpected-error branches."
      },
      {
        "id": "R5",
        "risk": "Documentation could accidentally promote creator cleanup or the test wrapper to coordinator prune/security authority."
      },
      {
        "id": "R6",
        "risk": "A failed or interrupted test could leave diagnostic scratch that later invalidates a passed gate or is deleted without the standing prune predicates."
      }
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Keep the exact generation receipt as the only worker ownership token; remove shared-root reclamation from worker cleanup and expose only one fixed-path empty-root contraction for higher-level quiescent owners.",
        "rationale": "The original failure occurs because process-local receipts cannot establish that every other worker has stopped using the shared root; only the parent process boundary can establish that quiescence."
      },
      {
        "id": "D2",
        "statement": "Workers never remove the shared root. Generation creation performs one mkdir, accepts only EEXIST as concurrent stable-root creation, strictly inspects the root, captures the created generation identity immediately after mkdtemp, revalidates root and generation together, carries that exact identity into receipt publication, and issues no retry after disappearance or identity drift.",
        "rationale": "Removing concurrent worker reclamation closes the legal root X-to-Y handoff; binding the generation before any post-issue seam prevents same-path replacement adoption. Any remaining disappearance or replacement violates the protocol and must remain observable."
      },
      {
        "id": "D3",
        "statement": "Add one fixed-path empty-root reclaimer used only after global quiescence for the relevant namespace: the parent test runner after its complete native child exits, package-smoke after its local process boundary, and SQLite only when it is not nested in a native Node test context. Nested SQLite removes its generation and defers root contraction. The reclaimer checks regular empty state, returns without deletion for absence/nonempty state, propagates unsafe identity and unexpected errors, and may tolerate only ENOENT or ENOTEMPTY at its exact final rmdir seam.",
        "rationale": "Only the parent test runner knows when all concurrently discovered Node test files and their children have terminated. Package-smoke and standalone SQLite own complete local generation boundaries; nested SQLite does not. Path-based deletion remains operational hygiene with an explicit global-quiescence assumption, not an anchored security guarantee."
      },
      {
        "id": "D4",
        "statement": "Use deterministic hooks or injected filesystem operations to force every approved/rejected transition, then supplement that branch evidence with synchronized independent Node child processes using only the public generation entry points and parent quiescent reclamation.",
        "rationale": "Deterministic seams prove branch coverage and error propagation; real child processes separately prove process-local receipt maps and shared-root scheduling behavior."
      }
    ],
    "milestone_recovery": [
      {
        "id": "M1",
        "recovery": "Keep the plan in proposal and revise the approval contract followed by fresh A0 if reviewer evidence finds an ownership, authorization, scope, or guarantee gap."
      },
      {
        "id": "M2",
        "recovery": "A worker stops on root or generation disappearance, identity replacement, or unexpected filesystem error without retry, adoption, or shared-root deletion. Issued-but-unreceipted residue is eligible for later manifest prune only when it remains visible inside the exact frozen .task-artifacts root. External, hidden, or location-unknown residue is preserved with failed evidence for explicit human disposition; nested Node-test consumers defer root contraction, and the higher-level reclaimer runs only after global quiescence."
      },
      {
        "id": "M3",
        "recovery": "A failed stress or consumer test remains failed evidence; preserve exact output and creator-owned residue until inspected, then use only the task-frozen pathless coordinator prune at its authorized lifecycle point."
      },
      {
        "id": "M4",
        "recovery": "A failed gate or review leaves the task reserved and editable; make an in-scope repair, refresh all affected material evidence, and route HIGH/MEDIUM findings through fresh A2."
      },
      {
        "id": "M5",
        "recovery": "Do not integrate or push until the exact task head has a prune receipt and all frozen gates; Git-flow pending intent is handled only by trace/recover, and cleanup remains unperformed."
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
      {
        "id": "R1",
        "mitigation": "Remove all shared-root reclamation from worker cleanup and locally quiescent nested Node-test consumers; workers delete only their exact receipt-bound generation, nested SQLite defers, and one higher-level fixed-path reclaimer runs only after global quiescence.",
        "recovery": "Leave the shared root and every unowned member untouched; a failed route retains residue until explicit task-frozen coordinator prune."
      },
      {
        "id": "R2",
        "mitigation": "Catch only EEXIST at initial mkdir and ENOENT/ENOTEMPTY at the quiescent empty-root rmdir seam; keep regular-directory, realpath, containment, receipt, generation, and member identity checks unchanged and test injected EACCES/EPERM propagation.",
        "recovery": "Propagate every unexpected error and preserve all unowned/replacement bytes for inspection."
      },
      {
        "id": "R3",
        "mitigation": "Use no retry loop and bind generation dev/ino/kind/realpath immediately after mkdtemp before any post-issue seam. A vanished or replaced root or generation before receipt publication fails immediately; deterministic tests distinguish pre-issue no-generation state, root replacement residue, and generation replacement with both original and replacement bytes preserved.",
        "recovery": "Do not adopt or delete the replacement namespace. Only exact-root-visible residue may await manifest prune; external, hidden, or unknown residue remains a failed state requiring explicit human disposition."
      },
      {
        "id": "R4",
        "mitigation": "Force each creation/reclamation/error seam through deterministic hooks or injected operations, then spawn multiple independent child processes, synchronize start, repeat public entry-point cycles, and verify every child result plus terminal inventory.",
        "recovery": "Any missing deterministic branch, child error, timeout, duplicate generation, survivor, swallowed error, or unexpected root state fails the targeted gate with captured evidence."
      },
      {
        "id": "R5",
        "mitigation": "Keep local-agent-git-flow wording explicit that creator cleanup and test baseline are operational hygiene, while coordinator prune retains separate anchored authorization and receipt semantics.",
        "recovery": "Correct any overclaim before A1 and rerun documentation authority/capability review."
      },
      {
        "id": "R6",
        "mitigation": "Successful tests require exact baseline equality; failed commands retain diagnostics and cannot receive passed gate receipts; final cleanup uses only explicit manifest prune after the result commit.",
        "recovery": "Record failed evidence, inspect residue without unowned deletion, obtain a fresh Git-flow token, and invoke only the standing-authorized pathless prune when its predicates apply."
      }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "039f81b7ae01708a74bda2f40ec0a543978f46c7",
      "current_material_base": "039f81b7ae01708a74bda2f40ec0a543978f46c7",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-08-30 14:21:05+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-08-30 14:41:17+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-08-30 14:41:17+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-08-30 14:50:03+08:00"},
      {"id": "M5", "status": "complete", "updated_at": "2026-08-30 14:52:21+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Obtain a fresh independent A0 after the approval contract was narrowed for confirmed A1 findings F-A1-001 and F-A1-002, and bind the review to the exact canonical approval bytes, digest, and base.",
        "evidence": "Fresh independent A0 attempt 4 at 2026-08-30 14:18:39+08:00 independently recomputed 17611 canonical approval bytes and SHA-256 9ACE2768D51920F87403DE39DDE0F3A9ED91CC080B326DD84EA3277EE8C7468F at reviewed base 039f81b7ae01708a74bda2f40ec0a543978f46c7; trace had empty errors, warnings, outside_scope, overlap, and pre_existing_dirty; findings were empty and readiness was ready_for_activation.",
        "state_id": "approval-sha256:9ACE2768D51920F87403DE39DDE0F3A9ED91CC080B326DD84EA3277EE8C7468F"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Run the final artifact-concurrency, repo-utils, and artifact-policy route through the public wrapper from an externally verified absent root, with deterministic transition seams followed by eight independent workers and twenty-five create/remove cycles per worker.",
        "evidence": "The exact repaired state passed 16/16 with no failure, skip, or todo and returned an absent 0-to-0 root after parent reclamation. It proved one-mkdir absent/EEXIST creation, no retry on disappearance, root replacement refusal, immediate pre-hook generation identity binding with both displaced-original and same-path replacement bytes preserved, receipt-only child cleanup, exact fixed-root outcomes and injected errors, a paused sibling creator surviving nested SQLite even with an empty-but-present NODE_TEST_CONTEXT marker, and 200 unique child-process generations with no survivor.",
        "state_id": "git-sha1:f1827a18fe6b4571404a5d3523fff509a0a54263"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Run the exact-state targeted repo-utils and artifact-policy security/identity matrix together with the deterministic reclaim-error seams.",
        "evidence": "All targeted Windows junction containment, missing receipt, generation/quarantine/member replacement, nonregular inventory, and target-byte preservation cases passed inside the 16/16 route. ENOENT and ENOTEMPTY remained the only translated reclaimer races; EACCES, EPERM, and EIO propagated unchanged, and the final root was absent.",
        "state_id": "git-sha1:f1827a18fe6b4571404a5d3523fff509a0a54263"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Run the complete public Node test wrapper three consecutive times from externally verified absent roots after the full-suite concurrency assertion was narrowed to the actual shared-root contract.",
        "evidence": "All three final exact-state runs passed 276/276 with fail=0, skipped=0, and todo=0. Each reported artifactHygiene=passed, rootReclaimStatus=reclaimed, baselineEntries=0, terminalEntries=0, and external terminal observation found the exact .task-artifacts root absent. The subsequent full offline gate repeated the same 276/276 result.",
        "state_id": "git-sha1:f1827a18fe6b4571404a5d3523fff509a0a54263"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Run docs-check and git diff --check on the final repaired state, then compare authority, feasibility, implementation, policy, and historical evidence surfaces.",
        "evidence": "docs-check passed 71 Markdown files, 240 exact-case local links, and zero forbidden finding; git diff --check exited 0. Manual review found one generation/receipt owner, immediate identity binding, explicit global-test versus standalone owner boundaries, unchanged schema-1 manifest and coordinator prune authority, no arbitrary path deletion, no rewritten historical evidence, and no product or support overclaim.",
        "state_id": "git-sha1:f1827a18fe6b4571404a5d3523fff509a0a54263"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Run strict TypeScript noEmit and declaration build directly and again through the final frozen full offline gate.",
        "evidence": "TypeScript 5.9.3 under Node 24.19.0 and pnpm 11.19.0 passed pnpm typecheck and pnpm build without a diagnostic, dependency repair, fallback compiler, network operation, or tracked build output.",
        "state_id": "git-sha1:f1827a18fe6b4571404a5d3523fff509a0a54263"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "From absent roots on the exact final state, run standalone package smoke and Windows SQLite; inject EACCES and EPERM root-reclaim failures respectively; verify nonzero propagation and exact empty-root retention; then rerun the same owner to recover terminal absence.",
        "evidence": "Package smoke passed with 83 packed files and source/build/installed parity. Its injected EACCES exited 1, retained exactly an empty root, and the normal rerun passed and removed the root. Standalone SQLite passed Windows 10.0.22631, Node 24.19.0, SQLite 3.53.3 with zero generation survivors; injected EPERM exited 1 with exactly an empty root, and the normal rerun passed and removed it. Neither standalone route inherited NODE_TEST_CONTEXT.",
        "state_id": "git-sha1:f1827a18fe6b4571404a5d3523fff509a0a54263"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Run pnpm verify:offline from an externally verified absent root with the frozen local toolchain and offline dependency store.",
        "evidence": "The exact-state network-disabled gate exited 0 end-to-end: lint, strict typecheck/build, 276/276 Node tests with reclaimed 0-to-0 artifact root, docs 71/240/0, zero production dependencies, package smoke with 83 files, the complete Windows SQLite matrix, and truthful Codex externalE2E=not_run/supportClaim=false all passed. External observation found .task-artifacts absent.",
        "state_id": "git-sha1:f1827a18fe6b4571404a5d3523fff509a0a54263"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Obtain a fresh independent A2 at the exact repaired material state to audit closure of confirmed A1 findings F-A1-001 and F-A1-002, direct adjacency, contracts, regressions, and recorded validation evidence.",
        "evidence": "Fresh independent A2 at 2026-08-30 14:49:18+08:00 reported closure_safe=true, closes=[F-A1-001,F-A1-002], and findings=[]. Its trace had errors=[], warnings=[], outside_scope=[], overlap=[], and pre_existing_dirty=[] at the exact state; independent public targeted validation passed 16/16 from absent to absent, git diff --check passed, and the reviewer verified nested SQLite deferral, global parent quiescence, immediate generation identity binding, original-identity receipt publication, same-path replacement refusal, and preserved bytes.",
        "state_id": "git-sha1:f1827a18fe6b4571404a5d3523fff509a0a54263"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "Stage the complete terminal candidate using only explicit declared task paths; inspect cached name/status, unstaged and untracked inventories; run cached diff checking; move the plan to completed; and require a completion-ready exact-state trace before commit.",
        "evidence": "The pre-terminal staged inventory contained exactly 16 declared task-owned files: 11 modified and 5 added, all within the ExecPlan scope. git diff --cached --check exited 0; git diff --name-only and git ls-files --others --exclude-standard were empty after staging; ignored node_modules, .pnpm-store, dist, and runtime/generated material were excluded; .task-artifacts was absent. After the sole plan path moved from active to completed and was restaged, the exact completed-plan trace was required to report errors=[], warnings=[], outside_scope=[], overlap=[], completion_ready=true at git-sha1:f1827a18fe6b4571404a5d3523fff509a0a54263.",
        "state_id": "git-sha1:f1827a18fe6b4571404a5d3523fff509a0a54263"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/a0_artifact_concurrency",
        "independence": "Fresh independent read-only A0 attempt 4. The reviewer did not author the revised approval contract or implementation, edit repository material, modify Git/index/refs/coordinator state, grant authority, or perform external writes.",
        "scope": "Complete revised approval contract after confirmed A1 F-A1-001 and F-A1-002: goal/non-goals, task-path envelope, immediate generation identity binding, global native-test quiescence, nested SQLite deferral, standalone package/SQLite ownership, deterministic evidence, recovery, authorization, and closure requirements.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-30 14:18:39+08:00",
        "approval_sha256": "9ACE2768D51920F87403DE39DDE0F3A9ED91CC080B326DD84EA3277EE8C7468F",
        "evidence": "The reviewer independently recomputed 17611 canonical approval bytes and the exact recorded digest at reviewed base 039f81b7ae01708a74bda2f40ec0a543978f46c7. Fresh trace reported errors=[], warnings=[], outside_scope=[], overlap=[], and pre_existing_dirty=[]. The NODE_TEST_CONTEXT rule is deliberately conservative because a present marker only removes root-deletion authority, while standalone package/SQLite ownership remains truthful. Existing material validation was explicitly identified as pre-repair evidence that must be refreshed after implementation.",
        "parent_disposition": "complete",
        "reviewed_material_base": "039f81b7ae01708a74bda2f40ec0a543978f46c7",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/a1_artifact_concurrency",
        "independence": "Fresh independent read-only A1. The reviewer did not author the plan or implementation, edit task material, modify Git/index/refs/coordinator state, grant authority, or perform external writes. Reviewer-created local generations were creator-cleaned and the fixed root was absent afterward.",
        "scope": "Complete stable task diff and Tier-2 transition boundary: goal/non-goals, root and generation creation/cleanup state machines, cross-process ownership, identity/topology, error propagation, failed-child residue, package/SQLite/test-runner ownership, fault seams, coordinator-prune separation, documentation, recovery, and regression evidence.",
        "reviewed_at": "2026-08-30 14:03:46+08:00",
        "evidence": "Fresh trace exactly matched material base and HEAD 039f81b7ae01708a74bda2f40ec0a543978f46c7, approval digest 61FCCF39A56B4E9BAF263EB643EA0165A41F9C9FED7F3174D90CF00874483FF0, and reviewed state git-sha1:86d35225ee370c5371f9a6adfb3c7528686cfef6 with errors=[], warnings=[], outside_scope=[], overlap=[], and pre_existing_dirty=[]. The reviewer read the complete skill audit guidance, authority/contracts, plan and A0 evidence, modified/untracked diff, implementations, consumers, fixtures, and tests; independently reran the targeted 11/11 absent-to-absent route; and used an isolated generation-swap probe to demonstrate returned replacement adoption while the original survived. git diff --check passed and .task-artifacts was absent after review.",
        "reviewed_state_id": "git-sha1:86d35225ee370c5371f9a6adfb3c7528686cfef6",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-A1-001",
            "severity": "HIGH",
            "summary": "Nested SQLite feasibility can reclaim the shared root while sibling Node test workers are still active.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Narrow the owner contract so the outer public test runner is the sole fixed-root reclaimer while a native Node test child is active; standalone SQLite retains its quiescent reclaim, nested SQLite removes only its generation and defers root contraction. Add a deterministic paused-after-root-inspection sibling regression, revise authoritative/current documentation, obtain fresh A0 for the narrowed approval contract, refresh affected validation, and require fresh A2.",
            "closure_evidence": "Pending approved contract revision, implementation repair, refreshed material validation, and fresh independent A2; this finding is not closed.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-002",
            "severity": "MEDIUM",
            "summary": "Generation identity is first captured after the post-issue seam, allowing same-path replacement adoption before receipt publication.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Capture the exact regular generation identity immediately after mkdtemp, before the post-issue seam; revalidate that identity with the root afterward and carry the original identity into fixed-root receipt publication. Add deterministic generation-only replacement coverage preserving both original and replacement bytes, refresh affected validation, and require fresh A2.",
            "closure_evidence": "Pending implementation repair, deterministic generation-swap regression, refreshed material validation, and fresh independent A2; this finding is not closed.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/a2_artifact_concurrency",
        "independence": "Fresh independent read-only A2. The reviewer did not author or repair the implementation, edit repository material, modify Git/index/refs/coordinator state, grant authority, or perform external writes. Reviewer validation used the public test wrapper; all creator-owned scratch was cleaned and the fixed artifact root was absent afterward.",
        "scope": "Exact closure audit of confirmed A1 findings F-A1-001 and F-A1-002 at the repaired material state, including their parent dispositions, repair delta, complete task diff, Tier-2 direct adjacency, authoritative task-artifact/toolchain contracts, deterministic regressions, and current material-bound validation evidence.",
        "reviewed_at": "2026-08-30 14:49:18+08:00",
        "evidence": "Fresh final trace bound the audit to git-sha1:f1827a18fe6b4571404a5d3523fff509a0a54263 and approval SHA-256 9ACE2768D51920F87403DE39DDE0F3A9ED91CC080B326DD84EA3277EE8C7468F, with errors=[], warnings=[], outside_scope=[], overlap=[], and pre_existing_dirty=[]. F-A1-001 is closed: SQLite removes its exact generation and Object.hasOwn makes every present NODE_TEST_CONTEXT, including an empty value, defer fixed-root contraction; the outer runner reclaims only after the complete native child exits; standalone package/SQLite ownership remains exact. The paused sibling regression proves root survival and creator completion. F-A1-002 is closed: repo-utils captures generation realpath/dev/ino immediately after mkdtemp and before afterGenerationIssue, revalidates root and generation, and publishes the receipt from the original identity; deterministic same-path swap rejects adoption while preserving displaced-original and replacement bytes. Independent public targeted validation passed 16/16 with 200 unique worker generations and absent terminal root; git diff --check passed and the material state remained exact.",
        "reviewed_state_id": "git-sha1:f1827a18fe6b4571404a5d3523fff509a0a54263",
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
        "finding_ids": ["F-A0-01", "F-A0-02"],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-08-30 13:05:40+08:00 bound digest F625FEA72C98989EF780780F26DEF78645AC9360C93E62E580D9CA41648CCEEF and confirmed one HIGH and one MEDIUM contract gap. Worker root reclamation plus bounded retry could still create under a replacement root and leave an unreceipted generation, while scheduling stress did not prove each branch. The parent accepted both findings, moved shared-root reclamation to explicit quiescent owners, removed retry, and required deterministic transition/error evidence before supplementary process stress. Fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-A0-03", "F-A0-04", "F-A0-05", "F-A0-06"],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-08-30 13:19:01+08:00 bound digest B63E6ABCAFBDDFAFB2A642BCFDA2F9226EB9ECCCC94F527C0EBFCFBBCE2755F7 and confirmed the two prior gaps closed, then found four MEDIUM contract gaps: authoritative toolchain/current feasibility wording and one test were outside scope; allowed filesystem action retained rejected wording; package/SQLite gates did not prove exact root absence or reclaim-error propagation; and recovery overstated manifest-prune authority for external or hidden residue. The parent accepted all four and revised scope, authorization, binary criteria, and recovery. Fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "The ready A0 at 2026-08-30 13:26:50+08:00 bound approval digest 61FCCF39A56B4E9BAF263EB643EA0165A41F9C9FED7F3174D90CF00874483FF0 and base 039f81b7ae01708a74bda2f40ec0a543978f46c7. Fresh independent A1 then confirmed HIGH F-A1-001 and MEDIUM F-A1-002: nested SQLite lacked global test-child quiescence and generation identity was first captured after a replaceable post-issue seam. The parent confirmed both in scope, narrowed the owner model, required immediate generation identity binding, revised binary evidence, and reopened the proposal for fresh A0."
      },
      {
        "audit": "A0",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "activated",
        "reason": "Fresh independent A0 at 2026-08-30 14:18:39+08:00 bound canonical approval digest 9ACE2768D51920F87403DE39DDE0F3A9ED91CC080B326DD84EA3277EE8C7468F and base 039f81b7ae01708a74bda2f40ec0a543978f46c7, reported no finding, and found the revised repair contract ready_for_activation. The parent accepted the report and activated implementation."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V5",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-08-30 13:36:00+08:00",
        "evidence": "The first two focused artifact-policy runs passed all implementation cases but exposed two line-wrap-sensitive authority anchors after truthful wording changed. The contract wording was reformatted without semantic change; the complete policy route then passed 4/4 and the final docs gate passed.",
        "state_id": null
      },
      {
        "validation_id": "V4",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-08-30 13:41:00+08:00",
        "evidence": "The first complete run passed every product and concurrency case but native recursive discovery also loaded test/fixtures/artifact-concurrency-worker.mjs without worker arguments, producing 274/275. The fixture was made inert only for its zero-argument discovery load while preserving strict three-argument worker validation; the current three complete reruns pass 275/275.",
        "state_id": null
      },
      {
        "validation_id": "V7",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-08-30 13:47:00+08:00",
        "evidence": "The first package command stopped before the script because the desktop pnpm child PATH omitted its bundled Node directory; after binding the exact Node 24.19.0 directory, the next invocation correctly refused a pack run before dist existed. The frozen build prerequisite was then run and all current package success/fault/recovery evidence passed. Neither attempt changed source or left .task-artifacts present.",
        "state_id": null
      },
      {
        "validation_id": "V2",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-30 14:10:00+08:00",
        "evidence": "The previously passing V2 record describes the pre-repair state. Confirmed F-A1-001 and F-A1-002 changed its binary criteria, so the result is retained only as history and must be rerun after repair.",
        "state_id": "git-sha1:86d35225ee370c5371f9a6adfb3c7528686cfef6"
      },
      {
        "validation_id": "V3",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-30 14:10:00+08:00",
        "evidence": "The previously passing V3 record describes the pre-repair state and is retained only as history after the approved generation-identity repair changed affected material.",
        "state_id": "git-sha1:86d35225ee370c5371f9a6adfb3c7528686cfef6"
      },
      {
        "validation_id": "V4",
        "attempt": 2,
        "classification": "superseded",
        "at": "2026-08-30 14:10:00+08:00",
        "evidence": "The previously passing V4 three-run record describes the pre-repair state and is retained only as history after confirmed F-A1-001 changed the complete-suite quiescence criterion.",
        "state_id": "git-sha1:86d35225ee370c5371f9a6adfb3c7528686cfef6"
      },
      {
        "validation_id": "V5",
        "attempt": 2,
        "classification": "superseded",
        "at": "2026-08-30 14:10:00+08:00",
        "evidence": "The previously passing V5 documentation and diff record describes wording before the A1-driven owner-contract revision and must be refreshed with the repaired state.",
        "state_id": "git-sha1:86d35225ee370c5371f9a6adfb3c7528686cfef6"
      },
      {
        "validation_id": "V6",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-30 14:10:00+08:00",
        "evidence": "The previously passing V6 type/build record is retained only as pre-repair history and must bind the final repaired material state.",
        "state_id": "git-sha1:86d35225ee370c5371f9a6adfb3c7528686cfef6"
      },
      {
        "validation_id": "V7",
        "attempt": 2,
        "classification": "superseded",
        "at": "2026-08-30 14:10:00+08:00",
        "evidence": "The previously passing V7 package/SQLite record predates the explicit standalone-versus-nested SQLite boundary and is retained only as history.",
        "state_id": "git-sha1:86d35225ee370c5371f9a6adfb3c7528686cfef6"
      },
      {
        "validation_id": "V8",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-30 14:10:00+08:00",
        "evidence": "The previously passing V8 full offline gate describes the pre-repair state and cannot satisfy the revised cross-cutting criteria; it must be rerun after repair.",
        "state_id": "git-sha1:86d35225ee370c5371f9a6adfb3c7528686cfef6"
      },
      {
        "validation_id": "V5",
        "attempt": 3,
        "classification": "deterministic_failure",
        "at": "2026-08-30 14:26:00+08:00",
        "evidence": "The first repaired combined target route passed every implementation case but one authority-source assertion remained line-wrap-sensitive after truthful contract wording changed, producing 15/16 and leaving only an empty shared root. The assertion was narrowed to whitespace-insensitive semantic anchors, the exact empty root was reclaimed through the named reclaimer, and the final exact-state route passed 16/16.",
        "state_id": null
      },
      {
        "validation_id": "V4",
        "attempt": 3,
        "classification": "deterministic_failure",
        "at": "2026-08-30 14:32:00+08:00",
        "evidence": "The first post-A1 complete run passed all product behavior but the new paused-sibling regression incorrectly required the globally shared root to be empty while other native test files legitimately owned active generations, producing 275/276. The implementation behavior itself succeeded; the test assertion was narrowed to root survival and creator completion, while exact empty-root proof remained in the isolated absent-start route.",
        "state_id": null
      },
      {
        "validation_id": "V4",
        "attempt": 4,
        "classification": "deterministic_failure",
        "at": "2026-08-30 14:34:00+08:00",
        "evidence": "A second complete run exposed one remaining duplicate globally-empty assertion in the same regression and again produced 275/276 without an implementation failure. The duplicate was removed, isolated absent-start proof was rerun, and the next three complete exact-state runs passed 276/276.",
        "state_id": null
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-08-30 13:12:00+08:00",
        "summary": "Replaced worker-level shared-root reclamation and retry with generation-only worker cleanup, explicit higher-level quiescent fixed-root reclamation, fail-closed partial-state recovery, and deterministic transition/error validations after A0 findings F-A0-01 and F-A0-02.",
        "previous_approval_sha256": "F625FEA72C98989EF780780F26DEF78645AC9360C93E62E580D9CA41648CCEEF"
      },
      {
        "at": "2026-08-30 13:23:00+08:00",
        "summary": "Added authoritative toolchain/current feasibility truth-sync, exact higher-level deletion authorization, standalone package/SQLite root-absence and error evidence, and exact-root-limited prune recovery after A0 findings F-A0-03 through F-A0-06.",
        "previous_approval_sha256": "B63E6ABCAFBDDFAFB2A642BCFDA2F9226EB9ECCCC94F527C0EBFCFBBCE2755F7"
      },
      {
        "at": "2026-08-30 14:10:00+08:00",
        "summary": "After confirmed A1 F-A1-001 and F-A1-002, narrowed fixed-root reclamation to global native-test quiescence with nested SQLite deferral, required immediate post-mkdtemp generation identity binding carried into receipts, and added deterministic paused-sibling and generation-replacement evidence before repair.",
        "previous_approval_sha256": "61FCCF39A56B4E9BAF263EB643EA0165A41F9C9FED7F3174D90CF00874483FF0"
      }
    ],
    "final_summary": "Shared task-artifact lifecycle repair is complete: workers remove only immediately identity-bound, receipt-bound generations; nested SQLite defers shared-root contraction to the globally quiescent Node test parent; standalone package and SQLite owners retain exact empty-root failure/recovery behavior; deterministic swap, paused-sibling, Windows identity, repeated full-suite, offline, and independent A2 evidence all pass without changing coordinator prune authority or product capability claims."
  }
}
```

## Context

The full inspection observed one run of the complete Node suite fail 269/270
because another process removed `.task-artifacts` after an empty check and
before `inspectRegularDirectory`; the isolated concurrency file and a second
complete run passed. The task starts from synchronized commit
`039f81b7ae01708a74bda2f40ec0a543978f46c7` under coordinator state version 2
with the schema-1 manifest frozen to exactly `.task-artifacts`.
