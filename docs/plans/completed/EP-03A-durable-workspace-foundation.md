# ExecPlan：建立 fresh Phase 3 durable workspace foundation

EP-03A 是严格串行 EP-03A → EP-03B → EP-03C 计划链的第一项。它只建立纯 `ato.workspace/v1`、workspace durable lifecycle、当前有限授权阶段与 dedicated redacted event evidence；真实 Windows Git workspace effect、ProjectPolicy、CompletionBackend 和 integration closure 分别留给后继计划。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-01 22:47:37+08:00",
    "updated_at": "2026-09-02 12:44:19+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "user request in the current coordinator thread",
        "at": "2026-09-01 22:47:37+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "user request plus docs/reference/local-agent-git-flow.md standing grants",
        "at": "2026-09-01 22:47:37+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Deliver the first fresh-only Phase 3 increment as one self-consistent current baseline: freeze the cross-owner Project/Task/run/execution/fence/workspace/operation identity graph and workspace lifecycle; implement a pure exact ato.workspace/v1 contract kit and a typed application/persistence owner for authorized reservation, workspace ID/generation allocation, durable intent, independent observation, verified receipt, finalization and restart recovery against a test-only Fake backend; extend the finite current authorization progression only with the workspace actions actually implemented here; replace the sole schema-version-1 baseline in place under the user's explicit unreleased reset authorization; expose only dedicated bounded redacted workspace transition evidence; and pass the complete concurrency, CAS, fencing, failpoint/restart, corruption, redaction, fresh-baseline refusal, package and repository gates without invoking real Git, Codex or a scheduler.",
    "non_goals": [
      "Do not implement a real Git or filesystem WorkspaceBackend, invoke git worktree, mutate a Project repository, claim Windows Git support, or perform product cleanup; EP-03B owns that adapter and its real fixtures.",
      "Do not implement ProjectPolicy, CompletionBackend, gates, completion evaluation, integration reservation, local/remote ref mutation, push, policy-driven cleanup eligibility or any EP-03C record.",
      "Do not implement SchedulerBackend, scheduled delivery, Codex, MCP, daemon/service, release, deployment, D:\\quant behavior, another repository effect, secret access or a real network operation other than the separately authorized dependency advisory query.",
      "Do not add a historical schema reader, forward migration, backfill, adoption, dual write, old/new vocabulary translator, alias, fallback, deprecation window, backup-format compatibility path or reader for any pre-EP-03A development database.",
      "Do not change ato.execution/v1, the sole ato.api/v1 command/error grammar, Domain Task state semantics, backup/restore JSON formats, Manual-loop or dispatcher effect meaning except for the minimum current authorization-stage and combined-state changes needed to carry the new workspace family.",
      "Do not add a generic logger, telemetry sink, diagnostic export, retention job or remote event exporter; only the dedicated structured, bounded and redacted workspace lifecycle evidence implemented by this plan is current.",
      "Do not rewrite, delete or normalize completed ExecPlans, historical evidence or existing changelog facts."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "EP-03A is the only plan created or active in this chain. EP-03B must not be created until EP-03A has one unique terminal local commit, completed-plan trace and terminal resolution, exact-head Git-flow gates, FF-only local integration and the applicable ordinary origin/master push.",
        "source": "current user request; docs/plans/README.md"
      },
      {
        "id": "C2",
        "statement": "The repository root remains the clean master integration checkout. All EP-03A source, plan and evidence mutations occur only on coordinator task ep-03a, branch task/ep-03a and its linked worktree; harness-git-flow is the sole coordinator-state writer.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md"
      },
      {
        "id": "C3",
        "statement": "The user explicitly authorizes an unreleased fresh-only reset. Replace the single schema-version-1 baseline and its checksum directly, accept only the new exact baseline, and refuse every prior, edited, partial, zero-length, earlier-checksum or otherwise noncurrent database before writable open without migration, adoption, rewrite or repair.",
        "source": "current user request; docs/reference/persistence-contract.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C4",
        "statement": "The user-authorized outcome is a finite vocabulary update for exactly workspace.reserve, workspace.create, workspace.inspect, workspace.recover and workspace.cleanup. This proposal retains current stages 1 through 4 because they remain real confirmation-bound feature gates, then adds one contiguous stage 5 containing their cumulative actions plus exactly those five actions. Cleanup alone is newly high-risk because it is the only destructive workspace operation; reserve, create, inspect and recover remain subject to ordinary finite grants and all operation-specific CAS/fencing checks. Schema creation, bootstrap, upgrade and renewal never skip or invent a stage, and no noncurrent vocabulary is accepted as compatibility input.",
        "source": "user-authorized five-action outcome; proposal design decision D1; docs/reference/authorization-contract.md; src/authorization.ts"
      },
      {
        "id": "C5",
        "statement": "The frozen identity graph binds one workspace generation to exact Project ID/resource/config/root identity, Task ID/revision, dispatcher run ID/revision, execution ID/revision/attempt/fence, trusted workspace-root identity, reservation, creator operation, port/adapter version and correlation/causation identities. A stale or substituted member cannot be reused or finalized.",
        "source": "docs/reference/completion-workspace-contract.md; docs/reference/reliability-protocol.md; docs/reference/adapter-contracts.md"
      },
      {
        "id": "C6",
        "statement": "Workspace ID and generation are system-issued durable identities. A first generation starts at one; exact replay returns the same result; a replacement requires an exact predecessor and the next generation; no path, Task title, branch name, prompt, repository content or adapter text may select an identity.",
        "source": "docs/reference/completion-workspace-contract.md; docs/security/threat-model.md"
      },
      {
        "id": "C7",
        "statement": "Every effect-capable Fake workspace transition follows prepare intent -> effect-possible CAS -> adapter call outside all writer transactions -> independent observation -> semantic verification -> current-authorization/fence finalization. Inspect is read-only. Response loss, crash and partial Fake state reconcile before retry; unknown or conflicting state remains explicit ambiguous evidence and never authorizes blind replay.",
        "source": "docs/reference/reliability-protocol.md; docs/reference/persistence-contract.md"
      },
      {
        "id": "C8",
        "statement": "The application owner alone parses commands, obtains trusted ingress, evaluates current grants/policy, checks Domain/Project/run/execution/fence state, selects durable transitions and coordinates accepted commits. Persistence owns schema, SQL, CAS and typed corruption; the injected backend never writes SQLite or decides authorization or Task state.",
        "source": "AGENTS.md; ARCHITECTURE.md; docs/reference/authorization-contract.md; docs/reference/persistence-contract.md"
      },
      {
        "id": "C9",
        "statement": "Workspace lifecycle evidence is a dedicated current record family with stable IDs, correlation and nullable causation, closed event/outcome/reason codes, bounded counts and redacted opaque references. It stores no Task body, prompt, source, raw path, environment, credential, command output, adapter message, SQL or stack, and is not described as a generic log, telemetry or diagnostic export implementation.",
        "source": "current user request; docs/reference/observability-contract.md; docs/security/privacy-and-logging.md"
      },
      {
        "id": "C10",
        "statement": "The sole baseline allocates only the workspace records implemented in EP-03A. It must not preallocate Git adapter-specific ownership inventory, ProjectPolicy, CompletionBackend/gate, integration, scheduler, Codex, MCP, release, deployment, diagnostic exporter or product cleanup records.",
        "source": "current user request; docs/reference/persistence-contract.md"
      },
      {
        "id": "C11",
        "statement": "Every intermediate EP-03A HEAD is self-consistent, strict-typecheckable and testable. Replaced implementation/tests retire in this plan; no temporary compatibility shim or knowingly broken state is deferred to EP-03B or EP-03C.",
        "source": "current user request; AGENTS.md"
      },
      {
        "id": "C12",
        "statement": "A change to goal, non-goals, schema/data/security outcome, public or port semantics, authorization, task envelope, external action or binary validation criterion stales A0 and requires the ExecPlan reapproval route. A later master movement is assessed with base-diff and the plan's independent base-transition rules.",
        "source": "harness-exec-plan schema v3; AGENTS.md"
      },
      {
        "id": "C13",
        "statement": "The closed workspace-generation status set is allocated, reserved, creating, ready, cleaning, recovery_required and cleaned. absent->allocated is the sole ID/generation allocation edge and atomically inserts the prepared reserve intent. Before each backend call one CAS records the effect-possible status: allocated stays allocated for reserve, reserved->creating for create, and ready->cleaning for cleanup. Verified outcomes permit exactly allocated->reserved for reserve success, allocated remaining allocated for reserve refusal/no-effect, creating->ready for create success, creating->reserved for create refusal/no-effect, cleaning->cleaned for cleanup success, and cleaning->ready for cleanup refusal/no-effect. Ambiguous, partial or conflicting effect evidence permits allocated|creating|cleaning->recovery_required. Recover first appends a new independent observation and permits recovery_required->allocated for verified absent/no-effect reserve, ->reserved for verified external reservation or absent/no-effect create, ->ready for an exact complete workspace or still-present/refused cleanup, or ->cleaned for verified absence after cleanup; still-partial/ambiguous evidence leaves recovery_required unchanged. Inspect appends evidence without changing generation status. cleaned is the sole terminal generation status. Every refusal is terminal for that operation and no ambiguous state authorizes replay. At most one non-cleaned generation exists for an exact Project/Task/run/execution ownership tuple. Replacement requires the current predecessor in cleaned at the exact revision and generation; one CAS advances the per-workspace generation and inserts the next allocated row. Every other edge, outcome/operation mismatch or stale revision is refused without partial mutation.",
        "source": "proposal lifecycle decision; docs/reference/reliability-protocol.md; docs/reference/persistence-contract.md; docs/reference/completion-workspace-contract.md"
      }
    ],
    "authorization": {
      "allowed": [
        "Create, independently audit and activate this one EP-03A plan; implement only its task-owned files in the coordinator-owned ep-03a worktree; run local reads, build, tests and disposable runtime/Fake fixtures.",
        "Replace the unreleased single schema-version-1 baseline, registry checksum and current finite authorization model in place exactly as constrained here, with no compatibility reader or migration.",
        "Use a test-only in-memory Fake WorkspaceBackend and disposable local SQLite/runtime fixtures that do not invoke Git, inspect credentials, contact a service or mutate a real Project repository.",
        "Run impact-selected tests, pnpm verify:offline, package smoke, SQLite feasibility, documentation checks, git diff --check and exact inventory checks; run pnpm dependency:audit only as the separately named registry advisory query.",
        "Create the task result commit containing only task-owned paths, invoke the standing-authorized pathless prune-artifacts transition after that commit, record exact-head gate receipts, mark ready, perform FF-only local integration and invoke the repository-standing-authorized ordinary non-force push to origin/master.",
        "Use fresh independent read-only reviewers for A0, A1 and any required A2; the coordinator may disposition their findings and persist bounded task evidence."
      ],
      "requires_reapproval": [
        "Any real Git, filesystem workspace, Codex, scheduler, MCP, ProjectPolicy, CompletionBackend, integration, remote-ref, release, deployment, secret, credential, D:\\quant, other-repository or external-service action beyond the one dependency advisory query.",
        "Any compatibility reader, migration, backfill, adoption, alias, translator, fallback, deprecation window, dual write, old baseline acceptance, backup-format version change or preservation of replaced Manual-only paths solely for old behavior.",
        "Any change to ato.execution/v1, the ato.api/v1 command/error/output contract, Domain Task state, backup/restore JSON format, public support claim, cleanup effect, authorization scope or confirmation rule outside the five workspace actions approved here.",
        "Any task-path expansion, material approval-contract change, ambiguous base transition or architecture/authority conflict not resolved by the current contract."
      ],
      "prohibited": [
        "Create or activate EP-03B or EP-03C before EP-03A's unique terminal commit is completed, integrated and pushed through the applicable Git-flow state.",
        "Invoke real git worktree/Git adapter behavior, touch D:\\quant or another repository, use real network credentials, call Codex/scheduler/MCP, open a pull request, merge non-FF, force push, release, deploy or run coordinator cleanup.",
        "Use reset, stash, clean, force deletion, recursive string deletion, schema repair, historical evidence rewriting or fabricated/blocked evidence as a passing gate.",
        "Describe Fake tests, the development host, a contract kit or local SQLite fixtures as a supported platform, external adapter, generic observability product or completed Phase 3 integration."
      ],
      "persistence": {
        "required": true,
        "action": "Persist one terminal EP-03A task-result commit containing the completed ExecPlan and exact task-owned implementation/evidence, then compose current-head plan receipts with harness-git-flow prune/gates/readiness, FF-only master integration and the standing-authorized ordinary origin/master push.",
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
        {"path": "docs/compatibility/v0.1.md", "kind": "file"},
        {"path": "docs/plans/proposals/EP-03A-durable-workspace-foundation.md", "kind": "file"},
        {"path": "docs/plans/proposal/EP-03A-durable-workspace-foundation.md", "kind": "file"},
        {"path": "docs/plans/active/EP-03A-durable-workspace-foundation.md", "kind": "file"},
        {"path": "docs/plans/completed/EP-03A-durable-workspace-foundation.md", "kind": "file"},
        {"path": "docs/plans/evidence/EP-03A", "kind": "directory"},
        {"path": "docs/reference/adapter-contracts.md", "kind": "file"},
        {"path": "docs/reference/authorization-contract.md", "kind": "file"},
        {"path": "docs/reference/cli-contract.md", "kind": "file"},
        {"path": "docs/reference/completion-workspace-contract.md", "kind": "file"},
        {"path": "docs/reference/contract-ownership.md", "kind": "file"},
        {"path": "docs/reference/observability-contract.md", "kind": "file"},
        {"path": "docs/reference/persistence-contract.md", "kind": "file"},
        {"path": "docs/reference/reliability-protocol.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "docs/reference/validation-policy.md", "kind": "file"},
        {"path": "docs/reference/versioning-compatibility-contract.md", "kind": "file"},
        {"path": "docs/security/privacy-and-logging.md", "kind": "file"},
        {"path": "docs/security/threat-model.md", "kind": "file"},
        {"path": "migrations/0001-current-baseline.sql", "kind": "file"},
        {"path": "scripts/lint.mjs", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "scripts/repo-utils.mjs", "kind": "file"},
        {"path": "src/application-model.ts", "kind": "file"},
        {"path": "src/application-policy.ts", "kind": "file"},
        {"path": "src/application-service.ts", "kind": "file"},
        {"path": "src/authorization.ts", "kind": "file"},
        {"path": "src/index.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-digest.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-model.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-readers.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-state.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-transaction.ts", "kind": "file"},
        {"path": "src/persistence/application-repository.ts", "kind": "file"},
        {"path": "src/persistence/migrations.ts", "kind": "file"},
        {"path": "src/workspace-application.ts", "kind": "file"},
        {"path": "src/workspace-port.ts", "kind": "file"},
        {"path": "test/application-cli-module-architecture.test.mjs", "kind": "file"},
        {"path": "test/application-atomicity.test.mjs", "kind": "file"},
        {"path": "test/application-service.test.mjs", "kind": "file"},
        {"path": "test/authorization.test.mjs", "kind": "file"},
        {"path": "test/cli-e2e.test.mjs", "kind": "file"},
        {"path": "test/cli-phase2-e2e.test.mjs", "kind": "file"},
        {"path": "test/configuration.test.mjs", "kind": "file"},
        {"path": "test/domain-architecture.test.mjs", "kind": "file"},
        {"path": "test/dispatcher-security.test.mjs", "kind": "file"},
        {"path": "test/execution-claim-foundation.test.mjs", "kind": "file"},
        {"path": "test/fixtures/fake-workspace-backend.mjs", "kind": "file"},
        {"path": "test/package-boundary.test.mjs", "kind": "file"},
        {"path": "test/persistence-backup-restore.test.mjs", "kind": "file"},
        {"path": "test/persistence-concurrency.test.mjs", "kind": "file"},
        {"path": "test/persistence-repository.test.mjs", "kind": "file"},
        {"path": "test/persistence-schema-migrations.test.mjs", "kind": "file"},
        {"path": "test/workspace-application.test.mjs", "kind": "file"},
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
        "outcome": "Freeze and document the fresh-only authorization reset, exact cross-owner identity graph, workspace lifecycle/status/ownership boundary and EP-03A versus EP-03B/EP-03C allocation without overclaiming an adapter or platform.",
        "validation_ids": ["V1", "V2", "V3"]
      },
      {
        "id": "M2",
        "outcome": "Implement the pure exact ato.workspace/v1 contract kit for reserve/create/inspect/recover/cleanup with closed requests, receipts, inventory summaries, adapter errors and strict hostile-input parsers, plus a shared test-only Fake contract suite.",
        "validation_ids": ["V4", "V5"]
      },
      {
        "id": "M3",
        "outcome": "Replace the sole fresh schema-version-1 baseline and current finite authorization progression with only the EP-03A workspace records/actions, one writer/reader/digest closure and pre-write refusal of every former or corrupt baseline.",
        "validation_ids": ["V6", "V7", "V8"]
      },
      {
        "id": "M4",
        "outcome": "Implement the typed workspace application owner and Fake-backed ordered durable protocol for reservation, ID/generation, intent, independent observation, verified receipt, finalization, replay and restart recovery with backend calls outside writer transactions.",
        "validation_ids": ["V9", "V10", "V11"]
      },
      {
        "id": "M5",
        "outcome": "Close concurrency, CAS, lease/fence and every durable transition failpoint/restart path, including stale owners, response loss, partial Fake create, ambiguous observation and exact terminal replay.",
        "validation_ids": ["V10", "V11", "V12"]
      },
      {
        "id": "M6",
        "outcome": "Close typed corruption, hostile input, structured correlation/causation, bounded redaction and non-claim boundaries without a general logger, diagnostic exporter, real Git effect or secret/path disclosure.",
        "validation_ids": ["V5", "V8", "V13"]
      },
      {
        "id": "M7",
        "outcome": "Complete independent A1/A2 as required, impact-selected and full repository gates, exact staged inventory, terminal plan persistence, artifact prune receipt, Git-flow readiness, FF-only integration and applicable ordinary push before permitting EP-03B creation.",
        "validation_ids": ["V14", "V15", "V16", "V17"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "Plan identity, chain and scope",
        "criterion": "exec_plan.py trace returns schema v3, ok=true, no errors/outside-scope or dirty overlap, the exact fc42a2e material base and fresh independent A0 readiness; warnings are empty unless the sole warning is W_PREFLIGHT_A2_CONVERGENCE, in which case the current final independent A2 must explicitly confirm unchanged root cause, repair strategy and approval envelope plus closure_safe=true and completion_safe=true. No EP-03B/EP-03C plan exists. Terminal trace/resolve later identifies one unique completed-plan commit and the predecessor/successor rule remains closed."
      },
      {
        "id": "V2",
        "type": "manual",
        "target": "Authority and identity graph",
        "criterion": "Manual authority review of AGENTS, Architecture and every changed live contract finds one owner for each schema, action, port, identity, lifecycle, redaction and validation rule; the same exact Project/Task/run/execution/fence/workspace/operation graph is consumed end to end with no second decision owner or planned component claimed current."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Finite workspace authorization stage",
        "criterion": "Static, unit and persistence tests prove exact cumulative counts and contiguous stages 1/2/3/4/5; stage 5 adds only workspace.reserve/create/inspect/recover/cleanup, cleanup alone joins the applicable high-risk set, bootstrap/renewal never upgrade, each upgrade is separately confirmed and a skipped/old/unknown/stale/revoked stage commits no partial grant/epoch/audit state."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Pure ato.workspace/v1 contract kit",
        "criterion": "The focused workspace port contract suite passes every operation/receipt/error positive case and rejects missing, extra, cross-class, malformed, accessor, proxy, normalization, bound, identity, revision, fence, inventory and error-flag drift before a backend call; production source contains no Git, child-process, filesystem or vendor import."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Fake backend contract and no external effect",
        "criterion": "One unexported test-only Fake implements all five operations and passes the shared contract/replay/inspection suite; source/package inventories contain no Fake, Git/Codex/scheduler dependency or workspace path mutation, and test evidence records only disposable in-memory/Fake state."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Single fresh baseline",
        "criterion": "Migration registry/source/build/package tests prove exactly one canonical LF schema-version-1 baseline with its new exact checksum/fingerprint/history; absent primary initializes atomically, while registry identity current-baseline with prior migration SHA-256 518E84129E6753E7D0E5078223DCCB43E155AA2FD2120DD2A4C3F5F633FCEBFA, zero-length, partial, edited, old/unknown vocabulary and malformed workspace rows are refused during read-only inspection before writable open and remain byte-exact. The prior Git material base is separately fc42a2ead9698e2e25341b014526d4b348fc016c. No migration, backup hook, adoption or repair route exists."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Workspace persistence writer/reader closure",
        "criterion": "Architecture and persistence tests prove one ApplicationTransaction SQL/CAS writer and one complete typed readback/digest owner for every implemented workspace record; backup/restore/current-state projection includes the family exactly once; schema contains no ProjectPolicy, CompletionBackend/gate, integration, scheduler, Codex, MCP, diagnostic-export or product-cleanup allocation."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Corruption and redaction",
        "criterion": "Mutation/restart/backup readback rejects orphaned, substituted, noncontiguous, stale-fence, duplicate, unknown-enum/code, invalid-transition, missing-observation/receipt/finalization and unbounded event state as typed corruption without defaults or repair; sentinel Task/path/environment/credential/adapter-message/SQL/stack values are absent from durable event evidence and bounded results."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Application ownership and authorization sequencing",
        "criterion": "Focused application tests prove closed typed input is parsed before trusted ingress, current Project/Task/run/execution/lease/fence and grant/policy/confirmation facts are rechecked inside short transactions, every Fake mutation consumes a current binding, and all backend/observation calls occur outside writer transactions; denial or Domain/CAS conflict has no unauthorized effect or partial accepted record."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "Reservation, generation, concurrency and fencing",
        "criterion": "Competing workers produce exactly one reservation/generation winner, exact semantic replay returns the same IDs, replacement is predecessor-bound and generation+1 only, stale revisions/owners/fences cannot act/observe/finalize, and every accepted transition increments only its owned revision with terminal readback."
      },
      {
        "id": "V11",
        "type": "automated",
        "target": "Ordered durable transition recovery",
        "criterion": "Process-reopen or equivalent real SQLite restart tests pass after every committed prepare, executing, adapter-effect/response-loss, observation, verified-receipt and finalization boundary for reserve/create/recover/cleanup plus read-only inspect; no committed intent means no assumed effect, known Fake state reconciles exactly once, conflicting/unknown partial state remains explicit ambiguous evidence, and finalized replay performs no second effect."
      },
      {
        "id": "V12",
        "type": "automated",
        "target": "CAS/failpoint atomicity",
        "criterion": "Every durable workspace insert/update/finalization stage has an injected failure test proving all-or-none transaction state and successful restart; competing SQLite writers, expired authorization, run/execution revision drift and late old-fence writes leave one valid current lineage with no fabricated rollback or duplicate receipt."
      },
      {
        "id": "V13",
        "type": "manual",
        "target": "Truthful structured-event and capability boundary",
        "criterion": "Manual review of the changed source/docs/package surface finds only dedicated bounded workspace lifecycle evidence, no general logger/telemetry/export/support claim, no real Git/Codex/scheduler/ProjectPolicy/CompletionBackend behavior, no D:\\quant special case, and no sensitive raw path/content/error value in public or audit projections."
      },
      {
        "id": "V14",
        "type": "automated",
        "target": "Impact-selected executable routes",
        "criterion": "All focused workspace port/application/recovery/security, authorization, application atomicity, schema/migration/repository/concurrency/backup and package-boundary tests selected by docs/reference/validation-policy.md exit 0 with zero fail/skip/todo for required cases and no surviving .task-artifacts member."
      },
      {
        "id": "V15",
        "type": "automated",
        "target": "Complete offline repository gate",
        "criterion": "With exact Node 24.19.0, pnpm 11.19.0 and TypeScript 5.9.3 and network disabled, pnpm verify:offline exits 0 through lint, strict typecheck, build, complete tests, docs, dependency shape, package smoke, Windows SQLite feasibility and truthful blocked Codex boundary; no dependency repair or task artifact survives."
      },
      {
        "id": "V16",
        "type": "automated",
        "target": "Dependency security",
        "criterion": "pnpm dependency:audit performs only the authorized registry advisory query and exits 0 with no known high/critical production vulnerability; production dependency count remains zero and the exact TypeScript-only development lock shape is unchanged."
      },
      {
        "id": "V17",
        "type": "manual",
        "target": "Terminal review, documentation, inventory and Git-flow persistence",
        "criterion": "Fresh independent A1 and any required A2 are complete at the exact material state; docs:check and git diff --check pass; exact staged inventory contains only task-owned regular no-follow files and no runtime/evidence secret; package smoke consumes the declared workspace exports/current baseline; the completed plan is completion-ready and committed once; current-head prune and all 14 Git-flow gates pass before ready, FF-only integration and ordinary origin/master push."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "A too-broad workspace identity may omit one current run/execution/fence/Project revision and permit stale replay or cross-resource substitution."},
      {"id": "R2", "risk": "Changing the single baseline may accidentally create an old-database acceptance path, a repair route or a partially updated checksum/fingerprint/package identity."},
      {"id": "R3", "risk": "Adding vocabulary stage 5 may skip confirmation, alter stages 1 through 4, grant workspace authority at bootstrap/renewal or create an incomplete epoch under concurrency/failpoint."},
      {"id": "R4", "risk": "Adapter calls or trusted callbacks inside a SQLite writer transaction could deadlock, hold locks across effects or commit an authorization/effect mismatch."},
      {"id": "R5", "risk": "Response loss or partial Fake creation may be misclassified as no effect and blindly replayed, duplicate a generation or fabricate rollback."},
      {"id": "R6", "risk": "Workspace rows may split schema, validator, digest, backup or writer ownership and allow corruption to pass one reader."},
      {"id": "R7", "risk": "Dedicated lifecycle events may leak sensitive paths/content/errors or be overdescribed as generic telemetry/diagnostics."},
      {"id": "R8", "risk": "03A may accidentally allocate Git, policy, completion, integration or scheduler state that later becomes breaking-cleanup debt."},
      {"id": "R9", "risk": "Large cross-cutting test and package inventory changes may leave an intermediate HEAD unbuildable or silently omit a current public route."},
      {"id": "R10", "risk": "Master/base movement, overlapping user changes or stale independent review evidence could be composed as current without the required base-diff/reapproval route."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {"id": "D1", "statement": "Keep current feature-gating stages 1..4 and add one current vocabulary stage 5 whose cumulative action set adds exactly the five workspace actions; classify cleanup alone as newly high-risk; treat the replaced baseline/checksum as the only database identity and add no pre-EP-03A reader.", "rationale": "The five-action update is user-authorized. The contiguous stage number, retention of stages 1..4 and cleanup-only risk split are proposal choices: the existing stages are active authorization ceremonies rather than compatibility scaffolding, and cleanup is the only destructive new operation. The user's reset removes any need to open an earlier development database."},
      {"id": "D2", "statement": "Implement the public pure contract kit in src/workspace-port.ts and the typed durable coordinator in src/workspace-application.ts; keep the Fake only under test/fixtures and export no concrete workspace adapter.", "rationale": "This freezes the port before EP-03B while keeping vendor/OS/Git mechanics out of core and package production dependencies."},
      {"id": "D3", "statement": "Represent the current graph as explicit typed fields and SQL foreign/CAS relationships from Project/Task/run/execution/fence through reservation/workspace generation and operation evidence; do not infer identity from paths or opaque digests alone.", "rationale": "Recovery and stale-fence refusal need readable authoritative tuples rather than an unverifiable marker or hash-only key."},
      {"id": "D4", "statement": "Use ApplicationTransaction as the one SQL writer and the combined application-state decoder/digest as the one readback owner; extend those current owners rather than creating a parallel workspace database or direct adapter writer.", "rationale": "The application/persistence authority boundary and backup/corruption closure remain single-owner."},
      {"id": "D5", "statement": "Use a workspace-stable system-issued ID with positive contiguous generations and exact predecessor binding. A reservation creates the durable current generation identity before any Fake effect; replay is tuple-exact and replacement is generation+1 only.", "rationale": "This provides deterministic recovery and fencing without directory discovery or adoption."},
      {"id": "D6", "statement": "Give every effect-capable workspace operation its own immutable semantic intent, current authorization-binding chain, ordered observations, one verified receipt and one finalization; use inspect-only observation to reconcile executing/partial state before retry.", "rationale": "It applies the repository's existing reliable effect protocol without reusing Manual-only rows or inventing a second reliability model."},
      {"id": "D7", "statement": "Persist dedicated workspace transition audit/event rows with fixed schema, stable IDs, correlation/causation, closed codes, bounded counts and opaque redacted references; expose only a bounded application result and no sink/exporter.", "rationale": "Later external effects need correlation and structured evidence, but EP-03A must not claim or prebuild general observability."},
      {"id": "D8", "statement": "Keep EP-03A ProjectPolicy-independent: the workspace application uses the existing enabled-Project narrowing rule plus exact current workspace grants; policy receipts, completion gates and cleanup eligibility records do not exist until EP-03C.", "rationale": "This makes the current foundation testable while preserving the explicitly serial plan allocation."},
      {"id": "D9", "statement": "Model cleanup at the port/protocol level but allow only the in-memory Fake to exercise it; no production path imports filesystem, child_process or Git, and no public CLI invokes workspace operations.", "rationale": "The v1 contract must be complete before the real adapter, while destructive product behavior remains out of scope."},
      {"id": "D10", "statement": "After stable diff, reserve integration, refresh only if Git-flow permits and assess any base delta under this plan, then run fresh independent A1/A2 and exact-head gates before the single terminal commit/prune/ready/integrate/push sequence.", "rationale": "ExecPlan audit freshness and coordinator receipts remain independently auditable and bound to one head."},
      {"id": "D11", "statement": "ApplicationTransaction owns every C13 generation revision and legal-edge CAS together with its intent/evidence linkage; the combined application-state decoder owns exact row closure, current-generation uniqueness and terminal readback. Reserve calls require durable allocated plus an executing reserve intent, create calls require creating, and cleanup calls require cleaning. A crash reopens through that decoder and recover appends a new observation before choosing only a C13 edge; verified refusals take their operation-specific no-effect edge and ambiguous operations persist recovery_required.", "rationale": "One binary state-machine owner prevents a backend, restart path or parallel reader from inventing lifecycle meaning while retaining the repository's effect-outside-writer reliability boundary."}
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep the plan proposal and contracts as the only draft state; if authority or identity boundaries conflict, revise approval_contract and obtain fresh independent A0 before any implementation."},
      {"id": "M2", "recovery": "Revert only the uncommitted task-owned port/Fake delta to the last strict contract-kit state; do not retain aliases or a partial second port version."},
      {"id": "M3", "recovery": "Restore one internally consistent uncommitted baseline, registry checksum and reader/writer model together; never publish or accept an intermediate database identity and never add a migration fallback."},
      {"id": "M4", "recovery": "Stop with durable Fake evidence intact, reopen through the authoritative decoder, require its generation revision/status and linked intent to agree, append an independent observation, and take only a C13 edge. For an unresolved reserve, verified absence/no-effect returns to allocated and exact reservation returns to reserved; for create, verified absence/no-effect returns to reserved and exact presence reaches ready; for cleanup, exact presence/refusal returns to ready and exact absence reaches cleaned. Partial, conflicting or unknown evidence remains recovery_required/ambiguous and never invokes the backend blindly."},
      {"id": "M5", "recovery": "Preserve exact failpoint and competing-worker state for diagnosis, repair the owning transition, and rerun from a fresh fixture/restart until every checkpoint is binary closed."},
      {"id": "M6", "recovery": "Remove any unbounded or sensitive evidence at its single owner, invalidate affected fixtures and rerun corruption/redaction tests; do not hide values with a display-only filter."},
      {"id": "M7", "recovery": "A failed review or gate leaves ep-03a reserved and editable. Fix task-owned files, commit the new exact head only when plan order permits, refresh all stale material evidence and receipts, and never create EP-03B early."}
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
      {"id": "V15", "state_binding": "material"},
      {"id": "V16", "state_binding": "material"},
      {"id": "V17", "state_binding": "material"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Freeze one explicit tuple in contract/types/SQL and table-drive cross-member substitution, stale revision and stale fence negatives.", "recovery": "Treat any omitted or ambiguous member as an approval-contract defect, revise and fresh-A0 before changing implementation."},
      {"id": "R2", "mitigation": "Change SQL, canonical registry checksum, fingerprint expectations, packed inventory and prior-baseline refusal fixtures as one milestone.", "recovery": "Retain old bytes as incompatible test input only; restore one current baseline and refuse all others without mutation."},
      {"id": "R3", "mitigation": "Drive actionsForVocabulary, upgrade/renewal, SQL constraints, decoder counts, confirmation and every-stage failpoints from exact version tables.", "recovery": "Remove partial epoch/grant state by fixing the uncommitted transaction owner, not by adding an acceptance branch."},
      {"id": "R4", "mitigation": "Static ownership tests and failpoint hooks assert no backend/trusted callback occurs while ApplicationTransaction is open.", "recovery": "Move the call to the ordered preflight/effect/observation boundary and rerun contention/restart tests."},
      {"id": "R5", "mitigation": "Make Fake state independently inspectable, persist executing before calls and table-test lost response/partial create/ambiguous conflict.", "recovery": "Re-observe the same semantic identity; finalize exact success, prove absence before same-key retry, or retain ambiguity."},
      {"id": "R6", "mitigation": "Keep model, readers, combined validator, digest and transaction changes in one schema milestone with exact key/row parity tests.", "recovery": "Stop normal open on any closure mismatch and repair the sole owner; never default or skip a row."},
      {"id": "R7", "mitigation": "Allowlist event fields/codes, use bounded opaque references and run sentinel scans through state, backup and application results.", "recovery": "Drop the unsafe field at the writer and invalidate/recreate only disposable test fixtures; do not persist then redact later."},
      {"id": "R8", "mitigation": "Assert absent table/type/export/import inventories for every 03B/03C/scheduler/Codex/MCP family and review docs for truthful status.", "recovery": "Remove premature allocation in EP-03A and leave the capability to its authorized successor plan."},
      {"id": "R9", "mitigation": "Work milestone by milestone with strict typecheck, focused tests and source/package inventory checks before the full gate; keep each HEAD self-consistent.", "recovery": "Return the uncommitted task diff to the last passing milestone boundary without reset/stash or compatibility scaffolding."},
      {"id": "R10", "mitigation": "Trace before decisions, use base-diff for candidate master changes, bind every material result/review/gate to current Git state and preserve user/out-of-scope content.", "recovery": "Stop mutation, classify approval impact, fresh-A0/A1 as required and use only coordinator refresh/recovery transitions."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "fc42a2ead9698e2e25341b014526d4b348fc016c",
      "current_material_base": "fc42a2ead9698e2e25341b014526d4b348fc016c",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-09-02 12:33:12+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-09-02 12:33:12+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-09-02 12:33:12+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-09-02 12:33:12+08:00"},
      {"id": "M5", "status": "complete", "updated_at": "2026-09-02 12:33:12+08:00"},
      {"id": "M6", "status": "complete", "updated_at": "2026-09-02 12:33:12+08:00"},
      {"id": "M7", "status": "complete", "updated_at": "2026-09-02 12:33:12+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Schema-v3 trace, exact approval/material identity, serial-plan inventory and independently reviewed convergence exception",
        "evidence": "Current trace returns ok=true, errors=[], outside_scope=[], overlap=[], pre_existing_dirty=[], exact base/HEAD fc42a2ead9698e2e25341b014526d4b348fc016c, exact material state git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28 and current A0 approval 29410 bytes/SHA-256 30239028370A7EE28D3A044FB5CABD4886F7B14B69DB23FCF23E8E886842B974. Its sole warning is exactly W_PREFLIGHT_A2_CONVERGENCE; fresh independent A0 proved the exception binary and necessary, while current final A2 independently confirms unchanged F-A1-02 semantic root, owners, strategy and approval envelope plus closure_safe=true and completion_safe=true. No EP-03B/EP-03C plan exists; terminal commit resolution remains the postcommit coordinator consumer before the successor is created.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Manual authority, identity-graph, implementation and live-contract review",
        "evidence": "AGENTS, Architecture and every changed live contract retain one owner for schema, authorization, port parsing, durable writes/readback, generation transitions, recovery causation and redacted events. The exact Project/Task/run/member/execution/fence/workspace/operation tuple is consumed end to end; planned Git, policy, completion, scheduler, Codex and MCP owners remain unimplemented.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Authorization static, unit, persistence, confirmation and failpoint tests",
        "evidence": "Tests prove contiguous cumulative stages 1/2/3/4/5; stage 5 adds exactly workspace.reserve/create/inspect/recover/cleanup, cleanup alone is newly high-risk, bootstrap and renewal do not upgrade, and separately confirmed upgrades plus denial/stale/revoked/failpoint routes preserve atomic grant, epoch, decision and audit state.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "ato.workspace/v1 contract, hostile-shape, taxonomy and production-source inventory tests",
        "evidence": "The exact five-operation port accepts only its closed request, receipt and fifteen-category error matrices; malformed, accessor, proxy, normalization, bound, identity, revision, fence and inventory drift is rejected before backend use. Production sources contain no Git, child-process, filesystem or vendor adapter import.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Shared contract/replay/inspection tests plus source and packed-package inventory",
        "evidence": "One unexported in-memory test Fake implements all five operations and passes shared behavior, replay and inspection coverage. Production and packed inventories contain no Fake, concrete Git/Codex/scheduler adapter, workspace path mutation or added production dependency, and all effects remained disposable Fake state.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Canonical migration bytes, registry identity, fresh-open and refusal matrix tests",
        "evidence": "The sole canonical LF schema-version-1 baseline hashes to 34440A65E9CC73BF8C6575F8563745D4FFDD71A9E065E6BD4A6062904174D8CA. Fresh initialization is atomic; the prior checksum 518E84129E6753E7D0E5078223DCCB43E155AA2FD2120DD2A4C3F5F633FCEBFA plus zero-length, partial, edited, old/unknown-vocabulary and malformed inputs are refused before writable open without migration, adoption or repair; the distinct Git base remains fc42a2ead9698e2e25341b014526d4b348fc016c.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Persistence architecture, SQL/CAS writer, decoder/digest, backup/restore and projection tests",
        "evidence": "ApplicationTransaction is the sole workspace SQL/CAS writer and the combined typed state decoder/digest is the complete readback owner. Every workspace row is included exactly once in current state and backup/restore projections; the schema allocates no ProjectPolicy, CompletionBackend/gate, integration, scheduler, Codex, MCP, diagnostic-export or product-cleanup family.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Typed corruption, mutation/restart/readback and sensitive-sentinel tests",
        "evidence": "Orphaned, substituted, noncontiguous, stale-fence, duplicate, unknown-code, invalid-transition and incomplete evidence lineages fail as typed corruption without defaulting or repair. Task, path, environment, credential, adapter-message, SQL and stack sentinels remain absent from bounded durable events and application results.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Focused application ownership, trusted-ingress, current-binding and transaction-boundary tests",
        "evidence": "Closed input is parsed before trusted ingress; current Project/Task/run/member/execution/lease/fence and grant/confirmation facts are revalidated in short transactions, including a fresh trusted runtime/Project-root check immediately before Act. Backend and observation calls remain outside writers, and denial or CAS conflict performs no unauthorized effect or partial accepted write.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "Competing-worker, exact replay, generation replacement, revision and fence tests",
        "evidence": "Concurrent workers produce one reservation/generation winner; exact replay returns stable IDs; replacement requires an exact cleaned predecessor and advances generation by one. Legitimate current revision renewal can progress while stale revisions, owners and fences cannot act, observe or finalize, and each accepted edge advances only its owned revision.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "Real SQLite reopen, every-checkpoint restart, response-loss, ambiguity and causation tests",
        "evidence": "Reserve/create/recover/cleanup and read-only inspect reopen correctly after prepare, effect-possible CAS, effect/response loss, observation, receipt and finalization boundaries. The shared revision-R causation proof rejects old resolved roots and ambiguous inspect roots, accepts only effect-capable same-generation acyclic roots at the recover prepare/Act revision, preserves nested same-R recovery, and prevents blind replay or duplicate effects.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V12",
        "status": "passed",
        "method": "Every-write failpoint, competing SQLite writer, stale authorization and old-fence matrix",
        "evidence": "Injected failures at each workspace insert, update and finalization stage prove all-or-none transactions and successful restart. Competing writers, expired authority, run/execution drift and late old-fence writes preserve one current lineage without duplicate receipt, fabricated rollback or partial transition.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V13",
        "status": "passed",
        "method": "Manual source, contract, package and capability-claim review",
        "evidence": "The changed surface exposes only dedicated bounded workspace lifecycle evidence and no general logger, telemetry, diagnostic exporter or support claim. No production Git/Codex/scheduler/ProjectPolicy/CompletionBackend behavior, D:\\quant special case, raw path/content/error, credential or adapter payload is present.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V14",
        "status": "passed",
        "method": "Impact-selected workspace/application/recovery/security, authorization, persistence and architecture test groups",
        "evidence": "The final focused application suite passed 15/15 and the four workspace groups passed 58/58, including recovery causation, decoder, export, redaction, concurrency, restart and no-external-effect cases. Required cases report zero fail/skip/todo and no task-artifact member survived.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V15",
        "status": "passed",
        "method": "Pinned network-disabled pnpm verify:offline complete repository gate",
        "evidence": "Node 24.19.0, pnpm 11.19.0 and TypeScript 5.9.3 passed lint over 245 files/45 production sources, strict typecheck, build and 492/492 tests with zero fail/skip/todo; docs passed 125 Markdown, 254 links, 22 fragments and zero forbidden findings; production dependencies remained zero; the 180-file packed consumer/export/persistence/console/uninstall smoke, Windows SQLite with no survivor and truthful blocked/not-run Codex boundary all passed without dependency repair.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V16",
        "status": "passed",
        "method": "Separately authorized pnpm dependency:audit registry advisory query plus manifest/lock review",
        "evidence": "The authorized advisory query exited 0 with no known vulnerabilities. Production dependency count is zero and the TypeScript 5.9.3-only development dependency/lock shape is unchanged; no credential, install, manifest rewrite or unrelated network action occurred.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      },
      {
        "id": "V17",
        "status": "passed",
        "method": "Fresh independent A1/A2, current trace, docs/diff/package evidence and exact regular no-follow candidate inventory",
        "evidence": "Fresh A1 is parent-complete and final fresh A2 binds git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28, closes F-A1-01..F-A1-06 and all adjacent A2 residuals with findings=[] and explicit closure/completion safety. Current docs:check passes 126 Markdown, 254 links, 22 fragments and zero forbidden findings; git diff --check exits 0 apart from informational EOL warnings; the exact 61-member candidate inventory is task-owned, repository-contained, regular and no-follow with zero bad member; package smoke already passed the declared 180-file export/current-baseline consumer. This plan-excluded terminal record and active-to-completed move are the final lifecycle delta; exact staging is rechecked before the single result commit. Current-head prune, fourteen gates, readiness, FF-only integration and ordinary push remain postcommit coordinator consumers and are not claimed as already executed.",
        "state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/ep03a_a0_5",
        "independence": "Fresh independent read-only reviewer of the revised V1 contract; no role in drafting or deciding the revision, implementation, repair, A1/A2 review, product testing, file mutation, Git/ExecPlan/coordinator mutation, authorization, or external action.",
        "scope": "Complete revised active EP-03A plan and approval/execution contracts; prior approved contract and A0 history; exact V1 criterion delta; current trace; helper W_PREFLIGHT_A2_CONVERGENCE implementation; complete A2 attempt history, final A2 record and closure evidence; repository authority, serial Phase 3 boundary, authorization/external-action limits, binary validation semantics, material-base binding, and the complete Tier-2 persistence transition lens.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-02 12:41:55+08:00",
        "approval_sha256": "30239028370A7EE28D3A044FB5CABD4886F7B14B69DB23FCF23E8E886842B974",
        "reviewed_material_base": "fc42a2ead9698e2e25341b014526d4b348fc016c",
        "evidence": "Independent sorted-key compact UTF-8 canonicalization reproduced exactly 29410 bytes and SHA-256 30239028370A7EE28D3A044FB5CABD4886F7B14B69DB23FCF23E8E886842B974; restoring only the previously approved V1 criterion reproduced 29165 bytes and CFE9076E78B3B3679F0461EFCCB676FA7FC1600CF05ACBEBEE86ACE9BA4E6929, proving the sole delta. Helper source emits W_PREFLIGHT_A2_CONVERGENCE only for more than one immutable reopened A2 attempt, and EP-03A has four. Revised V1 remains binary and fail-closed: trace must be ok with no error/outside-scope/dirty overlap, and warnings must be empty or exactly the sole convergence advisory; the exception additionally requires the current final independent A2 to confirm unchanged semantic root, repair strategy and approval envelope plus closure/completion safety. The current A2 at git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28 meets those conditions with findings=[] and exact closure of F-A1-01..F-A1-06. The revision changes no implementation, material state, scope, authorization, persistence guarantee, product/API behavior, other validation criterion or successor capability; no EP-03B/EP-03C plan exists. The complete Tier-2 writer/decoder, identity/policy/revision/fence/CAS, pre-write refusal, effect-outside-writer, immutable evidence, redaction and restart/failpoint/ambiguity recovery lens remains activation-ready. no_findings.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/ep03a_a1",
        "independence": "Fresh independent read-only reviewer; no proposal drafting, implementation, product testing, file mutation, Git/coordinator mutation, authorization, or external-action role.",
        "scope": "The stable complete EP-03A task diff and untracked inventory at the exact reviewed state, active plan and A0 history, repository authority, full authorization/persistence/reliability/adapter/workspace/security/compatibility/validation contracts, Tier-2 persistence lens, Fake-only boundary, tests and parent-supplied primary validation.",
        "reviewed_at": "2026-09-02 09:55:23+08:00",
        "evidence": "The reviewer read the complete scoped diff and authoritative contracts, twice reproduced the warning-free trace state, and reported six evidence-backed implementation defects. The parent reproduced every cited control-flow, decoder, state-machine, error-taxonomy and external-validation gap; details are preserved in docs/plans/evidence/EP-03A/a1-implementation-audit.md. No out-of-scope path, real external effect, or sensitive raw-value persistence was found.",
        "reviewed_state_id": "git-sha1:fb09c8d78c8a3da2d92f9f73cc1a5911f6436585",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-A1-01",
            "severity": "HIGH",
            "summary": "Terminal workspace replay returns before current trusted principal/runtime-root and owner validation.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Move bounded terminal replay behind current binding and trusted runtime/Project-root validation and add substituted-principal, root and stale-owner replay regressions.",
            "closure_evidence": "The parent moved terminal replay behind current owner binding plus trusted principal/runtime/Project-root validation and added substituted-principal, changed-root and current-revision replay regressions. Focused workspace tests passed 52/52 and the post-repair offline gate passed 486/486; fresh A2 closure remains required.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-02",
            "severity": "HIGH",
            "summary": "The combined decoder accepts verified intents without receipts and fabricated success without a finalize decision/event.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Enforce exact receipt cardinality, decision phase/order/current binding, successful finalization authority and terminal-event lineage, with direct corruption regressions.",
            "closure_evidence": "The combined decoder now enforces phase order/current decision, exact verified receipt/event cardinality, terminal event/finalization lineage, successful finalize authority and matching receipt outcome. Direct verified-without-receipt and fabricated-finalization corruptions are rejected; focused tests passed 52/52 and the offline gate passed 486/486. Fresh A2 closure remains required.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-03",
            "severity": "HIGH",
            "summary": "A legitimate current run/member/execution revision advance permanently strands an immutable workspace generation.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Separate stable generation lineage from monotonic current revisions while retaining exact current command, authority, membership, attempt and fence checks; test fresh progress after renewal.",
            "closure_evidence": "Generation ownership now retains creation-time monotonic revision floors while every command and act/finalize decision still binds exact current revisions; stable IDs, membership revision, attempt and fence remain exact. Prepared and verified operations progress after legitimate renewal in restart tests, authoritative contracts were synchronized, focused tests passed 52/52 and the offline gate passed 486/486. Fresh A2 closure remains required.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-04",
            "severity": "MEDIUM",
            "summary": "The closed ato.workspace/v1 adapter error category flags are inverted and terminal classification ignores validated ambiguity.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Enforce the complete category-to-retryable/ambiguous table and derive no-effect versus ambiguous durable transitions from the validated error flags.",
            "closure_evidence": "The port parser now enforces the exact 15-category retryable/ambiguous matrix, including the previously omitted categories, and internal failures plus durable transitions consume the validated ambiguity flag. Complete positive and flag-mismatch table tests passed with the 52/52 focused workspace suite and 486/486 offline gate. Fresh A2 closure remains required.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-05",
            "severity": "MEDIUM",
            "summary": "A receipt-free pre-Act reserve failure leaves an allocated generation with no safe retry or recovery route.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Recognize only a closed observation-free, receipt-free, non-ambiguous pre-effect failure proof and permit a fresh-authorized same-generation reserve retry.",
            "closure_evidence": "Same-generation reserve reuse now accepts only a terminal failed intent with zero observations, no receipt, explicit non-ambiguity, a receipt-free failed finalization, unchanged allocated generation revision/status and no unfinished peer. Pre-Act denial and non-ambiguous failure retry regressions passed in the 52/52 focused suite and 486/486 offline gate. Fresh A2 closure remains required.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-06",
            "severity": "MEDIUM",
            "summary": "Act does not revalidate the physical Project-root identity after prepare and before backend invocation.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Run trusted runtime and Project-root validation outside the writer immediately before Act, persist a no-effect denial on failure, and test a prepared root swap with zero backend calls.",
            "closure_evidence": "A fresh trusted runtime and Project-root validation now runs outside the writer after the prepared gap and before Act; failure commits a receipt-free no-effect terminal record and never invokes the backend. The prepared-root-swap zero-call regression passed in the 52/52 focused suite and 486/486 offline gate. Fresh A2 closure remains required.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "/root/ep03a_a2",
        "independence": "Fresh, independent, non-implementing, strictly read-only same-A2 freshness reviewer; no file mutation, test execution, Git/ExecPlan/coordinator mutation, authorization decision, or external effect.",
        "scope": "Exact freshness rebind of F-A1-01..F-A1-06 closure and F-A2-01..F-A2-05 residual closure at the terminal material state; bounded review of recovery revision-R causation, old-root rejection, nested same-R behavior, inspect-root exclusion, projection consumers, combined decoder, package/persistence export boundaries, convergence history, and parent closure evidence.",
        "reviewed_at": "2026-09-02 12:31:29+08:00",
        "evidence": "The reviewer read repository guidance, ExecPlan audit/schema guidance, the active plan and complete attempt history, actual parent evidence docs/plans/evidence/EP-03A/a2-closure.md at Git blob 7ac9311945c25e76588003862b7f3ae193f60829, and all relevant current implementation/export/test surfaces. Two fresh traces reproduced exact state git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28, approval bytes 29165 and SHA-256 CFE9076E78B3B3679F0461EFCCB676FA7FC1600CF05ACBEBEE86ACE9BA4E6929 with empty errors/outside_scope/overlap/pre_existing_dirty. The shared revision-R causation proof, old-root and inspect-root rejection, nested same-R behavior, projection consumers, decoder and internal export boundaries close every A1 finding and A2 residual. W_PREFLIGHT_A2_CONVERGENCE is non-blocking because all reruns stayed inside F-A1-02's semantic root, owners, strategy and approval envelope; attempt 5 became stale only when immutable parent closure evidence changed the material manifest. Parent closure evidence correctly separates parent-run validation from reviewer execution and supports complete disposition. No test was run during this freshness review.",
        "reviewed_state_id": "git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28",
        "parent_disposition": "complete",
        "closes": ["F-A1-01", "F-A1-02", "F-A1-03", "F-A1-04", "F-A1-05", "F-A1-06"],
        "findings": []
      }
    },
    "audit_attempts": [
      {"audit": "A0", "attempt": 1, "report_status": "complete", "finding_ids": ["F-A0-01", "F-A0-02", "F-A0-03", "F-A0-04"], "disposition": "superseded", "reason": "Fresh independent A0 found an incomplete task envelope, an unclosed durable generation state machine, stage-5 provenance drift and an imprecise prior-baseline identity; all were confirmed and the approval contract was revised before implementation."},
      {"audit": "A0", "attempt": 2, "report_status": "complete", "finding_ids": [], "disposition": "stale", "reason": "The no-finding A0 was current at activation, but the first active trace exposed W_PREFLIGHT_LIFECYCLE_SCOPE because the helper additionally requires the singular proposal lifecycle path; adding that exact task path revised approval before implementation."},
      {"audit": "A0", "attempt": 3, "report_status": "complete", "finding_ids": [], "disposition": "stale", "reason": "The no-finding activation A0 became stale when the first full EP-03A regression exposed one exact static source-inventory test outside the task envelope; the approval contract added only that necessary validation owner before any edit to it."},
      {"audit": "A0", "attempt": 4, "report_status": "complete", "finding_ids": [], "disposition": "stale", "reason": "The no-finding activation A0 became stale when immutable repeated A2 history made the helper's sole W_PREFLIGHT_A2_CONVERGENCE advisory unavoidable while V1 still required an empty warning list. V1 was narrowly revised to permit only that exact advisory when the current final independent A2 proves unchanged root, strategy and approval envelope plus closure/completion safety; fresh independent A0 approved the sole contract delta before terminal validation."},
      {"audit": "A2", "attempt": 1, "report_status": "complete", "finding_ids": ["F-A2-01", "F-A2-02"], "disposition": "reopened", "reason": "Fresh A2 closed three A1 roots and confirmed the other direct repairs, but found same-family local residuals in persisted receipt/failure semantic revalidation and one contradictory twelve-versus-fifteen category paragraph. The repair strategy and approved envelope remained stable, so the parent repaired, revalidated and routed a fresh rerun of the same A2 without A3 or reopened A1."},
      {"audit": "A2", "attempt": 2, "report_status": "complete", "finding_ids": ["F-A2-03", "F-A2-01"], "disposition": "reopened", "reason": "The fresh same-A2 rerun closed five A1 roots and the adapter taxonomy residual, but kept F-A1-02 open for two direct decoder gaps: a successful chain did not prove every prepare/act/finalize authorization phase allowed and recover status projection did not first validate an exact same-generation durable ambiguous acyclic causation chain. The approved strategy and envelope remain stable; the parent will repair, revalidate and fresh-rerun this same A2 without A3 or reopened A1."},
      {"audit": "A2", "attempt": 3, "report_status": "complete", "finding_ids": ["F-A2-04"], "disposition": "reopened", "reason": "The fresh same-A2 rerun closed the authorization-pattern and structural-causation residuals but found one directly adjacent semantic root gap: an ambiguous inspect could replace the original effect-possible reserve/create/cleanup cause and make recovery project the wrong durable generation status. The same owner, strategy and approved envelope remain convergent; the parent will share the exact root predicate across application, decoder and projector, add behavior regressions, revalidate and fresh-rerun this same A2."},
      {"audit": "A2", "attempt": 4, "report_status": "complete", "finding_ids": ["F-A2-05"], "disposition": "reopened", "reason": "The fresh same-A2 rerun closed the effect-capable-root and inspect-root residual, but found one directly adjacent current-causation gap: a historical ambiguous effect root already resolved at an older generation revision could be reused during a newer recovery-required episode. The parent reproduced both application acceptance and same-operation decoder acceptance, while the nested same-revision positive passed. The same owner, strategy and approved envelope remain convergent; the parent will bind the shared proof to the recover prepare/Act revision and fresh-rerun this same A2."},
      {"audit": "A2", "attempt": 5, "report_status": "complete", "finding_ids": [], "disposition": "stale", "reason": "Fresh A2 closed every A1 finding and A2 residual with no new finding at git-sha1:3c189956a6346cccb7cdca4e0956bf31317e433d. Parent persistence of the immutable closure-evidence file necessarily changed the material manifest, so one final read-only freshness rerun is required before the current A2 record can bind the terminal state."}
    ],
    "validation_attempts": [
      {"validation_id": "V15", "attempt": 1, "classification": "deterministic_failure", "at": "2026-09-02 10:53:09+08:00", "evidence": "Post-A2-repair pnpm verify:offline reached the complete 487-test run with 485 passing and two exact export-surface failures: internal workspace semantic helpers leaked through the package root and two internal model aliases widened the explicit persistence facade. The parent preserved the frozen public surfaces with an explicit existing workspace-port export list and internal-only port type imports; strict typecheck plus the two architecture suites then passed 11/11.", "state_id": "git-sha1:b96fd818c47f4bd0c952d3a8eb1b6f22ca28e3c3"}
    ],
    "contract_revisions": [
      {"at": "2026-09-01 23:08:17+08:00", "summary": "Expanded the task envelope by the five A0-identified owners/tests, froze the exact durable generation state machine and recovery binding, corrected stage-5 design provenance, and named the prior migration checksum separately from the Git base.", "previous_approval_sha256": "F2192ADFB31033B3E488B19BFB409F3DF45E819DB4C35943BE2CA5349FB90E10"},
      {"at": "2026-09-01 23:14:26+08:00", "summary": "Distinguished durable allocation from the effect-capable reserve operation and closed verified success, no-effect/refusal, ambiguity and recovery edges for reserve, create, inspect and cleanup before the replacement-generation CAS.", "previous_approval_sha256": "C195E2D49D236225EFEC9FA494D5800EC288DE188D16C5D7F273196C85332F24"},
      {"at": "2026-09-01 23:21:19+08:00", "summary": "Added the helper-required singular proposal lifecycle path to the task envelope after the first active trace exposed W_PREFLIGHT_LIFECYCLE_SCOPE; no implementation or product contract changed.", "previous_approval_sha256": "44C5EF454C1398423BE14320EDE11A34ED99276AF0304B783BB53B5F86AC77BD"},
      {"at": "2026-09-02 00:09:06+08:00", "summary": "Added the exact static source-inventory contract test exposed by the first full EP-03A regression; no product, schema, authorization, external-action or validation outcome changed.", "previous_approval_sha256": "5576A7E0758AD5EC1596F2F25E82038C72502CB5D17E0509C95220E2023453F2"},
      {"at": "2026-09-02 12:36:20+08:00", "summary": "Narrowed V1 to recognize only the helper's immutable-history W_PREFLIGHT_A2_CONVERGENCE advisory when the current final independent A2 explicitly proves unchanged root, strategy and approval envelope plus closure/completion safety; no implementation, material state, authorization, scope or other validation outcome changed.", "previous_approval_sha256": "CFE9076E78B3B3679F0461EFCCB676FA7FC1600CF05ACBEBEE86ACE9BA4E6929"}
    ],
    "final_summary": "EP-03A establishes only the authorized fresh Phase 3 durable workspace foundation: one exact pure ato.workspace/v1 port, a typed application coordinator, finite workspace authorization stage 5, a replaced current-only schema-version-1 baseline, complete durable workspace identity/generation/intent/observation/receipt/finalization records, one shared revision-R recovery-causation proof, and dedicated bounded redacted lifecycle evidence exercised solely through an unexported in-memory Fake. Exact material state git-sha1:25d8ab9a5284bbfba18b3e14eb1e413a070d4f28 passes focused 15/15 and 58/58 coverage, the pinned complete offline route with 492/492 tests, 125/254/22/0 documentation checks, 180-file package smoke, SQLite and truthful Codex-boundary checks, plus the separately authorized dependency advisory query. Fresh A0 approved the final contract; A1's six findings and all five adjacent A2 residuals are closed by final fresh A2 with findings=[]. No real Git/filesystem workspace adapter, ProjectPolicy, CompletionBackend/gate, scheduler, Codex/MCP, release, deployment or platform-support claim is implemented. The terminal result commit, pathless artifact prune, exact-head gates, readiness, FF-only integration and ordinary push remain the authorized coordinator consumers of this completed candidate before EP-03B may be created."
  }
}
```

## Context

The verified pre-implementation baseline is clean `task/ep-03a` at `fc42a2ead9698e2e25341b014526d4b348fc016c`, with local `master` and `origin/master` tracking equal, Git-flow state version 2 at generation 644 before task start, no pending operation or reservation, and no pre-existing dirty overlap. Exact Node 24.19.0/pnpm 11.19.0 baseline validation passed `pnpm verify:offline` with 432/432 tests, docs 115/254/22/0, 172 packed files, the Windows SQLite feasibility matrix and truthful blocked-only Codex evidence; the separately authorized registry query reported no known vulnerabilities. The coordinator has one unrelated historical `repair-delayed-cleanup` task in pushed state; cleanup is separately authorized and outside EP-03A, so it remains untouched.
