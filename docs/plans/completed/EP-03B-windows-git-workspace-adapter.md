# ExecPlan: implement the Windows local Git workspace adapter

EP-03B is the second item in the strict EP-03A -> EP-03B -> EP-03C chain. It implements the already durable `ato.workspace/v1` boundary as a real local Windows Git/filesystem adapter exercised only against disposable repositories. Project policy, completion gates, integration, push, product routing, and policy-authorized cleanup remain EP-03C work.

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-02 13:07:36+08:00",
    "updated_at": "2026-09-02 20:23:06+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "user request in the current coordinator thread",
        "at": "2026-09-02 13:07:36+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "user request plus docs/reference/local-agent-git-flow.md standing grants",
        "at": "2026-09-02 13:07:36+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Deliver EP-03B as one production-code Windows local Git/filesystem WorkspaceBackend for a fresh in-place ato.workspace/v1 ownership-binding reset: add only the immutable generation ownership digest required for the existing application owner, physical manifest, and current Git/filesystem observation to agree after restart; bind opaque Project and workspace-root identities to preconfigured nonoverlapping trusted local paths; derive the required bounded workspace/generation target and ownership-bound linked-admin topology without using raw request identifiers as path components, while retaining run/member/execution/fence lineage inside the ownership digest; accept only an exact full commit object ID; anchor and revalidate every Git mutation namespace at the point of use; construct one detached linked-worktree registration itself inside owner-held namespaces without invoking Git worktree add, then materialize a closed regular-file tree through owner-held no-follow/exclusive handles rather than Git checkout; authoritatively inspect and recover absent/reserved/partial/complete states; produce exact ownership and inventory receipts; and fail closed without a cleanup effect until EP-03C supplies the separately required ProjectPolicy decision. Export only the narrow adapter factory/configuration surface, exercise real Git solely in repository-owned disposable fixtures, retain the durable application owner as the only lifecycle/authorization coordinator, and pass security, recovery, package, documentation, independent-review, full-repository, Git-flow integration, and ordinary-push gates without adding a database schema, API command, scheduler, Codex, MCP, integration, release, deployment, compatibility path, or platform-support claim.",
    "non_goals": [
      "Do not implement ProjectPolicy, CompletionBackend, completion gates, gate receipts, integration reservation, target-ref mutation, merge, remote inspection, push behavior, policy-driven preservation, policy-authorized cleanup, product facade composition, or a public CLI workspace command; EP-03C owns those outcomes.",
      "Do not execute Task content, invoke Codex or another execution backend, add SchedulerBackend or scheduled delivery, expose MCP, run a daemon/service, contact an external repository/service, use credentials, access D:\\quant, release, or deploy.",
      "Do not change ato.workspace/v1 beyond the exact fresh-only immutable generation ownership-binding digest added to subject/receipt verification by this plan; do not change durable schema-version-1 rows, authorization vocabulary, ato.execution/v1, sole ato.api/v1 command/error grammar, Domain semantics, backup/restore JSON formats, Manual loop, or dispatcher behavior.",
      "Do not add a legacy schema/API/port/authorization/backup reader, migration, alias, fallback, adoption path, dual write, deprecation window, old-worktree marker, or compatibility shim; this is the authorized unreleased fresh-only baseline.",
      "Do not derive a trusted path, Git executable, repository identity, ownership decision, command, environment value, policy decision, or cleanup permission from Task text, request identifiers, Git output, repository content, branch names, configuration inside the Project, or an adapter receipt alone.",
      "Do not use recursive deletion, forced worktree removal, reset, forced checkout, forced ref update, hooks, external filters, credential helpers, lazy network fetch, a shell command string, repository-discovered executable, or best-effort cleanup.",
      "Do not describe one development host, disposable Git fixtures, maintainer Git-flow worktrees, or an unshipped adapter as a supported Windows/Git/platform product claim.",
      "Do not rewrite, delete, normalize, or reinterpret completed ExecPlans, historical validation evidence, changelog facts, or EP-03A durable records."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "EP-03A terminal-resolve must identify exactly d0ed2d85c2908e36f8b97a450366ee85ab72368f, its Git-flow task must remain pushed at that exact head, and chain-check must accept that terminal commit as this plan's current base before EP-03B activation. EP-03C must not be created until EP-03B has its own unique terminal commit, completed-plan resolution, exact-head gates, FF-only integration, and applicable ordinary push.",
        "source": "current user request; docs/plans/README.md; docs/plans/completed/EP-03A-durable-workspace-foundation.md"
      },
      {
        "id": "C2",
        "statement": "The repository root remains the clean master integration checkout. Every EP-03B plan, source, test, documentation, and evidence mutation occurs only on coordinator task ep-03b, branch task/ep-03b, and D:\\agent-task-orchestrator\\.worktrees\\ep-03b; harness-git-flow is the sole coordinator-state writer.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md"
      },
      {
        "id": "C3",
        "statement": "The ato.workspace/v1 port and durable coordinator remain authoritative. This unreleased fresh-only reset adds exactly one 64-hex immutable generation ownershipBindingSha256 to the subject and receipt so the application can derive it from its existing durable generation tuple, require the adapter to echo it, and bind a restart-readable physical manifest; no compatibility request/result shape is retained. The adapter performs no SQLite write, authorization, Domain, or lifecycle decision, and reserve/create/cleanup remain effect-possible only through the application owner's existing durable protocol.",
        "source": "ARCHITECTURE.md; docs/reference/adapter-contracts.md; docs/reference/reliability-protocol.md; src/workspace-port.ts; src/workspace-application.ts"
      },
      {
        "id": "C4",
        "statement": "Trusted adapter construction binds an exact Windows-local absolute regular git.exe plus explicit projectRootKey-to-Project-root and workspaceRootKey-to-workspace-root mappings. Roots are normalized, drive-qualified, non-root, existing local directories with component-by-component reparse refusal and stable canonical device/inode/mode receipts. Every configured Project root and workspace root pair must be disjoint: neither equality nor either ancestor relationship is allowed. Request or Git data can only select an exact preconfigured key, never supply, overlap, or widen a path.",
        "source": "docs/reference/completion-workspace-contract.md; docs/security/threat-model.md; src/project-registry.ts"
      },
      {
        "id": "C5",
        "statement": "The target path is exactly workspaceRoot/ato-workspaces/w-<lowercase-sha256(workspaceId)>-g<positive-generation>, and the linked administration path is exactly <Project>/.git/worktrees/ato-<lowercase-ownershipBindingSha256>. Each complete target/admin path is limited to at most 240 UTF-16 code units on the observed Windows host; generation is canonical positive decimal with no sign or leading zero. Raw Project, Task, run, member, execution, workspace, operation, title, prompt, ref, or repository strings never become path segments; run/member/execution/fence lineage remains cryptographically bound through ownershipBindingSha256, the configured workspace root, exact ato-workspaces parent and exact generation target are independently contained/identity-checked, and siblings are never discovered by glob or newest-name selection.",
        "source": "docs/reference/completion-workspace-contract.md; docs/security/threat-model.md"
      },
      {
        "id": "C6",
        "statement": "Before mutation, static workers anchor and revalidate the exact workspace root, owner-derived target, Project root, canonical <Project>/.git common directory, exact linked-worktree administration directory, object directory, and every existing or newly created worktrees/target directory for the complete effect window. The supported repository topology is deliberately closed: one non-bare main worktree whose git-dir and common-dir are the same real <Project>/.git directory, a real contained objects directory, and a common worktrees child that is either absent or a real contained directory before create and is created, entered, identity-checked, and held only inside the existing effect-possible create operation. The adapter derives one deterministic safe linked-admin leaf from the immutable ownership binding, acquires that exact leaf with atomic mkdir create-if-absent inside the already anchored worktrees directory, immediately enters, realpath/lstat/fstat-validates, and holds it before creating any control file; it likewise acquires and anchors the exact target and every target directory before its first child write. EEXIST, a foreign leaf, an unexpected child, or any identity drift is conflict/partial/ambiguous and is never adopted or overwritten. Gitfile, separate common directory, alternates file/config/environment, replacement-object namespace, promisor/partial-clone/lazy-fetch state, and external object directory are refused. Each worker validates current-directory canonical/device/inode/mode identity after start and the observed host must prevent rename of that directory and ancestors; unsupported, changed, reparse, aliased, nonlocal, case-ambiguous, overlapping, or unanchored state fails before any Git mutation.",
        "source": "docs/reference/completion-workspace-contract.md#contained-path-and-no-follow-checks; docs/security/threat-model.md N1; exact local Windows feasibility observation recorded by this proposal"
      },
      {
        "id": "C7",
        "statement": "Git is invoked by one trusted absolute executable with shell=false, windowsHide=true, bounded timeout/output, argument arrays, closed operation templates, exact hexadecimal commit object IDs, disabled prompts/credential interaction/lazy fetch/replacement objects/hooks/fsmonitor/maintenance/gc/pagers, and a minimal allowlisted environment. Repository config, attributes, Git output, filenames, and errors are hostile data. The exact tree is pre-enumerated and rejects symlink, gitlink, non-blob, active filter, non-NFC, control, traversal, ADS/device/reserved-name, trailing-dot/space, case-fold collision, overlong, duplicate, or oversized entries before registration. Git never checks out Project content in EP-03B.",
        "source": "docs/security/threat-model.md T1-T4/T8/T10; docs/security/privacy-and-logging.md; docs/reference/adapter-contracts.md"
      },
      {
        "id": "C8",
        "statement": "Create uses an exact detached base object and an ordered adapter-owned linked-worktree registration. It never invokes git worktree add or checkout. Inside the held linked-admin and target namespaces, the adapter constructs only the exact Git 2.53.0.windows.1-compatible closed registration layout: every admin control leaf and the target .git gitfile is a regular non-reparse file acquired with exclusive final-leaf creation through a held descriptor, containing only adapter-derived canonical content. Git is then used only to authoritatively validate that registration, read already-local objects, update the index inside the held admin namespace, and inspect. Under the already anchored target, the adapter precreates and anchors every validated tree directory before content writes, creates each regular file with exclusive create/no-follow semantics, writes the exact locally present blob through the held file descriptor, fsyncs and closes it, then updates only the anchored linked-worktree index to the exact base and verifies a clean status. Reserve never adopts a directory or registration; create adopts only the exact generation it was asked to create. Inspect/recover use Git's authoritative NUL-delimited worktree inventory, physical ownership manifest, current common/admin identity, detached/ref identity, exact HEAD/base, and bounded inventory. Missing, foreign, duplicate, stale, partial, malformed, conflicting, response-lost, or unprovable state is refused or ambiguous, never silently repaired or blindly replayed.",
        "source": "docs/reference/completion-workspace-contract.md; docs/reference/reliability-protocol.md; docs/reference/adapter-contracts.md"
      },
      {
        "id": "C9",
        "statement": "The application derives ownershipBindingSha256 from the immutable durable generation tuple: Project ID plus creation-time resource/config revision floors and root key, Task ID/revision floor, run/member identities plus creation-time revision floors and membership revision, execution ID/revision floor/attempt/fence, workspace ID/generation/root key, creator operation, base object, and adapter/contract versions. After registration, the adapter acquires the fixed final manifest leaf directly with exclusive create-if-absent inside the held exact linked-worktree administration directory, retains that descriptor, writes the bounded canonical bytes, fsyncs and closes it, then reopens it as a regular non-reparse file and byte-compares it before continuing. There is no temporary leaf, rename, replace, overwrite, repair, or adoption path; EEXIST, truncation, interruption, unexpected content, or identity drift is partial/conflict/ambiguous and never success. The manifest binds that digest plus canonical Project/common-dir/admin/target identities, exact base/HEAD and registration identity without raw Task/source/environment/error content. A complete receipt echoes the same digest. Every inspect/recover must three-way match the current durable request binding, reopened manifest, and current Git/filesystem observation. Missing, truncated, extra, substituted, stale-fence, rebuilt, or foreign evidence is partial/conflict/ambiguous; neither manifest, Git registration, path, HEAD, nor receipt alone is authority. SQLite schema stays unchanged and the application persists its existing receipt digest/closed projection.",
        "source": "docs/reference/completion-workspace-contract.md#worktree-ownership-receipt; docs/security/privacy-and-logging.md; src/workspace-application.ts"
      },
      {
        "id": "C10",
        "statement": "Production cleanup always returns the exact non-retryable non-ambiguous policy_denied failure with a stable code and performs zero filesystem or Git mutation. The existing grant and confirmation are necessary but not sufficient: only EP-03C may compose the separate current ProjectPolicy allow, lease/reservation/gate/preservation checks, and point-of-use ownership proof required for a cleanup effect.",
        "source": "docs/reference/completion-workspace-contract.md#cleanup-refusal; docs/reference/authorization-contract.md; current EP-03A/EP-03B/EP-03C allocation"
      },
      {
        "id": "C11",
        "statement": "The package root may export the production adapter ID/version, factory, and narrow configuration/result types, but neither product-runtime nor CLI composes or invokes it in EP-03B. The current local product remains explicit-Manual/no-workspace behavior, and no generic filesystem or shell endpoint is added.",
        "source": "ARCHITECTURE.md; docs/reference/cli-contract.md; docs/reference/toolchain-contract.md"
      },
      {
        "id": "C12",
        "statement": "Real Git tests create only fresh disposable repositories and workspace roots under the repository-owned ignored .task-artifacts fixture mechanism frozen by Git-flow, configure no remote, make no network call, use no credential, never touch this repository as the adapter Project, and remove only exact creator-owned fixture generations through the existing test ownership helper rather than the production adapter cleanup operation. No OS temporary or other external path is a test target.",
        "source": "current user authorization; docs/reference/validation-policy.md; docs/reference/local-agent-git-flow.md; docs/adr/ADR-009-workspace-ownership-and-safe-integration.md"
      },
      {
        "id": "C13",
        "statement": "The exact host observations are development evidence only: Node 24.19.0 exposes no O_NOFOLLOW/O_SYMLINK, lstat detects a created junction, exclusive file creation refuses a pre-existing leaf, atomic mkdir refuses a pre-existing directory leaf, an ordinary open directory handle does not prevent rename, a child process current directory does prevent rename of itself and ancestors, and Git 2.53.0.windows.1 accepts and authoritatively reports the exact compatible detached linked-worktree administration layout created inside anchored namespaces. Production mutation must capability-probe and fail closed before the first registration leaf if any required root/admin/directory anchor, exclusive final-leaf/admin/control-file/regular-file materialization, compatible registration-layout, or local-object fact does not hold; documentation retains unverified compatibility status and makes no general Windows support claim.",
        "source": "local read-only/disposable feasibility probes at proposal time; docs/compatibility/v0.1.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C14",
        "statement": "Every intermediate EP-03B HEAD is self-consistent, strict-typecheckable, testable, and truthful. No temporary compatibility shim, knowingly unsafe fallback, broken package inventory, partial public export, stale documentation status, or cleanup bypass may be deferred to EP-03C.",
        "source": "current user request; AGENTS.md"
      },
      {
        "id": "C15",
        "statement": "Any change to the goal, non-goals, port/public/security outcome, authorization, task envelope, cleanup stance, external action, or binary validation criterion stales A0. Base movement is assessed through schema-v3 base-diff; material validation and A1/A2 evidence are exact-state facts and must be refreshed after any accepted material change.",
        "source": "harness-exec-plan schema v3; AGENTS.md"
      },
      {
        "id": "C16",
        "statement": "docs/reference/versioning-compatibility-contract.md remains the sole compatibility/versioning owner. Under its named current-v1 reset exception and the user's explicit unreleased fresh-only authorization, EP-03B records one exact same-major reset of the sole ato.workspace/v1 subject/receipt to require ownershipBindingSha256: package version remains private 0.0.0-development, no production workspace adapter, product command, supported external consumer, or persisted raw full receipt existed, the current product cannot create a workspace, and SQLite stores only the existing receipt digest/closed projection. The old shape is rejected with no reader, alias, fallback, migration, dual write, or deprecation window. This closes v1 again; any later required field or identity change requires ato.workspace/v2.",
        "source": "current user fresh-only authorization; docs/reference/versioning-compatibility-contract.md RC03 and adapter-major rules; package.json; docs/reference/persistence-contract.md"
      },
      {
        "id": "C17",
        "statement": "The exact production-source count and package-root runtime export list remain single-owner closed inventories: scripts/lint.mjs and scripts/repo-utils.mjs must agree on exactly 46 production source files after adding src/workspace-git-adapter.ts, while test/domain-architecture.test.mjs must add only the approved adapter factory, ID/version constants, and narrow public configuration/result types to its exact root-export list. docs/reference/persistence-contract.md must replace only the stale test-Fake-only/no-production-adapter status with the truthful distinction that the SQLite schema, durable writer/reader/coordinator ownership, digest/closed projection, and product/CLI non-wiring remain unchanged while one production adapter library implementation now exists. None of these inventory/status edits grants a product, cleanup, support, schema, or persistence-semantic expansion.",
        "source": "scripts/lint.mjs; scripts/repo-utils.mjs; test/domain-architecture.test.mjs; docs/reference/persistence-contract.md; docs/reference/contract-ownership.md"
      }
    ],
    "authorization": {
      "allowed": [
        "Create, independently audit, and activate this one EP-03B plan; modify only task-owned files in the coordinator-owned ep-03b worktree; run local read-only inspection, build, tests, and disposable fixture operations.",
        "Implement and package one production Windows local Git WorkspaceBackend plus the exact fresh-only ownershipBindingSha256 port/application reset and internal static worker modes that invoke only the configured absolute local git.exe and Node executable against explicitly configured disjoint trusted roots and closed Git topology.",
        "Create fresh disposable local Git repositories only inside the repository-owned ignored .task-artifacts mechanism, with no remote and only synthetic fixture data, worktree registrations, junction/symlink/path-race/admin-swap negatives, physical-manifest partial states, and bounded process interruption/lost-response simulations; remove only exact verified disposable fixture roots through existing test ownership helpers.",
        "Update current contracts, architecture/status text, compatibility evidence, package/source inventories, and tests to truthfully distinguish the implemented adapter from still-absent policy/product/integration/cleanup/support behavior.",
        "Run impact-selected checks, pnpm verify:offline, package smoke, SQLite/Codex feasibility boundaries, documentation/link checks, git diff --check, and exact inventory checks. Do not run pnpm dependency:audit or any registry/network advisory query under the current user's explicit no-network boundary; instead record V14 as not applicable, verify the offline dependency shape, and make no vulnerability-status claim.",
        "Use fresh independent read-only reviewers for A0, A1, and required A2; persist bounded task evidence and disposition findings without granting new authority.",
        "Create one terminal task-result commit with only task-owned paths, invoke standing-authorized pathless prune-artifacts after that commit, record the seventeen frozen exact-head Git-flow gates, mark ready, perform FF-only local integration, and invoke the standing-authorized ordinary non-force push to origin/master."
      ],
      "requires_reapproval": [
        "Any ato.workspace/v1 change beyond the exact ownershipBindingSha256 subject/receipt reset, any database schema change, authorization vocabulary/confirmation change, public CLI/API command, product-runtime wiring, ProjectPolicy/CompletionBackend/gate/integration/ref/push/cleanup effect, scheduler/Codex/MCP/service behavior, platform-support claim, compatibility reader, or historical-baseline acceptance.",
        "Any access to this repository or another non-disposable repository as an adapter Project, D:\\quant, a remote, network, credential, secret store, pull request, non-FF merge, force operation, release, deployment, or coordinator cleanup.",
        "Any production fallback that cannot prove anchored containment, any recursive or forced deletion, any repository-selected executable/command/environment, or any widening from exact commit OID to a mutable ref.",
        "Any task-path expansion, material approval-contract change, ambiguous base transition, or architecture/authority conflict not resolved by this contract."
      ],
      "prohibited": [
        "Create or activate EP-03C before EP-03B's unique terminal commit is completed, integrated, and pushed through the applicable Git-flow state.",
        "Use a real external Project, mutate master/origin outside harness-git-flow, configure or contact a remote, read credentials, invoke Task content, Codex, scheduler, MCP, release, deployment, or D:\\quant.",
        "Perform production workspace cleanup, recursive removal, forced Git worktree removal, reset, force checkout, ref rewrite, force push, history rewrite, stash, clean, schema repair, historical evidence rewrite, or fabricated passing evidence.",
        "Treat a raw path, marker file, directory, Git registration, branch similarity, HEAD similarity, request text, Git output, or adapter receipt alone as ownership or policy authority.",
        "Describe the adapter or one-host fixture evidence as released, generally supported, sandboxed, race-free against privileged actors, integrated into the product, or sufficient for EP-03C completion."
      ],
      "persistence": {
        "required": true,
        "action": "Persist one terminal EP-03B task-result commit containing the completed ExecPlan and exact task-owned adapter/tests/docs/evidence, then compose current-head plan receipts with harness-git-flow artifact pruning, seventeen frozen gates, readiness, FF-only master integration, and the standing-authorized ordinary origin/master push.",
        "source": "current user request; docs/plans/README.md; docs/reference/local-agent-git-flow.md"
      }
    },
    "scope": {
      "task_paths": [
        {"path": "AGENTS.md", "kind": "file"},
        {"path": "ARCHITECTURE.md", "kind": "file"},
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "README.md", "kind": "file"},
        {"path": "docs/README.md", "kind": "file"},
        {"path": "docs/adr/ADR-009-workspace-ownership-and-safe-integration.md", "kind": "file"},
        {"path": "docs/compatibility/v0.1.md", "kind": "file"},
        {"path": "docs/plans/proposals/EP-03B-windows-git-workspace-adapter.md", "kind": "file"},
        {"path": "docs/plans/proposal/EP-03B-windows-git-workspace-adapter.md", "kind": "file"},
        {"path": "docs/plans/active/EP-03B-windows-git-workspace-adapter.md", "kind": "file"},
        {"path": "docs/plans/completed/EP-03B-windows-git-workspace-adapter.md", "kind": "file"},
        {"path": "docs/plans/evidence/EP-03B", "kind": "directory"},
        {"path": "docs/reference/adapter-contracts.md", "kind": "file"},
        {"path": "docs/reference/authorization-contract.md", "kind": "file"},
        {"path": "docs/reference/cli-contract.md", "kind": "file"},
        {"path": "docs/reference/completion-workspace-contract.md", "kind": "file"},
        {"path": "docs/reference/contract-ownership.md", "kind": "file"},
        {"path": "docs/reference/persistence-contract.md", "kind": "file"},
        {"path": "docs/reference/reliability-protocol.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "docs/reference/validation-policy.md", "kind": "file"},
        {"path": "docs/reference/versioning-compatibility-contract.md", "kind": "file"},
        {"path": "docs/security/privacy-and-logging.md", "kind": "file"},
        {"path": "docs/security/threat-model.md", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "scripts/lint.mjs", "kind": "file"},
        {"path": "scripts/repo-utils.mjs", "kind": "file"},
        {"path": "src/index.ts", "kind": "file"},
        {"path": "src/node-builtins.d.ts", "kind": "file"},
        {"path": "src/workspace-application.ts", "kind": "file"},
        {"path": "src/workspace-git-adapter.ts", "kind": "file"},
        {"path": "src/workspace-port.ts", "kind": "file"},
        {"path": "test/application-cli-module-architecture.test.mjs", "kind": "file"},
        {"path": "test/domain-architecture.test.mjs", "kind": "file"},
        {"path": "test/fixtures/fake-workspace-backend.mjs", "kind": "file"},
        {"path": "test/fixtures/workspace-git-fixture.mjs", "kind": "file"},
        {"path": "test/package-boundary.test.mjs", "kind": "file"},
        {"path": "test/workspace-application.test.mjs", "kind": "file"},
        {"path": "test/workspace-git-adapter-contract.test.mjs", "kind": "file"},
        {"path": "test/workspace-git-command-security.test.mjs", "kind": "file"},
        {"path": "test/workspace-git-recovery.test.mjs", "kind": "file"},
        {"path": "test/workspace-git-security.test.mjs", "kind": "file"},
        {"path": "test/workspace-git-worktree-e2e.test.mjs", "kind": "file"},
        {"path": "test/workspace-port-contract.test.mjs", "kind": "file"},
        {"path": "test/workspace-recovery.test.mjs", "kind": "file"},
        {"path": "test/workspace-security.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "Freeze one independently approved EP-03B contract that proves the EP-03A terminal chain, exact adapter/product/policy allocation, trusted root and Git boundary, Windows anchored-path strategy, cleanup refusal, fixture-only external effects, public export boundary, and binary validation matrix.",
        "validation_ids": ["V1", "V2", "V3"]
      },
      {
        "id": "M2",
        "outcome": "Implement and export the narrow Windows Git WorkspaceBackend factory with exact configuration validation, the fresh ownershipBindingSha256 port/application reset, owner-derived topology, complete mutation-namespace anchors, safe regular-file materialization, hardened Git templates, restart-readable ownership evidence, authoritative observation, receipt/inventory construction, and deterministic cleanup denial while preserving the existing lifecycle/persistence owners.",
        "validation_ids": ["V2", "V3", "V4", "V5", "V7", "V9", "V10"]
      },
      {
        "id": "M3",
        "outcome": "Close the real disposable-repository behavior and threat matrix for reserve/create/inspect/recover, exact replay, partial/lost response, registration/HEAD/ownership conflicts, spaces/Unicode, symlink/junction/traversal/case/path-swap attempts, hostile Git config/content/output, dirty inventory, interruption, and zero cleanup effect.",
        "validation_ids": ["V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9"]
      },
      {
        "id": "M4",
        "outcome": "Synchronize architecture, current contracts, threat/privacy status, compatibility evidence, package/root exports, source inventory, package smoke, and toolchain/validation documentation without claiming product wiring, cleanup, integration, or platform support.",
        "validation_ids": ["V10", "V11", "V12", "V13"]
      },
      {
        "id": "M5",
        "outcome": "Complete fresh independent A1/A2 as required, impact-selected and full repository gates, exact inventory, terminal plan persistence, current-head artifact prune, all seventeen Git-flow receipts, FF-only integration, and applicable ordinary push before EP-03C creation.",
        "validation_ids": ["V12", "V13", "V14", "V15"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "ExecPlan schema, serial predecessor, scope, and activation readiness",
        "criterion": "exec_plan.py trace returns schema v3, ok=true, errors=[], outside_scope=[], overlap=[], pre_existing_dirty=[], exact base d0ed2d85c2908e36f8b97a450366ee85ab72368f, and a fresh independent A0 with the exact approval digest/material base and findings=[]; terminal-resolve for EP-03A returns exactly that commit, chain-check accepts this successor, and no EP-03C lifecycle file exists."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Exact ato.workspace/v1 adapter contract and operation semantics",
        "criterion": "The shared hostile-shape/operation suite and production-adapter contract tests exit 0 with zero fail/skip/todo: the sole current ato.workspace/v1 requires exact 64-hex ownershipBindingSha256 in subject and receipt with no old-shape acceptance; the application derives/echo-verifies it from the durable generation tuple; only exact adapter ID/version requests are accepted; reserve/create/inspect/recover produce parser-valid combinations; exact replay is stable; foreign, stale, malformed, duplicate, and incompatible state never becomes success; and the durable SQLite schema meaning is unchanged."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Authorization and cleanup boundary",
        "criterion": "Focused application/adapter tests prove backend invocation still occurs only after the existing current prepare/Act chain and outside writer transactions, adapter data cannot authorize a lifecycle transition, product-runtime/CLI never construct the adapter, and every production cleanup request returns exact non-retryable policy_denied with zero Git calls and byte-identical workspace/repository state."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Windows contained path, reparse, and anchored no-follow-equivalent safety",
        "criterion": "Repository-owned disposable Windows tests prove drive-qualified non-root normalized roots, bidirectional Project/workspace non-overlap, exact mapping keys, hashed topology, component identity checks, and refusal of junction/symlink/alias/traversal/ADS/device/share/case-conflict/root/foreign targets. They prove both the target and linked-admin complete path at below-bound and exact 240 UTF-16 code units, exact workspace_target_too_long/workspace_admin_too_long refusal immediately above 240 before registration/target/Git mutation, canonical positive-decimal generation text, and zero outside-root writes. They prove complete-window anchors and EBUSY/EPERM rename prevention for workspace root/target, Project root, exact .git common directory, worktrees directory, adapter-created linked admin directory, object directory, and every materialized target directory; atomic mkdir create-if-absent for the exact admin/target leaf; exclusive final-leaf held-descriptor writes for every admin control file, target .git file, ownership manifest and regular blob; and zero Git mutation for gitfile, bare/separate common-dir, alternate/external object, promisor/partial clone, any pre-existing/foreign registration leaf, target-child/common-dir/admin swap, failed capability probe, or pre-registration identity change. No required negative produces an outside-root write; post-first-leaf uncertainty is explicit partial/ambiguous evidence."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Git command and repository-content security",
        "criterion": "Static and runtime tests prove one configured absolute regular git.exe, shell=false, closed argv templates, exact full commit OID, bounded time/output, minimal allowlisted environment, prompt/credential/network/lazy-fetch/replacement/hook/fsmonitor/maintenance/gc/pager suppression, and no raw error propagation. The adapter, not Git, acquires and writes the closed linked-worktree registration under held namespaces; no git worktree add or checkout command exists. Git only validates the resulting registration, reads already-local objects, updates the held linked index and performs read-only inspection. Injection-bearing IDs/refs/paths/config, filters, symlink/gitlink/non-blob or Windows-unsafe/colliding/oversized tree entries, hostile attributes/hooks/aliases/pagers/helpers, alternates/promisor state, and oversized or malformed NUL output are refused without executing repository code or contacting a remote."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Real disposable Git worktree lifecycle",
        "criterion": "On the exact local Windows fixture host and Git 2.53.0.windows.1, fresh repositories only under .task-artifacts paths covering spaces and NFC Unicode complete reserve -> adapter-owned exclusive linked-worktree registration -> direct exclusive final-manifest publication -> safe regular-file materialization -> create -> inspect with one detached worktree at the exact full base OID, exact owner-derived generation path and clean inventory; repeat reserve/create returns the matching already state; no remote exists or network/credential path is invoked; required tests have zero fail/skip/todo."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Ownership receipt and inventory integrity",
        "criterion": "Focused tests independently recompute ownershipBindingSha256 from the durable immutable generation tuple and match it across current request, parser-valid receipt and the canonical regular-file physical manifest acquired directly at its fixed final leaf inside the exact anchored linked-worktree admin directory, then match canonical Project/common/admin/target identity, authoritative registration, detached ref, base/HEAD, and inventory. Pre-existing final leaf, missing/truncated/extra/noncanonical manifest, interrupted held-descriptor write, marker-only or receipt-only state, rebuilt same-path/same-HEAD registration, and substitution of any root, registration, generation, creator, stable run/member/execution/fence member, OID or inventory yields partial/conflict/ambiguity and is never overwritten, repaired, or adopted."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Durable recovery with real adapter observation",
        "criterion": "Real SQLite/application plus repository-owned disposable Git tests cover response loss after adapter-owned registration, direct exclusive final-manifest publication and safe materialization; interruption after each created admin/target/control leaf, during the final-manifest held-descriptor write, during partial file inventory and before index update; absent/reserved/partial/complete recovery; exact finalized replay; stale fence/owner/revision refusal; and conflicting/rebuilt registration/HEAD/manifest. Restart invokes no blind create: three-way durable binding plus physical manifest plus current Git/filesystem observation reaches only the already defined durable state, while unknown/conflicting state remains recovery_required/ambiguous."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Redaction and hostile-output containment",
        "criterion": "Known sentinel path, Task/source text, environment, credential-shaped value, hook/filter/alias, Git stdout/stderr, URL, SQL, and stack values are absent from SQLite workspace rows/events, application/public results, fixed errors, evidence references, physical ownership manifest, and default diagnostics. The manifest contains only its closed schema, opaque hashes, versions and bounded identity facts; receipts add only ownershipBindingSha256 to the existing bounded fields; persisted state retains the existing digest/closed projection; and malformed output/evidence cannot become verified success."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "Package export and module ownership boundary",
        "criterion": "Strict typecheck and architecture/package tests prove one adapter implementation owner importing inward only from the port and allowed value utilities, one explicit package-root factory/constant/type surface, no worker/test seam root export, no application/persistence/dispatcher/product/CLI import of the concrete adapter, and no new production dependency. scripts/lint.mjs and scripts/repo-utils.mjs agree on the exact 46-file production source inventory, while test/domain-architecture.test.mjs accepts exactly the newly approved adapter factory/constants/narrow types and no other root export. Version-owner tests additionally prove the sole same-major current-v1 reset is named only in docs/reference/versioning-compatibility-contract.md, the required ownershipBindingSha256 shape has no old reader/alias/fallback, SQLite still persists only the existing digest/closed projection, and a later required workspace identity change is allocated to ato.workspace/v2."
      },
      {
        "id": "V11",
        "type": "manual",
        "target": "Truthful architecture, capability, compatibility, and non-claim boundary",
        "criterion": "Manual review of every changed source/doc/package surface finds the real Windows local adapter and disposable evidence described precisely, cleanup explicitly denied pending EP-03C policy, current product still Manual/no-workspace, no gate/integration/ref/push/scheduler/Codex/MCP/release/deployment behavior, no D:\\quant or real repository effect, no legacy compatibility path, and every compatibility row remains unverified with no general Windows/Git/platform support claim. The sole version owner records the exact 0.0.0-development/no-consumer/no-product/no-raw-receipt rationale for this named fresh-only v1 reset, rejects the old shape, closes v1 again, and states that the next required field/identity change is v2. The persistence contract truthfully distinguishes the new unwired production adapter library from the unchanged SQLite schema, durable coordinator/reader/writer ownership, digest/closed receipt projection, and no-product/no-CLI boundary."
      },
      {
        "id": "V12",
        "type": "automated",
        "target": "Impact-selected lint, typecheck, tests, and documentation",
        "criterion": "All focused adapter contract, authorization-boundary, cleanup-refusal, command-security, path-containment, worktree-E2E, ownership, recovery, redaction, package/architecture, and impacted existing workspace/persistence tests exit 0 with zero fail/skip/todo for required cases; pnpm lint, pnpm typecheck, pnpm build, pnpm test, pnpm docs:check, and git diff --check each exit 0."
      },
      {
        "id": "V13",
        "type": "automated",
        "target": "Complete offline repository and package gate",
        "criterion": "With exact Node 24.19.0, pnpm 11.19.0 and TypeScript 5.9.3 and network disabled, pnpm verify:offline exits 0 through lint, strict typecheck, build, complete tests, docs, dependency shape, package smoke, Windows SQLite feasibility and truthful blocked Codex boundary; packed inventory includes only the declared adapter artifacts and no task artifact survives."
      },
      {
        "id": "V14",
        "type": "not_applicable",
        "target": "Online dependency advisory query",
        "criterion": "Not applicable under the current user's explicit no-network boundary: pnpm dependency:audit and every registry/network advisory query are not run. The offline dependency-shape gate must still prove zero production dependencies and the exact TypeScript-only development lock shape is unchanged; this result makes no vulnerability-status claim."
      },
      {
        "id": "V15",
        "type": "manual",
        "target": "Terminal independent review, inventory, and Git-flow persistence",
        "criterion": "Fresh independent A1 and every required A2 are complete at the exact final material state with all findings closed; staged inventory contains only task-owned regular no-follow files and no sensitive runtime/evidence value; the completed plan is completion-ready and resolves to one terminal commit; current-head prune and all seventeen frozen Git-flow gates pass before ready, FF-only local integration, and ordinary origin/master push, with coordinator cleanup explicitly not run."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "A Project/workspace overlap or replacement of a root, Git common/object/worktrees/admin component, target directory, or regular leaf between checks can cause an outside-root mutation."},
      {"id": "R2", "risk": "A request identifier, mutable ref, Git output, or repository configuration can become a path/command/authority input and cross the trust boundary."},
      {"id": "R3", "risk": "A Git command, object topology, repository config, attribute, hook, filter, helper, lazy fetch, pager, or unsafe tree entry can execute repository-controlled behavior, redirect object access, or leak raw output."},
      {"id": "R4", "risk": "Worktree registration, manifest publication, regular-file materialization, or linked-index update can partially succeed while the response fails, and a blind retry can duplicate or adopt partial external state."},
      {"id": "R5", "risk": "A receipt or marker without the full durable generation binding and current physical/Git evidence can adopt a rebuilt same-path/same-HEAD workspace with the wrong owner, fence, registration, or inventory."},
      {"id": "R6", "risk": "Implementing cleanup before ProjectPolicy/gate/reservation/lease evidence exists can delete valid or user-owned work."},
      {"id": "R7", "risk": "Concrete adapter wiring can leak into application/product/CLI ownership or accidentally expose arbitrary filesystem/Git behavior."},
      {"id": "R8", "risk": "Raw paths, Git output, repository content, environment, or credential-shaped data can escape through errors, evidence, events, or fixtures."},
      {"id": "R9", "risk": "One-host fixture success can be overstated as a supported Windows/Git product guarantee despite unvalidated platform variants and privileged races."},
      {"id": "R10", "risk": "Large source/test/package/doc inventory changes, base movement, or stale independent evidence can be composed as a terminal result."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Implement one src/workspace-git-adapter.ts owner and explicitly export its stable adapter constants, factory, and narrow configuration types from src/index.ts; keep worker and test seams internal to that module and do not wire the factory into product-runtime or CLI. Update the two exact production-inventory owners to 46 files, add only those approved runtime exports to the package-root exact-export owner, and narrowly refresh the persistence contract's adapter-availability status without changing its schema/durable ownership semantics.",
        "rationale": "EP-03B must deliver production adapter code that EP-03C can compose without prematurely creating a product command or a second application owner."
      },
      {
        "id": "D2",
        "statement": "Resolve only exact preconfigured projectRootKey/workspaceRootKey mappings; encode workspace identity plus generation in the compact target name and the complete immutable generation tuple in the ownership-digest-derived linked-admin name under the normative topology; require baseReference to be the repository's exact 40- or 64-hex full commit OID.",
        "rationale": "Opaque protocol identifiers and mutable Git refs are not trusted filesystem or object selectors."
      },
      {
        "id": "D3",
        "statement": "Use same-module static worker/guard modes. A closed guard set holds verified current directories for workspace root/target, Project root, exact .git common directory, worktrees directory, linked admin directory, object directory, and each target tree directory through its entire relevant effect. The Project/common/admin guards atomically mkdir and enter the exact deterministic linked-admin leaf, exclusively create its closed control leaves and target .git file through held descriptors, then invoke only the absolute Git validation/object/index/inspection templates; the target guards create regular files exclusively and write through held descriptors. Each process emits only one bounded exact JSON/handshake, and no input is evaluated as code or a shell command.",
        "rationale": "The reviewed design must anchor every write namespace, not merely the two roots. Current-directory guards prevent directory/ancestor rename on the observed host, while exclusive create plus held file descriptors prevents a leaf reparse from redirecting a blob write."
      },
      {
        "id": "D4",
        "statement": "Preflight the exact locally present commit, closed main-worktree/common/object topology and complete tree; reject every unsafe or unsupported entry/config; construct the exact compatible detached linked-worktree registration by atomic directory acquisition and exclusive final-leaf writes inside held namespaces, without git worktree add; publish the ownership manifest by direct exclusive acquisition of its fixed final leaf in the held linked admin directory, with no temp/rename/replace path; materialize only regular blobs through exclusive held descriptors under the guarded target tree; update the exact linked index without checkout; and inspect authoritative NUL-delimited registration/status plus physical identities before success.",
        "rationale": "Avoiding Git checkout removes unanchored descendant writes and repository checkout extensions, while the ordered registration/manifest/materialization/index observations leave every partial state classifiable by recovery."
      },
      {
        "id": "D5",
        "statement": "Reset the sole current v1 subject/receipt with ownershipBindingSha256. The application derives it from its durable immutable generation tuple; the adapter echoes it, writes it into one canonical physical manifest bound to canonical root/common/admin/target/OID/registration facts, and on every later observation requires a three-way durable-request/manifest/live-state match. Receipt/evidence IDs remain canonical redacted digests and inventory remains counts; raw Git output/errors are discarded.",
        "rationale": "This is the smallest restart-verifiable ownership correction: no new SQLite row is needed, but path/registration/HEAD or a marker alone can no longer be adopted as ownership."
      },
      {
        "id": "D6",
        "statement": "Implement reserve as a no-adoption proof of exact base plus absent target/registration; create as exact adapter-owned exclusive registration, direct-exclusive final-manifest publication, safe regular-file materialization and index verification; inspect/recover as read-only authoritative three-way classification; and cleanup as unconditional stable policy_denied with zero worker or Git invocation.",
        "rationale": "This closes EP-03B's real creation/recovery allocation while retaining ProjectPolicy and real cleanup effect for EP-03C."
      },
      {
        "id": "D7",
        "statement": "Use fresh disposable Git repositories with no remotes only under .task-artifacts for all real effects, combine the real adapter with the existing durable application service for response-loss/restart tests, and use platform-anchor tests rather than touching this repository, OS temporary storage, or another real Project.",
        "rationale": "Real contract evidence is required, but authorization is limited to locally owned disposable fixtures."
      },
      {
        "id": "D8",
        "statement": "After a stable diff, reserve integration, assess any candidate base through the plan's base-transition rules, complete fresh A1/A2 and exact-state validation, then persist one terminal commit, pathless prune receipt, seventeen current-head gates, readiness, FF-only integration, and ordinary push.",
        "rationale": "ExecPlan review freshness and Git-flow coordinator receipts remain separate exact-head facts."
      }
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep the plan in proposal and make no implementation change until a fresh independent A0 accepts the complete path/Git/cleanup/product boundary; revise approval_contract and repeat A0 for any material gap."},
      {"id": "M2", "recovery": "Stop before any real fixture effect if complete namespace anchoring, trusted executable/root validation, the exact ownership-binding reset, manifest protocol, or public ownership cannot be proven; return the uncommitted task diff to the last strict typecheckable milestone without adding a fallback or retaining the old port shape."},
      {"id": "M3", "recovery": "Preserve only the exact disposable fixture long enough to inspect partial registration/HEAD facts, classify through the adapter's read-only recover path, and let the test ownership helper remove the verified fixture; never use production cleanup or force removal to hide a failure."},
      {"id": "M4", "recovery": "Correct the single authoritative status/contract/inventory owner and rerun its focused checks; do not mask a mismatch with a duplicate compatibility paragraph, broad export, or package exception."},
      {"id": "M5", "recovery": "A failed review or gate leaves ep-03b reserved and editable. Repair task-owned files, commit a new exact head only when plan order permits, refresh stale material evidence/receipts, and do not create EP-03C or run coordinator cleanup."}
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
      {"id": "V9", "state_binding": "material"},
      {"id": "V10", "state_binding": "material"},
      {"id": "V11", "state_binding": "material"},
      {"id": "V12", "state_binding": "material"},
      {"id": "V13", "state_binding": "material"},
      {"id": "V14", "state_binding": "material"},
      {"id": "V15", "state_binding": "material"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Reject root overlap and every unsupported Git topology; hold verified guards for both roots, common/object/worktrees/admin namespaces, target and all tree directories; materialize only prevalidated regular blobs with exclusive-create held descriptors; and postvalidate every identity.", "recovery": "If any required anchor/capability/identity is uncertain before registration, perform zero Git mutation and refuse; after effect-possible registration, retain explicit partial/ambiguity and require read-only recover observation."},
      {"id": "R2", "mitigation": "Use exact trusted key maps, fixed digest path components, canonical generation text, exact hex OIDs, closed operation templates, argument arrays, and no shell.", "recovery": "Reject before worker dispatch and add a hostile-input regression; never normalize an untrusted selector into authority."},
      {"id": "R3", "mitigation": "Use a minimal environment and command configuration that disables prompts, credentials, lazy fetch, replacements, hooks, filters, fsmonitor, maintenance, gc, pagers and external config; reject unsafe trees and never invoke Git checkout.", "recovery": "Treat any unexpected child execution/output/timeout as non-success or ambiguity, discard raw text, and inspect authoritative state without replay."},
      {"id": "R4", "mitigation": "Order exact admin/target mkdir acquisition, exclusive control-file registration, direct-exclusive final-manifest publication, regular-file materialization and linked-index update as separately inspectable stages after the existing effect-possible durable Act; classify each incomplete stage from authoritative inventory, manifest and HEAD/status.", "recovery": "Use the same request lineage's recover operation; never rerun create until absence/no-effect is independently proven by the durable protocol."},
      {"id": "R5", "mitigation": "Derive ownershipBindingSha256 in the application from the immutable generation tuple, echo it through the exact v1 receipt, publish the canonical physical facts by exclusive acquisition/write/fsync/reopen of the fixed final manifest leaf, and three-way verify durable request, manifest and live state with substitution/rebuild/restart tests.", "recovery": "Return conflict or ambiguous_external_state for any missing/mismatched evidence, retain recovery_required, and do not adopt, overwrite, repair or regenerate foreign state."},
      {"id": "R6", "mitigation": "Make production cleanup an unconditional policy_denied branch before any worker/Git call and test byte-identical state plus zero calls.", "recovery": "Leave the workspace intact and defer all cleanup-effect design/composition to EP-03C fresh planning and review."},
      {"id": "R7", "mitigation": "Keep the adapter inward of the port, explicitly root-export only its narrow factory/types, and assert no concrete-adapter import from application, persistence, dispatcher, product, or CLI modules.", "recovery": "Remove the leaking import/export at its owner and rerun architecture/package tests rather than adding another facade or generic endpoint."},
      {"id": "R8", "mitigation": "Map raw failures to fixed codes, hash bounded evidence, persist only existing receipt digests/closed facts, isolate synthetic sentinel fixtures, and scan all durable/public/default diagnostic projections.", "recovery": "Drop the unsafe field at the adapter boundary, invalidate only the disposable fixture, and rerun redaction tests; never persist then redact later."},
      {"id": "R9", "mitigation": "Record exact host/tool observations as unverified development evidence with explicit exclusions and capability-probe every mutation.", "recovery": "Remove or narrow any support statement and keep unsupported hosts fail-closed without inventing a compatibility fallback."},
      {"id": "R10", "mitigation": "Work in self-consistent milestones, trace before lifecycle/coordinator decisions, bind validation/review/gates to one material state, use base-diff for master movement, and verify exact source/package/staged inventories.", "recovery": "Stop mutation, classify approval/base impact, refresh A0/A1/A2 and gate evidence as required, and use only coordinator-owned recovery transitions."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "d0ed2d85c2908e36f8b97a450366ee85ab72368f",
      "current_material_base": "d0ed2d85c2908e36f8b97a450366ee85ab72368f",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-09-02 19:53:16+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-09-02 19:53:16+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-09-02 19:53:16+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-09-02 19:53:16+08:00"},
      {"id": "M5", "status": "complete", "updated_at": "2026-09-02 20:23:06+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "schema-v3 trace plus predecessor terminal-resolve and chain-check",
        "evidence": "Current trace returned ok=true with no errors, warnings, outside_scope, overlap, or pre_existing_dirty; fresh independent A0 bound approval SHA-256 011D3B2387C14ADE3C850250AC33E0B774B1D552F7F572D5F69182743F8A6C05 and base d0ed2d85c2908e36f8b97a450366ee85ab72368f. EP-03A terminal-resolve and successor chain-check both accepted that exact predecessor, and no EP-03C lifecycle file exists.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "focused port, adapter-contract, application, architecture, and persistence test selections",
        "evidence": "The complete Windows adapter selection passed 46/46 and the current adjacent workspace/application/architecture selection passed 70/70; the persistence repository/schema/smoke selection passed 47/47. Exact ownershipBindingSha256 parsing, derivation, echo verification, replay, refusal, and unchanged SQLite schema semantics all passed with zero fail, skip, or todo.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "focused authorization, application, cleanup-refusal, architecture, and byte-stability tests",
        "evidence": "Focused selections proved the existing application owner alone reaches the backend after prepare/Act and outside writer transactions, adapter output grants no lifecycle authority, product and CLI do not construct the concrete adapter, and cleanup returns policy_denied before root lookup, worker start, Git invocation, or byte change.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Windows path, topology, capability-probe, identity-drift, reparse, hardlink, and length-bound tests",
        "evidence": "The 22/22 security selection within the 46/46 adapter matrix passed every configured-root/topology/no-follow case, all eight cwd namespace-anchor probes, both production capability parents, canonical generation, target/admin paths below and at 240 UTF-16 code units, exact 241 refusal before mutation, pre-registration swaps, reparse and hardlink substitution, and conservative effect propagation with zero outside-root write.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "static command-template inspection and real disposable-repository command-security tests",
        "evidence": "The 10/10 command/repository-security selection passed closed argv, shell=false, trusted absolute executables, exact commit OID, bounded process/output, minimal environment, credential/network/hook/filter/helper suppression, hostile Git configuration and tree refusal, and absence of git worktree add or checkout mutation paths.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "real Windows disposable Git linked-worktree E2E",
        "evidence": "The E2E passed 1/1 on win32/x64 kernel 10.0.22631 with Node 24.19.0 and Git 2.53.0.windows.1: a no-remote repository beneath the registered task-artifact root completed reserve, exclusive detached registration, final manifest, safe materialization, create, inspect, clean inventory, and stable replay for spaces and NFC Unicode without network or credentials.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "ownership-binding, canonical-manifest, physical-inventory, registration-rebuild, and substitution tests",
        "evidence": "Focused ownership tests independently recomputed and matched the durable request, parser-valid receipt, canonical manifest, physical identities, registration, detached HEAD, base OID, and inventory. Missing, extra, noncanonical, truncated, pre-existing, rebuilt, substituted, or hardlinked evidence remained partial, conflicting, or ambiguous and was never adopted or overwritten.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "10-case adapter recovery selection plus real SQLite/application restart tests",
        "evidence": "Recovery passed 10/10 after the recorded deterministic fixture-label correction, including lost response, close/reopen recovery without a second create, stage interruptions, partial and complete observation, stale ownership/fence refusal, and post-mkdir identity failure. Effect-possible uncertainty persists intent=ambiguous and generation=recovery_required; no blind create replay or unproved cleanup occurs.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "hostile-output, sentinel, persistence-projection, manifest, result, and default-diagnostic tests",
        "evidence": "Sentinel paths and content, request text, environment and credential-shaped values, Git output and errors, URLs, SQL, and stacks were absent from durable rows/events, public results, fixed errors, evidence references, canonical manifests, receipts, and default diagnostics; malformed output never became verified success.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "strict typecheck, build, module-architecture, package-boundary, source-inventory, dependency-shape, and package-smoke checks",
        "evidence": "Typecheck and build exited 0; architecture and package tests kept the adapter inward of the port with only the approved root factory/constants/types and no worker seam or product/CLI/persistence construction. Lint owners agreed on exactly 46 production files, production dependencies remained zero with only TypeScript 5.9.3 in development, and package smoke passed with 184 declared packed files.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "manual authority/capability/compatibility review plus full documentation-gardener scan",
        "evidence": "Manual review found one truthful library-only Windows adapter claim, unconditional cleanup refusal pending EP-03C, unchanged Manual product/CLI and SQLite ownership, no integration/ref/push/scheduler/Codex/MCP/release/deployment behavior, no compatibility reader, and all support rows unverified. Documentation gardening reported no blocking findings across 137 Markdown files, with zero HIGH/MEDIUM/LOW issue or candidate; repository policy SHA-256 was ded78c74e14a9dbd7e4321ddf01e788fca5b17c96ea39dbdddc2d14b36f37ab7.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V12",
        "status": "passed",
        "method": "focused impact suites, complete test suite, lint, typecheck, build, docs check, and git diff --check",
        "evidence": "Focused current selections passed 46/46 Windows adapter, 70/70 adjacent workspace/application/architecture, and 47/47 persistence tests. pnpm test passed 539/539 with zero fail/skip/todo; lint passed 264 files and 46 source files; typecheck, build, docs, and git diff --check all exited 0. Diff check emitted only informational line-ending warnings.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V13",
        "status": "passed",
        "method": "network-disabled pnpm verify:offline and package smoke with the bundled exact toolchain",
        "evidence": "pnpm verify:offline exited 0 through lint 264/46, strict typecheck, build, 539/539 tests, docs 137 Markdown/261 links/22 fragments/zero forbidden, offline dependency shape, 184-file package smoke, complete Windows SQLite feasibility with zero surviving generation members, and the truthful blocked Codex boundary externalE2E=not_run/supportClaim=false. The command created no surviving task artifact; the separately recorded earlier diagnostic generation remains frozen for the standing-authorized post-result-commit coordinator prune.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V14",
        "status": "not_applicable",
        "method": "authorization check and offline dependency-shape evidence only",
        "evidence": "The current user explicitly prohibits real network access, so pnpm dependency:audit and every registry/network advisory query were not run. Offline checks proved zero production dependencies and the unchanged TypeScript-only development lock shape; no vulnerability-status claim is made.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      },
      {
        "id": "V15",
        "status": "passed",
        "method": "fresh independent exact-state A2, no-follow task inventory, and terminal pre-commit handoff review",
        "evidence": "Fresh independent A2 attempt 3 reproduced approval bytes 42277, approval SHA-256 011D3B2387C14ADE3C850250AC33E0B774B1D552F7F572D5F69182743F8A6C05, exact base d0ed2d85c2908e36f8b97a450366ee85ab72368f, and final material state git-sha1:382bf2dce780d8d44c27b107589355c170b0dace; it closed all four A1 findings with findings=[], closure_safe=true, and completion_safe=true. The exact 48-path task diff inventory contains only approved regular non-reparse files, with no outside-scope, overlapping, pre-existing-dirty, or untracked entry. This completed candidate delegates the still-unperformed result commit, pathless artifact prune, 17 exact-head gates, readiness, FF-only integration, and standing-authorized ordinary push to the Git-flow coordinator. Cleanup remains unauthorized and no network advisory query was run.",
        "state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/ep03b_a0_7",
        "independence": "Fresh independent strictly read-only A0 reviewer. The reviewer did not participate in proposal drafting, implementation, repair, or prior audits; did not edit files or mutate Git, ExecPlan, coordinator, fixture, product, external, network, credential, cleanup, integration, push, release, deployment, or D:\\quant state; and did not run Node, pnpm, npm, npx, tests, builds, or fixtures.",
        "scope": "AGENTS.md, ARCHITECTURE.md, the complete schema-v3 EP-03B proposal, PLAN-SCHEMA, A0-AUDIT, the applicable Tier-2 persistence lens, current trace, plan lifecycle and Git-flow authority, toolchain and validation contracts, workspace/adapter/reliability/authorization/persistence/versioning/security/privacy owners, package.json, pnpm-lock.yaml, and targeted port/application/adapter/export source facts. The review non-fail-fast checked the complete approval_contract and execution_contract, emphasizing the terminal no-network authorization revision, V14 type/criterion, offline dependency coverage, unchanged implementation/material envelope, and absence of product, cleanup, schema, compatibility, support, credential, external-repository, or unauthorized external-write expansion.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-02 19:51:47+08:00",
        "approval_sha256": "011D3B2387C14ADE3C850250AC33E0B774B1D552F7F572D5F69182743F8A6C05",
        "reviewed_material_base": "d0ed2d85c2908e36f8b97a450366ee85ab72368f",
        "evidence": "One independent read-only exec_plan.py trace returned ok=true, errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], exact approval/current material base and HEAD d0ed2d85c2908e36f8b97a450366ee85ab72368f, and current material state git-sha1:b32b63b5f2df4a4d9acb4879bc68ed2a8a5e7988. An independent canonical JSON calculation reproduced 42277 UTF-8 bytes and uppercase SHA-256 011D3B2387C14ADE3C850250AC33E0B774B1D552F7F572D5F69182743F8A6C05. The revised authorization explicitly forbids pnpm dependency:audit and every registry/network advisory query, while V14 is correctly typed not_applicable and has a binary criterion requiring those queries not to run, requiring the offline dependency-shape proof, and prohibiting any vulnerability-status claim. V10, V13, the toolchain contract, package.json, and pnpm-lock.yaml retain the necessary offline proof: no production dependencies and exactly TypeScript 5.9.3 as the sole development dependency with the unchanged lock shape; verify:offline excludes dependency:audit. The revision neither adds nor removes task paths, changes the adapter/application/product outcome, alters the current SQLite schema or durable writer/reader closure, grants cleanup or product wiring, introduces compatibility/support claims, nor changes the reviewed material state. The applicable Tier-2 transition requirements remain closed by the existing durable intent/observation/verification/finalization, immutable ownership binding, three-way physical recovery, no-blind-replay, writer/reader closure, fail-closed topology, and binary V2/V4/V7/V8 coverage. No additional authorization or validation gap was found.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/ep03b_a1_1",
        "independence": "Fresh independent non-implementer strictly read-only A1 reviewer. The reviewer did not implement or repair the change, edit repository or external state, run write-producing product tests, mutate Git or coordinator state, grant authority, use network or credentials, inspect another repository, or perform cleanup, integration, push, release or deployment.",
        "scope": "The exact approved EP-03B implementation state; active schema-v3 plan and prior evidence; authoritative workspace topology, adapter, reliability, authorization, persistence, compatibility, security and privacy contracts; the concrete Windows Git adapter, application binding, port reset, fixtures, focused contract/security/recovery/E2E tests, exports and architecture checks. The review checked approved outcomes, mutation-boundary safety, preflight rejection, durable effect classification, physical ownership/inventory integrity, recovery behavior, scope and external-action boundaries.",
        "reviewed_at": "2026-09-02 18:21:20+08:00",
        "evidence": "The reviewer reproduced approval SHA-256 42CE09525A869C8A91E8DD8DDF9025D254CE2240C497486D0F50158265F349E6, base d0ed2d85c2908e36f8b97a450366ee85ab72368f and exact material state git-sha1:fa5b42e105bbc2280f621cd0303765b582698203. Read-only source review found four concrete defects. The parent independently reproduced every cited path: no production filesystem capability attestation precedes registration; parseTree loses original directory-prefix spelling; workerStageObjects discards worktrees.created; and complete inspection does not require a single-link stable index. All findings are confirmed, in scope and task-diff-changing. Their original evidence and parent reproduction are persisted in docs/plans/evidence/EP-03B/a1-implementation-audit.md; repair and fresh exact-state A2 are mandatory.",
        "reviewed_state_id": "git-sha1:fa5b42e105bbc2280f621cd0303765b582698203",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-A1-EP03B-001",
            "severity": "HIGH",
            "summary": "Production reaches the registration mutation namespace without a real configured-filesystem capability probe proving current-directory and ancestor rename prevention.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Add a fail-closed positive-control plus held-current-directory rename attestation under each approved mutation parent before acquiring registration leaves, with exact effect propagation and failed-probe zero-registration-mutation evidence.",
            "closure_evidence": "At git-sha1:b32b63b5f2df4a4d9acb4879bc68ed2a8a5e7988, production performs an ownership-bound positive-control and nested cwd-rename refusal probe under both exact mutation parents before either registration leaf. A pre-existing probe destination preserves the complete fixture digest and Git inventory and creates no target/admin/registration; a post-mkdir identity failure retains its effect without unproved cleanup. The complete 46-test Windows adapter selection, current 70-test adjacent workspace/application/architecture selection, 47-test persistence selection, lint, typecheck, build, docs, offline dependency-shape and package-smoke checks pass. Fresh independent A2 attempt 2 closed this finding with no residual finding.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03B-002",
            "severity": "MEDIUM",
            "summary": "parseTree retains only folded directory prefixes, so differently cased directory spellings can reach mutation before refusal on Windows.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Map every folded directory prefix to its original spelling and reject any spelling mismatch during preflight, with a zero-mutation regression.",
            "closure_evidence": "At git-sha1:b32b63b5f2df4a4d9acb4879bc68ed2a8a5e7988, parseTree maps each folded directory prefix to its original spelling. A real commit containing Dir/a.txt plus dir/b.txt returns case_colliding_tree before .git/worktrees, target, admin, or registration creation; the complete 46-test Windows adapter selection and all adjacent primary checks pass. Fresh independent A2 attempt 2 closed this finding with no residual finding.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03B-003",
            "severity": "MEDIUM",
            "summary": "workerStageObjects can create .git/worktrees but discard that effect when a downstream stage reports no effect.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Propagate the logical OR of every upstream namespace/probe effect and downstream effect, then prove deterministic post-parent failure maps to ambiguous_external_state and durable recovery_required.",
            "closure_evidence": "At git-sha1:b32b63b5f2df4a4d9acb4879bc68ed2a8a5e7988, workerStageObjects propagates the logical OR of worktrees acquisition, both capability stages, and downstream effects, while the closed directory-acquisition result retains a successful mkdir effect across immediate identity failure at every caller. Deterministic post-parent and post-mkdir failures return ambiguous_external_state, and both real SQLite application paths persist the create intent as ambiguous and generation as recovery_required without target/admin/registration creation; the complete 46-test Windows adapter selection and all adjacent primary checks pass. Fresh independent A2 attempt 2 closed this finding and F-A2-EP03B-001 with no residual finding.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03B-004",
            "severity": "MEDIUM",
            "summary": "Complete inspection accepts an unchanged-byte hardlinked linked-admin index because it does not require a stable single-link regular file.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Require the index identity to remain stable and have nlink equal to one, with a hardlink negative inspection regression returning inspected_partial without mutation.",
            "closure_evidence": "At git-sha1:b32b63b5f2df4a4d9acb4879bc68ed2a8a5e7988, inspectPhysical captures a single-link regular index identity and requires the same identity and nlink=1 after Git status. An unchanged-byte hardlink replacement returns inspected_partial with null registration identity and byte-stable fixture state; the complete 46-test Windows adapter selection and all adjacent primary checks pass. Fresh independent A2 attempt 2 closed this finding with no residual finding.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "/root/ep03b_a2_1",
        "independence": "Fresh independent non-implementer and non-repairer strictly read-only A2 attempt 3. The reviewer edited no file, ran no Node, pnpm, npm, npx, test, build, or fixture command, did not inspect ignored artifact contents, and performed no network, credential, external-repository, Git, ExecPlan, coordinator, cleanup, integration, push, release, or deployment mutation.",
        "scope": "The exact final schema-v3 plan and material inventory, A1 report and parent dispositions, A2 attempt history, validation evidence, authoritative workspace/reliability/persistence/authorization contracts, all four A1 finding roots, the prior A2 effect-classification residual, and the mechanical A1-evidence EOF-only delta from the prior successful A2 state under the implementation and Tier-2 persistence lenses.",
        "reviewed_at": "2026-09-02 20:21:16+08:00",
        "evidence": "Fresh read-only trace returned ok=true with empty errors, warnings, outside_scope, overlap, and pre_existing_dirty; the reviewer independently reproduced approval canonical bytes 42277, SHA-256 011D3B2387C14ADE3C850250AC33E0B774B1D552F7F572D5F69182743F8A6C05, base and HEAD d0ed2d85c2908e36f8b97a450366ee85ab72368f, and exact state git-sha1:382bf2dce780d8d44c27b107589355c170b0dace. Direct blob diff from the prior A2-reviewed A1 evidence to the current blob removed only one final empty EOF line, while all implementation, test, contract, and closure objects remained unchanged. The configured-filesystem capability probe, directory-prefix case collision rejection, complete effect propagation including post-mkdir identity failure, stable single-link admin index inspection, durable ambiguity/recovery-required persistence, and no-blind-replay behavior continue to close F-A1-EP03B-001 through F-A1-EP03B-004 and the prior A2 residual. The reviewer found no Tier-2 writer/reader, identity/policy, pre-mutation fail-closed, topology, inventory, terminal-evidence, recovery, scope, or authorization regression. Parent-supplied validation at this exact state passed the network-disabled complete offline route with 539/539 tests and the full documentation gardener; the reviewer did not rerun those commands.",
        "reviewed_state_id": "git-sha1:382bf2dce780d8d44c27b107589355c170b0dace",
        "parent_disposition": "complete",
        "closes": ["F-A1-EP03B-001", "F-A1-EP03B-002", "F-A1-EP03B-003", "F-A1-EP03B-004"],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-A0-01", "F-A0-02", "F-A0-03"],
        "disposition": "superseded",
        "reason": "Fresh independent A0 confirmed three approval-contract gaps before implementation: Project/workspace overlap and the complete Git/target mutation namespace were not closed by the two-root cwd anchor; no restart-verifiable physical ownership evidence bound the durable creator/run/execution/fence lineage; and OS-temporary real fixtures conflicted with external_paths=[]. The parent confirmed all three, persisted the exact report, revised the port/application ownership-binding scope, closed repository topology/anchors/materialization/manifest recovery, and constrained every fixture to .task-artifacts; fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-A0-04", "F-A0-05", "F-A0-06"],
        "disposition": "superseded",
        "reason": "Fresh independent A0 confirmed three remaining approval-contract gaps before implementation: git worktree add creates the linked-admin child before the adapter can anchor it; a temporary manifest plus Windows rename does not provide atomic no-replace publication; and the required same-major port field contradicted the sole version owner while that owner was outside task scope. The parent confirmed all three, persisted the exact report, replaced Git-owned registration with adapter-owned atomic admin/target acquisition and exclusive control-leaf construction, replaced temp/rename publication with direct exclusive final-manifest acquisition, and brought the sole version owner into scope with one named unreleased fresh-only ato.workspace/v1 reset that rejects the old shape and closes v1 again; fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "failed",
        "finding_ids": ["F-A0-07", "F-A0-08"],
        "disposition": "failed",
        "reason": "This review is invalid and non-canonical because the reviewer accidentally invoked pnpm exec node --version, which attempted a registry request and created the ignored worktree node_modules dependency tree. No cleanup, rollback, Git/index/coordinator mutation, product test, or successful external operation followed. Its non-fail-fast static evidence still identified two material approval gaps: scripts/lint.mjs and test/domain-architecture.test.mjs were omitted despite owning exact production-source/runtime-export gates, and docs/reference/persistence-contract.md was omitted despite owning stale Fake-only/no-production-adapter status. The parent independently confirmed the tracked tree and manifests were unchanged, persisted the invalid-attempt evidence without concealing the ignored artifact or failed request, scoped all three owners with narrow binary outcomes, and requires a different fresh strictly read-only reviewer."
      },
      {
        "audit": "A0",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "The parent later detected that the approved exact target topology still named the longer runs/r-<digest>/workspaces/w-<digest>/g<generation> path while the implementation had been shortened to remain under the approved Windows path bound. Work stopped before A1 or terminal gates. The old no-finding A0 remains valid evidence for its exact prior approval bytes but cannot approve the compact target/admin topology; the approval goal/C5 and execution decision D2 were revised, and a different fresh independent A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 5,
        "report_status": "complete",
        "finding_ids": ["F-A0-09", "F-A0-10"],
        "disposition": "superseded",
        "reason": "Fresh independent strictly read-only A0 confirmed two approval defects. F-A0-09 found the sole topology owner still named a nonexistent run-root path level despite the compact C5/D2 topology. F-A0-10 found that the exact 240 UTF-16 target/admin limit lacked both authoritative contract ownership and below/at/above binary validation. The parent confirmed both, updated only the approved topology owner and C5/V4 criterion, preserved run lineage solely in ownershipBindingSha256, and requires a different fresh independent A0 before activation or test implementation."
      },
      {
        "audit": "A0",
        "attempt": 6,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "The parent detected at terminal validation that the approved V14 and authorization text still permitted and required pnpm dependency:audit, while the current user's controlling goal explicitly prohibits real network access. No query was run and no passing security evidence was fabricated. The old no-finding A0 remains valid only for its exact prior approval bytes; authorization is narrowed to prohibit every registry/network advisory query, V14 becomes not_applicable with an offline dependency-shape check and no vulnerability-status claim, and a different fresh independent A0 is required. This revision does not change the implementation envelope, product outcome, material task state, cleanup stance, schema, compatibility, support or external-write scope."
      },
      {
        "audit": "A2",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-A2-EP03B-001"],
        "disposition": "reopened",
        "reason": "Fresh independent A2 at git-sha1:3699af145aea6aef189e0a8f9ab856db50d23af6 confirmed the principal repairs for all four A1 findings but found one same-family local effect-classification residual. After mkdirSync acquires a directory, ensureDirectoryChild can lose the created fact if identityFor throws, and four no-effect catches can therefore return conflict despite an adapter-created namespace. The parent independently reproduced the call graph and confirmed the finding in scope. The approved strategy and envelope remain stable; preserve the acquisition fact through every caller, add deterministic durable recovery evidence, revalidate, and fresh-rerun this same A2 without reopening A1."
      },
      {
        "audit": "A2",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "Fresh independent A2 closed all four A1 findings and the prior same-family A2 residual at git-sha1:b32b63b5f2df4a4d9acb4879bc68ed2a8a5e7988. The terminal staged diff check then detected one extra blank line at EOF in the task-owned historical A1 evidence file. The parent removed only that blank line to satisfy the mandatory whitespace gate; no implementation, test meaning, authorization, scope, strategy, finding closure, product, cleanup, schema, compatibility, support, or external-action boundary changed. Because this mechanical evidence-only edit changes the exact material state, the successful report is retained as stale and fresh exact-state A2 is required."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V8",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-09-02 19:12:00+08:00",
        "evidence": "The first focused recovery run after F-A2-EP03B-001 repair passed all nine existing cases but rejected the new test fixture before product execution because its generation prefix exceeded the repository-owned fixture grammar. The parent shortened only that test-owned label; the same ten-test file then passed 10/10 and the complete Windows adapter selection passed 46/46. No external, product, Git/coordinator, cleanup, network, credential, D:\\quant, Codex, scheduler, MCP, release or deployment state was changed.",
        "state_id": null
      },
      {
        "validation_id": "V12",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-09-02 19:58:18+08:00",
        "evidence": "The first terminal staged git diff --cached --check returned nonzero for one new blank line at EOF in docs/plans/evidence/EP-03B/a1-implementation-audit.md. The parent removed only that final blank line with no content, implementation, test, authorization, scope, strategy, compatibility, support, or external-state change. Fresh exact-state validation and A2 are required; the failed result is not treated as passing evidence.",
        "state_id": "git-sha1:b32b63b5f2df4a4d9acb4879bc68ed2a8a5e7988"
      },
      {
        "validation_id": "V13",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-09-02 20:06:00+08:00",
        "evidence": "Network-disabled pnpm verify:offline and full documentation gardening both passed at git-sha1:509448a5b7fd55806d2bc9c7684406a8317f6f10 after the EOF correction. Object-level review then showed the first mechanical patch had also removed one harmless internal blank line in the historical A1 evidence file. The parent restored that internal line before terminal review, making the final delta from the prior A2 state exactly the required EOF blank-line removal. The complete offline and documentation gates were rerun and passed at the final material state; the intermediate successful evidence is superseded rather than rebound.",
        "state_id": "git-sha1:509448a5b7fd55806d2bc9c7684406a8317f6f10"
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-09-02 13:36:35+08:00",
        "summary": "Closed A0 attempt-1 findings by prohibiting Project/workspace overlap; freezing a closed main-worktree/common/object topology and complete mutation-namespace guards; replacing Git checkout with validated regular-file materialization; adding the narrow fresh-only ownershipBindingSha256 port/application reset plus anchored restart-readable physical manifest and three-way recovery proof; and limiting every real fixture to repository-owned .task-artifacts.",
        "previous_approval_sha256": "1A7CBBE7008C58D75415CA58F7CFE9BB2B89A555097609FDE8CD8F141BF709C3"
      },
      {
        "at": "2026-09-02 13:58:15+08:00",
        "summary": "Closed A0 attempt-2 findings by removing git worktree add from the mutation path; requiring adapter-owned atomic mkdir acquisition and immediate anchoring of the exact linked-admin/target leaves plus exclusive held-descriptor construction of every control and content leaf; publishing the ownership manifest directly at its fixed final leaf with create-new/no-replace semantics; and scoping the sole version owner to record the one explicitly authorized unreleased fresh-only ato.workspace/v1 ownershipBindingSha256 reset, reject the old shape, and require v2 for the next required field or identity change.",
        "previous_approval_sha256": "30CA5FB6D674F9F20E37BD97EC0AEAE82414F44DA7B530AD7B94B23D1B65905B"
      },
      {
        "at": "2026-09-02 14:36:20+08:00",
        "summary": "Closed the static findings from invalid A0 attempt 3 by scoping scripts/lint.mjs and scripts/repo-utils.mjs as the exact 46-file production inventory owners, scoping test/domain-architecture.test.mjs as the exact package-root export owner, and scoping docs/reference/persistence-contract.md for a narrow truthful status update that preserves the unchanged SQLite schema and durable coordinator/reader/writer boundary. The failed external request and ignored local dependency bootstrap remain explicitly recorded and are not treated as review evidence or rolled back; a different fresh strict-read-only A0 is required.",
        "previous_approval_sha256": "6FA2BF147FFAF10A78A2CD7F5B4911EAD9CBE86E058EED31DCC2B8FDC308395C"
      },
      {
        "at": "2026-09-02 16:57:34+08:00",
        "summary": "Corrected the exact approved physical topology after implementation-time Windows path-length evidence showed that the longer run/workspace directory chain exceeded the bounded child-process working-directory envelope. The compact target now binds workspace digest plus generation, the linked-admin name binds the complete immutable ownership digest, raw identifiers remain excluded, all containment/identity/manifest/recovery guarantees remain unchanged, and the prior A0 is explicitly stale pending fresh independent review.",
        "previous_approval_sha256": "A376A9026EC0B1264DBF34DC3BF256ACE8ECE744F3675AD79CEB48AD9F0FEC4D"
      },
      {
        "at": "2026-09-02 17:13:33+08:00",
        "summary": "Closed A0 attempt-5 findings by replacing the stale run-root containment bullet with the actual workspace-root/ato-workspaces/generation hierarchy, making the sole topology contract own the exact 240 UTF-16 target/admin maximum and canonical positive-decimal generation form, and extending V4 to require below-bound, exact-bound and above-bound pre-mutation refusal evidence with zero outside-root writes. No adapter, product, cleanup, schema, compatibility or support boundary changed.",
        "previous_approval_sha256": "D0A7B6BBFB78E9CBF8A8DB58AA7C46BCFB5983A4190FD20FD51414D4A3593652"
      },
      {
        "at": "2026-09-02 19:46:15+08:00",
        "summary": "Resolved the terminal authorization conflict by narrowing the approval contract to prohibit pnpm dependency:audit and every registry/network advisory query under the current user's explicit no-network boundary. V14 is now not_applicable; the offline dependency-shape gate still proves zero production dependencies and the unchanged TypeScript-only development lock shape, while making no vulnerability-status claim. No implementation, product, cleanup, schema, compatibility, support, task-path or external-write boundary changed, and fresh independent A0 is required for the revised approval bytes.",
        "previous_approval_sha256": "42CE09525A869C8A91E8DD8DDF9025D254CE2240C497486D0F50158265F349E6"
      }
    ],
    "final_summary": "EP-03B implements only the approved fresh-only library-level Windows local Git/filesystem WorkspaceBackend and the exact ato.workspace/v1 immutable ownershipBindingSha256 reset. It binds configured disjoint trusted roots to one bounded deterministic target/admin topology, constructs a detached linked-worktree registration without git worktree add or checkout, materializes only prevalidated local regular blobs through held exclusive handles, verifies canonical ownership and physical inventory, recovers by authoritative observation without blind replay, and unconditionally refuses cleanup. Exact material state git-sha1:382bf2dce780d8d44c27b107589355c170b0dace passes the 46/46 Windows adapter, 70/70 adjacent workspace/application/architecture, 47/47 persistence, 10/10 recovery, and 1/1 real disposable Windows E2E selections; the network-disabled complete offline route passes 539/539 tests, lint 264/46, typecheck, build, docs 137/261/22/0, offline dependency shape, 184-file package smoke, Windows SQLite with zero survivors, and truthful blocked-only Codex evidence. Full documentation gardening found zero issues, candidates, or unverified items. Fresh A0 approved the final no-network contract; final independent A2 closes all four A1 findings and the prior A2 residual with findings=[]. No network advisory query ran and no vulnerability-status claim is made. No product/CLI composition, ProjectPolicy, CompletionBackend/gate, integration/ref/push behavior, cleanup effect, scheduler, Codex/MCP adapter, release, deployment, compatibility layer, or platform-support claim is implemented. The terminal result commit, pathless artifact prune, 17 exact-head gates, readiness, FF-only integration, and standing-authorized ordinary push remain authorized coordinator consumers of this completed candidate; cleanup remains separately unauthorized."
  }
}
```

## Context

EP-03A is already integrated and pushed at `d0ed2d85c2908e36f8b97a450366ee85ab72368f`. Its pure `ato.workspace/v1`, application coordinator, authorization stage 5, and durable schema-version-1 workspace lifecycle are the unchanged starting point. Proposal-time disposable probes on the current Windows development host found Node `24.19.0`, Git `2.53.0.windows.1`, junction detection through `lstat`, no exposed `O_NOFOLLOW`/`O_SYMLINK`, atomic file and directory acquisition refusing pre-existing leaves, rename still possible while only an ordinary Node directory descriptor is open, and rename of a process current directory or its ancestor refused with `EBUSY`/`EPERM`. A fresh no-remote repository under `.task-artifacts` also proved that Git `2.53.0.windows.1` authoritatively resolves, lists, and reports clean the exact detached linked-worktree layout built by exclusive adapter-equivalent writes of `HEAD`, `commondir`, `gitdir`, the target `.git` file, index, and one regular blob; no `git worktree add`, checkout, network, or credential operation was invoked. These observations motivate the anchored static-worker design but do not themselves count as adapter validation or a support claim.
