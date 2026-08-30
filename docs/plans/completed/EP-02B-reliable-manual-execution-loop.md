# ExecPlan：建立可靠的 Manual 执行闭环

本计划只实现 Phase 2 的第二段：在已验证并推送的 EP-02A claim/lease/fence 基础上，建立 library-only 的可靠 Manual 执行闭环。EP-02A 的终态不是本计划的执行证据；本计划拥有独立的 planning、activation、implementation、audit、validation 和 Git-flow 生命周期。

~~~execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-30 21:02:48+08:00",
    "updated_at": "2026-08-31 02:24:00+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user directive in thread 01a0521b-4236-7130-9116-bfd80373cf18",
        "at": "2026-08-30 21:02:48+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "current user directive and repository persistence/ExecPlan contracts",
        "at": "2026-08-30 21:02:48+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "At the verified EP-02A terminal base, implement and validate a library-only reliable Manual execution loop: the explicitly corrected-before-first-implementation ato.execution/v1 port and shared contract kit, one production local Manual backend with durable independently inspectable turn state and a single authorization-bound Manual outcome ingress, a test-only Fake backend, additive schema-v6 intent/observation/verified-receipt/finalization and Manual-completion records, application-owned prepare-to-finalize operations for start, inspect, Manual outcome report, resume, retry and cancellation, reconcile-first stale-running/lease recovery, complete waiting metadata, and a separate explicit authorization- and confirmation-bound Manual completion acceptance that alone may close running to completed after a verified turn_succeeded fact.",
    "non_goals": [
      "Do not implement Codex, Git, workspace, SchedulerBackend, ProjectPolicy adapter, CompletionBackend, completion gates, dispatcher candidate sweep, scheduler delivery, MCP, multi-candidate fan-out, D:\\quant dogfood, release, deployment, telemetry, diagnostic bundles, or general log files.",
      "Do not add a public Phase 2 product CLI/API command; EP-02D owns Manual dispatch, inspect, resume, retry, cancel and completion-acceptance product ingress after compatibility analysis.",
      "Do not create or activate EP-02C or EP-02D before this task has a verified terminal commit, current-head prune and gate receipts, FF-only local integration, and verified ordinary origin/master push.",
      "Do not rewrite historical completed plans, released migrations 0001 through 0005, historical authorization epochs/grants, or evidence merely to remove a current finding."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "The exact predecessor is pushed EP-02A commit d8afb79090906c263c7b91eca5234e613e066d04, and the ordered chain remains EP-01D -> EP-02A -> EP-02B -> EP-02C -> EP-02D -> Phase 3; no successor work starts before this task reaches its separately verified Git-flow terminal.",
        "source": "current user directive; docs/plans/README.md"
      },
      {
        "id": "C2",
        "statement": "Schema change is one narrow additive migration 0006. Released migrations 0001-0005 and their canonical checksums remain byte-identical; every historical schema prefix, authorization vocabulary/epoch/grant, lifecycle digest version, backup and doctor classification remains strictly readable or fails with its existing typed incompatibility/corruption result.",
        "source": "current user directive; docs/reference/persistence-contract.md"
      },
      {
        "id": "C3",
        "statement": "Repository truth proves that ato.execution/v1 is still planned only: no implementation, export, negotiation, persisted receipt or external consumer exists. Before its first implementation, this approval authorizes one explicit correction of that same v1: start is a mutating execution.start operation for a Manual no-workspace turn, requires workspace_mode=none, and omits workspace receipt, working-directory and environment fields. Resume remains execution.resume or execution.retry, inspect remains execution.inspect, request_cancel remains execution.cancel, and the existing closed lifecycle plus exact adapter-error meanings remain unchanged. adapter-contracts and versioning-compatibility must record why this pre-implementation correction is safe and close v1 against later required-field or authorization reinterpretation. Application owns authorization, Domain selection, intent lifecycle, receipt verification and finalization; adapters never authorize, complete a Task, select Domain commands, or write core SQLite relations directly.",
        "source": "current user directive; current AGENTS.md/ARCHITECTURE.md no-adapter baseline; docs/reference/adapter-contracts.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C4",
        "statement": "Every effect-capable start, resume, retry, request-cancel and Manual outcome-report operation persists and compares the complete applicable semantic tuple, stable idempotency key, final allow binding, adapter contract/version, Project resource/config and local-policy binding, Task/execution/attempt/fence/revision identities, immutable input reference, and workspace_mode=none marker. Tuple or payload drift is an integrity conflict.",
        "source": "docs/reference/reliability-protocol.md#operation-semantic-identity-and-policy-binding"
      },
      {
        "id": "C5",
        "statement": "The ordered protocol is prepare pending -> mark executing -> act outside a database transaction -> independently inspect -> persist observation -> verify immutable receipt -> CAS finalize. No adapter call, confirmation, ID allocation, awaited work, or filesystem inspection occurs in the core writer transaction; no effect occurs before committed intent.",
        "source": "current user directive; docs/reference/reliability-protocol.md#intent-receipt-verification-and-finalization"
      },
      {
        "id": "C6",
        "statement": "The only new grantable actions are execution.start, execution.inspect, execution.resume, execution.retry, execution.cancel and execution.completion.accept. Migration, bootstrap and renewal never grant them: one fresh identity- and confirmation-bound vocabulary-5-to-6 upgrade is required, and vocabulary 4 must first complete its separate vocabulary-5 upgrade.",
        "source": "current user directive; docs/reference/authorization-contract.md"
      },
      {
        "id": "C7",
        "statement": "turn_succeeded finalizes only an execution-turn fact. running-to-completed requires a distinct current execution.completion.accept grant, fresh named confirmation, exact verified receipt/finalization and current Task/execution/attempt/fence/Project revisions; Manual completion decision, Domain completion_accepted, sanitized audit and readback commit atomically.",
        "source": "current user directive; docs/reference/domain-contract.md; docs/reference/adapter-contracts.md"
      },
      {
        "id": "C8",
        "statement": "request_cancel is not interruption evidence. Task remains running until later authorized inspection verifies cancelled or absent state; only that current receipt may drive interruption_verified. Unknown or conflicting state becomes waiting/ambiguous_external_state.",
        "source": "current user directive; docs/reference/domain-contract.md; docs/reference/adapter-contracts.md"
      },
      {
        "id": "C9",
        "statement": "The Phase-2A effect-free takeover shortcut ends in schema v6. Expiry never authorizes blind takeover: unfinished intents and backend identity reconcile first; only proven-safe state receives a higher attempt/fence, ambiguity produces complete waiting metadata, and every old-fence late write is rejected.",
        "source": "current user directive; docs/reference/reliability-protocol.md#claim-lease-and-fencing"
      },
      {
        "id": "C10",
        "statement": "The production Manual backend is a real local adapter with a durable independently inspectable journal behind injected ExecutionBackend and ManualOutcomeControl/v1 interfaces. ReliableExecutionLoop.recordManualOutcome is the sole authoritative non-CLI writer ingress: it requires a trusted local_manual_operator actor, a current execution.inspect allow for the exact Project/Task/execution scope, and a fresh manual.turn.report confirmation; atomically commits that decision plus a manual_report intent before invoking the control outside the core transaction; and then independently reads through ato.execution/v1 inspect before observation, verification and finalization. The closed report operations are activate, wait, succeed, fail and confirm_cancelled; queued may move to active/waiting/turn_succeeded/failed/cancelled, active to waiting/turn_succeeded/failed/cancelled, waiting to active/turn_succeeded/failed/cancelled, terminal states are immutable, and confirm_cancelled additionally requires an exact prior cancellation-request revision. Every report binds report/operation/intent/idempotency IDs, actor/decision/confirmation, Project/config/Task/input/execution/attempt/fence/backend/thread identities, expected journal revision/state, target state, bounded code/evidence reference and workspace_mode=none. The journal applies one exact idempotent CAS, rejects competing, drifted or stale-fence writers, persists only bounded redacted state, and exposes independent restart readback. Core records own orchestration and the journal owns only Manual turn state; outcome reporting never mutates Task state or constitutes completion. Fake remains test-only and unexported.",
        "source": "current user directive; ARCHITECTURE.md; docs/reference/adapter-contracts.md"
      },
      {
        "id": "C11",
        "statement": "Every running-to-waiting finalization writes the complete closed waiting envelope, including reason, phase, required action, redacted code/summary, retry facts and applicable execution/backend identities at the accepted Task revision. Resume/retry must satisfy the exact continuation predicate and current authorization.",
        "source": "current user directive; docs/reference/domain-contract.md#waiting-taxonomy"
      },
      {
        "id": "C12",
        "statement": "Crash evidence covers before/after intent, executing mark, Manual journal mutation, response loss, observation, receipt, verification, finalization and completion CAS. Restart returns persisted finalization, inspects before uncertain replay, preserves verified-not-finalized and ambiguous evidence, and rejects old-fence writes.",
        "source": "current user directive; docs/reference/reliability-protocol.md#recovery-matrix; docs/security/threat-model.md"
      },
      {
        "id": "C13",
        "statement": "Intent, journal, observation, receipt, finalization, decision, audit, status and errors use closed bounded metadata and never persist/display Task body, prompt, source content, Project path, environment values, credentials, raw adapter payload/error, SQL, stack or arbitrary free text.",
        "source": "current user directive; docs/security/privacy-and-logging.md"
      },
      {
        "id": "C14",
        "statement": "Claims are limited to the library Manual loop. ato.api/v1 grammar and public CLI output/error/exit contracts remain compatible and expose no Phase 2 command; no platform, scheduler, dispatcher, workspace, Git, completion-gate, network or release claim is inferred.",
        "source": "current user directive; docs/reference/cli-contract.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C15",
        "statement": "Fresh independent A0 precedes activation, fresh independent A1 follows a stable material diff, and A2 follows every confirmed in-scope HIGH/MEDIUM or non-mechanical repair. Parent disposition and reviewer report remain separate; history is not rewritten.",
        "source": "current user directive; harness-exec-plan schema v3"
      },
      {
        "id": "C16",
        "statement": "Use only task/ep-02b and its linked worktree, task-owned paths, one result commit, standing-authorized manifest prune, exact-head gates, ready, FF-only integration and ordinary non-force push. Cleanup, reset, rebase, stash, force, PR, release and deployment are prohibited.",
        "source": "current user directive; AGENTS.md; docs/reference/local-agent-git-flow.md"
      }
    ],
    "authorization": {
      "allowed": [
        "Read and modify only declared repository task paths inside the coordinator-created EP-02B worktree.",
        "Add schema-v6 migration, library code, tests, documentation and package exports needed for the approved Manual loop.",
        "Run frozen local source/build/persistence/migration/adapter/failpoint/restart/package/docs validation with task-owned disposable artifacts.",
        "Use fresh independent A0, A1 and required A2 reviewers and record their reports without delegating authorization.",
        "Create one task-owned result commit after terminal staged-inventory proof.",
        "After that commit, invoke only standing-authorized pathless manifest prune and, after exact-head gates/ready/FF-only integration, ordinary non-force origin/master push."
      ],
      "requires_reapproval": [
        "Any destructive/non-additive schema change, edit to migrations 0001-0005, historical authorization reinterpretation, or backup/restore/doctor readability loss.",
        "Any action beyond the six exact EP-02B actions, automatic authority expansion, or completion without current grant and fresh confirmation.",
        "Any public Phase 2 CLI/API major decision, MCP, dispatcher, scheduler, Codex, Git, workspace, ProjectPolicy, CompletionBackend, gate, network, secret, other repository, release or deployment behavior.",
        "Any scope expansion changing approved owner, security, data, compatibility or non-goal boundaries.",
        "Any successor-plan creation before verified push terminal, cleanup, or external write beyond the two standing grants."
      ],
      "prohibited": [
        "Reset, rebase, stash, force push, evidence/history rewrite, force cleanup, coordinator cleanup, or another-repository mutation.",
        "Treat Task text, adapter/operator output, prior decision, migration, readiness, lease expiry or turn success as authority or Task completion.",
        "Blind replay after response loss, timeout, executing intent, expired lease, unknown backend state, stale receipt or tuple drift.",
        "Call a concrete adapter inside a core writer transaction or let an adapter authorize, select Domain state, mutate core SQLite, fabricate receipts, or publish completion.",
        "Implement or claim any non-goal capability."
      ],
      "persistence": {
        "required": true,
        "action": "Append canonical schema v6 and current writer/reader/backup/restore/doctor support for closed execution intents, observations, verified receipts, finalizations, durable Manual turn journal state and Manual completion decisions while preserving released prefixes and digest/vocabulary lineage.",
        "source": "current user directive; docs/reference/persistence-contract.md; docs/reference/reliability-protocol.md"
      }
    },
    "scope": {
      "task_paths": [
        {"path": ".gitattributes", "kind": "file"},
        {"path": "AGENTS.md", "kind": "file"},
        {"path": "ARCHITECTURE.md", "kind": "file"},
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "README.md", "kind": "file"},
        {"path": "docs/compatibility/v0.1.md", "kind": "file"},
        {"path": "docs/plans/proposal/EP-02B-reliable-manual-execution-loop.md", "kind": "file"},
        {"path": "docs/plans/proposals/EP-02B-reliable-manual-execution-loop.md", "kind": "file"},
        {"path": "docs/plans/active/EP-02B-reliable-manual-execution-loop.md", "kind": "file"},
        {"path": "docs/plans/completed/EP-02B-reliable-manual-execution-loop.md", "kind": "file"},
        {"path": "docs/plans/evidence/EP-02B", "kind": "directory"},
        {"path": "docs/reference/adapter-contracts.md", "kind": "file"},
        {"path": "docs/reference/authorization-contract.md", "kind": "file"},
        {"path": "docs/reference/cli-contract.md", "kind": "file"},
        {"path": "docs/reference/completion-workspace-contract.md", "kind": "file"},
        {"path": "docs/reference/contract-ownership.md", "kind": "file"},
        {"path": "docs/reference/domain-contract.md", "kind": "file"},
        {"path": "docs/reference/persistence-contract.md", "kind": "file"},
        {"path": "docs/reference/reliability-protocol.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "docs/reference/validation-policy.md", "kind": "file"},
        {"path": "docs/reference/versioning-compatibility-contract.md", "kind": "file"},
        {"path": "docs/security/privacy-and-logging.md", "kind": "file"},
        {"path": "docs/security/threat-model.md", "kind": "file"},
        {"path": "migrations/0006-phase2-manual-execution.sql", "kind": "file"},
        {"path": "package.json", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "scripts/repo-utils.mjs", "kind": "file"},
        {"path": "src/application.ts", "kind": "file"},
        {"path": "src/authorization.ts", "kind": "file"},
        {"path": "src/cli-api.ts", "kind": "file"},
        {"path": "src/execution-application.ts", "kind": "file"},
        {"path": "src/execution-loop.ts", "kind": "file"},
        {"path": "src/execution-port.ts", "kind": "file"},
        {"path": "src/index.ts", "kind": "file"},
        {"path": "src/manual-execution-backend.ts", "kind": "file"},
        {"path": "src/persistence/application-repository.ts", "kind": "file"},
        {"path": "src/persistence/backup.ts", "kind": "file"},
        {"path": "src/persistence/doctor.ts", "kind": "file"},
        {"path": "src/persistence/manual-backend-repository.ts", "kind": "file"},
        {"path": "src/persistence/migrations.ts", "kind": "file"},
        {"path": "src/persistence/store.ts", "kind": "file"},
        {"path": "test/application-service.test.mjs", "kind": "file"},
        {"path": "test/authorization.test.mjs", "kind": "file"},
        {"path": "test/cli-contract.test.mjs", "kind": "file"},
        {"path": "test/cli-e2e.test.mjs", "kind": "file"},
        {"path": "test/configuration.test.mjs", "kind": "file"},
        {"path": "test/domain-architecture.test.mjs", "kind": "file"},
        {"path": "test/domain-unit.test.mjs", "kind": "file"},
        {"path": "test/execution-claim-foundation.test.mjs", "kind": "file"},
        {"path": "test/execution-loop-authorization.test.mjs", "kind": "file"},
        {"path": "test/execution-port-contract.test.mjs", "kind": "file"},
        {"path": "test/execution-loop-recovery.test.mjs", "kind": "file"},
        {"path": "test/execution-loop-security.test.mjs", "kind": "file"},
        {"path": "test/fixtures/fake-execution-backend.mjs", "kind": "file"},
        {"path": "test/manual-execution-backend.test.mjs", "kind": "file"},
        {"path": "test/persistence-backup-restore.test.mjs", "kind": "file"},
        {"path": "test/persistence-doctor.test.mjs", "kind": "file"},
        {"path": "test/persistence-schema-migrations.test.mjs", "kind": "file"},
        {"path": "test/persistence-smoke.test.mjs", "kind": "file"},
        {"path": "test/persistence-test-helpers.mjs", "kind": "file"},
        {"path": "test/scaffold.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "Close EP-02B contracts and additive schema-v6 model for vocabulary 6, semantic identity, intent/observation/receipt/finalization, Manual journal, completion decisions and compatibility.",
        "validation_ids": ["V1", "V2", "V5", "V10"]
      },
      {
        "id": "M2",
        "outcome": "Record the authorized pre-implementation ato.execution/v1 correction, then implement its shared contract kit, package-exported production Manual backend, injected ManualOutcomeControl/v1 and durable journal, with Fake test-only.",
        "validation_ids": ["V3", "V4", "V10"]
      },
      {
        "id": "M3",
        "outcome": "Implement application-owned prepare, executing mark, act, observe, verify and CAS finalization for start/inspect with exact authorization, idempotency and response-loss recovery.",
        "validation_ids": ["V5", "V6", "V11"]
      },
      {
        "id": "M4",
        "outcome": "Close resume, retry, request-cancel, verified interruption, complete waiting metadata and reconcile-first stale-running/lease takeover without blind replay or stale-fence writes.",
        "validation_ids": ["V6", "V7", "V8", "V11"]
      },
      {
        "id": "M5",
        "outcome": "Implement separate authorization- and confirmation-bound Manual completion so verified turn success can close running/completed without ProjectPolicy, CompletionBackend or gates.",
        "validation_ids": ["V5", "V9", "V11"]
      },
      {
        "id": "M6",
        "outcome": "Close docs, compatibility, redaction, package status, complete gates, independent review, terminal inventory and Git-flow handoff without successor work.",
        "validation_ids": ["V10", "V11", "V12", "V13"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "Verified predecessor, exact chain/base, task ownership and activation readiness",
        "criterion": "At the material state that accepts this evidence, terminal-resolve and chain-check identify pushed EP-02A d8afb79090906c263c7b91eca5234e613e066d04 as the unique predecessor below exact master/origin/task base and coordinator/schema-v3 traces have no base or scope error. Fresh independent A0 reproduces the current approval digest/base and reports no finding either immediately before initial proposal activation or, after any legal active-plan approval revision, immediately before implementation resumes."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Schema-v6 identity, migration, historical readability and backup/restore/doctor compatibility",
        "criterion": "Migrations 0001-0005 retain canonical identity; fresh and every shipped prefix upgrade only through verified backup and atomic 0006; migration creates no epoch/grant/intent/turn/receipt/decision; all historical authorization and lifecycle digest versions remain readable; v6 backup/verify/restore/recovery/restart/doctor pass; malformed/current/newer/corrupt state fails typed with no partial write."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Corrected-before-first-implementation ato.execution/v1 action, field, lifecycle, receipt, version and error-taxonomy conformance",
        "criterion": "Contract evidence first proves no prior ato.execution/v1 implementation/export/negotiation/persisted receipt/consumer and records the authorized correction. The shared kit then enforces: start is mutating execution.start and adds Project/resource/config, Task/revision, immutable input, execution/revision, attempt number/revision, fence, local-policy binding and workspace_mode=none but no workspace receipt, working directory or environment; resume is mutating execution.resume|execution.retry and adds the exact existing backend execution/thread, continuation reference, previous turn receipt and expected thread; inspect is read execution.inspect with exact backend/thread and last observation; request_cancel is mutating execution.cancel with exact expected lifecycle and bounded reason. Receipts retain the common envelope, exact identity/observation fields and the established started|deferred|rejected, unknown|queued|active|waiting|turn_succeeded|failed|cancelled and requested|already_terminal|rejected lifecycles. The existing closed adapter error taxonomy is byte-for-meaning unchanged. Missing, extra, cross-class, identity, version, action, workspace or payload drift fails before backend invocation, and Manual plus Fake pass one suite with distinct adapter identity."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Real local Manual durability, independent inspection and Fake test-only boundary",
        "criterion": "Manual start/resume/cancel journal mutations and the sole recordManualOutcome path are complete-tuple idempotent and survive store/service/process reopen. Outcome report requires trusted local_manual_operator, current exact execution.inspect allow and fresh manual.turn.report confirmation; enforces the closed operation/transition table, cancellation-request precondition, exact report/operation/intent/key/decision/confirmation/Project/config/Task/input/execution/attempt/fence/backend/thread/journal identities and workspace_mode=none; and permits exactly one expected-revision CAS under competing writers. Exact response-loss retry is stable; crash/restart inspection observes the committed result; tuple/thread/payload/revision/state/fence drift and terminal rewrite fail without partial mutation. Independent ato.execution/v1 inspect returns exact bounded lifecycle/evidence, every durable/public shape is redacted, package exports Manual/control interfaces but contains no Fake, and disposable artifacts are absent."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Finite vocabulary-6 upgrade and operation/completion authorization atomicity",
        "criterion": "Migration/bootstrap/renewal and vocabulary 5 expose zero EP-02B grant; exact fresh confirmation advances only 5 to 6 and appends exactly 29 origin grants with request/decision/audit/readback atomically; vocabulary 4 requires its prior step; every operation re-authorizes exact scope; completion also requires fresh confirmation; denial/drift/failpoints produce no unauthorized effect, Task mutation or partial authority."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Ordered durable protocol, exact idempotency and crash/response-loss restart recovery",
        "criterion": "For start/resume/retry/cancel and Manual outcome report, every failpoint before/after authorization-bound prepare, executing, Manual mutation, response return, independent inspection, observation, receipt, verification and finalization reopens into the recovery matrix. No call precedes committed intent; exact retry keeps one key/effect and returns persisted finalization; drift conflicts; executing without receipt inspects first; verified-not-finalized finalizes once; unknown/ambiguous state never blindly replays or succeeds."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Start, inspect, resume, retry, cancel and verified-interruption closure",
        "criterion": "Start finalizes only a verified accepted turn; inspections append ordered immutable observations/receipts; resume/retry require the exact Domain continuation identity and timing; request_cancel leaves Task running until cancelled/absent verification; only verified interruption closes running/cancelled; invalid/stale routes have no effect."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Reconcile-first stale-running/lease recovery, waiting completeness and stale-fence exclusion",
        "criterion": "Expired running state with each unfinished intent/Manual lifecycle reconciles before takeover; only proven-safe cases obtain a greater attempt/fence, all others write exact complete waiting or interruption state, and concurrent/old-owner/old-execution/old-fence/old-revision writes fail without partial state."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Separate Manual completion and running-to-completed dependency closure",
        "criterion": "An authorization- and confirmation-bound Manual outcome report can create a journal turn_succeeded fact, but its report finalization and independently verified inspect receipt still leave Task running and dependencies locked. Only a separate current execution.completion.accept grant plus a different fresh completion confirmation consuming that exact verified turn evidence atomically appends Manual completion decision, Domain completion_accepted, execution terminal status, audit and readback; exact replay is stable and every stale or substituted identity fails with no completion."
      },
      {
        "id": "V10",
        "type": "manual",
        "target": "Architecture, owner, non-goal, package and public-version truthfulness",
        "criterion": "Review finds one owner for port, authorization, Domain, reliability, schema and Manual journal; Domain has no outer dependency, persistence neither authorizes nor selects Domain work, application imports no concrete backend, Fake is test-only, ato.api/v1 is unchanged, and docs/package claim only the library Manual loop with every non-goal absent."
      },
      {
        "id": "V11",
        "type": "automated",
        "target": "Security negatives, closed observability and redaction",
        "criterion": "Malformed/unknown/overlong/accessor/proxy/injection inputs fail before trusted ingress, persistence or adapter; sentinel Task/prompt/path/environment/credential/error/SQL/stack values are absent from all durable/public shapes; unknown adapter results become ambiguity; no content, prior decision, lease expiry or backend fact creates authority/completion."
      },
      {
        "id": "V12",
        "type": "automated",
        "target": "Impact-selected targeted and complete frozen-toolchain validation plus terminal inventory",
        "criterion": "Frozen lint, strict typecheck/build, adapter/manual/application/reliability/security/migration/persistence routes, complete tests, docs, dependency check, package smoke, SQLite, Codex blocked boundary and verify:offline all exit zero with no failure/skip/todo or artifact survivor; diff-check passes and staged inventory is task-owned only."
      },
      {
        "id": "V13",
        "type": "manual",
        "target": "Fresh independent implementation audit and closure-safe terminal state",
        "criterion": "Fresh independent non-fail-fast A1 reviews stable complete material diff and parent disposition; every confirmed finding follows schema routing, required repairs receive fresh independent A2 bound final state, no current finding remains, every milestone/validation/audit/final-summary fact is terminal with no helper-reported terminal blocker, and no EP-02C file exists in task diff."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "Adapter/journal ownership can collapse into core authority or two competing sources of truth."},
      {"id": "R2", "risk": "Crash/response loss can duplicate a Manual turn or fabricate rollback/success."},
      {"id": "R3", "risk": "Migration/renewal can auto-grant new actions or break historical epochs/grants."},
      {"id": "R4", "risk": "Lease expiry can permit blind takeover, split brain, old-fence writes or lost in-flight state."},
      {"id": "R5", "risk": "Turn success, cancel request or stale receipt can falsely complete/cancel and unlock dependencies."},
      {"id": "R6", "risk": "Waiting/error/receipt evidence can leak sensitive content or omit safe-continuation identity."},
      {"id": "R7", "risk": "Schema-v6 application expansion can invalidate lifecycle digests, backups, restore or doctor."},
      {"id": "R8", "risk": "Cross-owner change can drift scope, overclaim later phases, stale review evidence or integrate without exact proof."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Use canonical schema v6 with separate immutable intent, observation, verified-receipt, finalization and Manual-completion relations plus a narrowly mutable Manual-turn journal; current lifecycle digest provenance advances to version 3 while versions 1/2 retain exact readers.",
        "rationale": "Separate durable facts preserve crash history without reinterpreting released schema or conflating adapter state with orchestration state."
      },
      {
        "id": "D2",
        "statement": "Before first implementation, correct ato.execution/v1 start from planned execution.claim plus workspace fields to execution.start plus exact Manual workspace_mode=none fields, documenting that no implementation/export/negotiation/persisted receipt/consumer exists and preserving all other operation, lifecycle and error meanings. Define that v1 and its pure contract kit in port modules. Implement ManualExecutionBackend against a narrow ManualTurnJournal; inject only ExecutionBackend and ManualOutcomeControl/v1 interfaces into the loop; keep scripted Fake under test fixtures.",
        "rationale": "The user's required v1 can be implemented without silently reinterpreting any shipped artifact, while the explicit one-time pre-implementation correction and post-correction closure preserve version discipline, restart durability, dependency direction and one shared contract suite."
      },
      {
        "id": "D3",
        "statement": "Advance authorization one explicit step from vocabulary 5 to 6 for exactly six actions; vocabulary 4 upgrades separately through 5 before a second confirmed upgrade.",
        "rationale": "One-step lineage proves migration and earlier approval never silently expand authority."
      },
      {
        "id": "D4",
        "statement": "Use local_manual_policy/v1 derived from registered enabled Project resource/config revisions, Manual adapter/version, Task/input/execution/attempt/fence/revisions and exact workspace_mode=none in each semantic tuple. ato.execution/v1 start carries those exact no-workspace fields and no workspace receipt, working directory or environment reference.",
        "rationale": "Existing local policy binds Manual scope without inventing ProjectPolicy or omitting Project identity."
      },
      {
        "id": "D5",
        "statement": "ReliableExecutionLoop owns small transactions for prepare, executing, observation, verification, finalization and allow refresh; it invokes the injected adapter only between commits and never maps raw adapter return directly to Domain state.",
        "rationale": "This is the smallest enforceable ordered protocol and exposes every crash boundary."
      },
      {
        "id": "D6",
        "statement": "Start/resume/retry finalize when exact backend turn identity is independently observed accepted. The application-owned recordManualOutcome path, authorized by current execution.inspect and fresh manual.turn.report confirmation, is the only production writer of subsequent bounded Manual lifecycle facts; it commits a manual_report intent, invokes injected ManualOutcomeControl/v1 outside the writer transaction, then reads through ato.execution/v1 inspect before verification/finalization. Cancel finalizes only after independent interruption verification, not request acknowledgement.",
        "rationale": "The real Manual backend has a closed trusted production path to turn_succeeded and other lifecycle evidence while effect finalization, observation, Task state and cancellation proof remain distinct."
      },
      {
        "id": "D7",
        "statement": "Reconciliation examines every unfinished intent and Manual journal before expired-lease takeover. Safe continuation creates the next ordered attempt/fence bound predecessor/thread; ambiguity moves current Task to complete waiting metadata.",
        "rationale": "The Phase-2A structural no-effect shortcut ends exactly when an effect-capable backend lands."
      },
      {
        "id": "D8",
        "statement": "Manual completion is application-owned, not a CompletionBackend gate. It consumes current verified turn_succeeded, execution.completion.accept allow and fresh confirmation, then atomically records decision and invokes Domain completion_accepted.",
        "rationale": "This closes the requested Manual loop without pretending ProjectPolicy or gates exist."
      },
      {
        "id": "D9",
        "statement": "Expose only bounded IDs, enums, revisions, timestamps, retry metadata and redacted references. Keep ato.api/v1 unchanged and export only port/Manual library surface with explicit status.",
        "rationale": "Product ingress and major-version choice remain EP-02D work."
      },
      {
        "id": "D10",
        "statement": "Use frozen EP-02B coordinator task/manifest, stable-diff A1/A2, one result commit, standing-authorized prune, every exact-head gate, ready, FF-only integration and ordinary push; never cleanup.",
        "rationale": "Repository governance and product correctness remain separately evidenced."
      }
    ],
    "milestone_recovery": [
      {
        "id": "M1",
        "recovery": "Before registry activation, revert only uncommitted task-owned v6 work; discard only creator-owned test databases. Never edit migrations 0001-0005 or reinterpret history."
      },
      {
        "id": "M2",
        "recovery": "Keep port kit pure and remove an unverified Manual export; retain unknown journal evidence. Contract mismatch fails incompatible without fallback."
      },
      {
        "id": "M3",
        "recovery": "Reopen durable intent and journal, inspect before replay, and follow the recovery matrix; preserve ambiguity and verified-not-finalized evidence."
      },
      {
        "id": "M4",
        "recovery": "Stop on fence/lease loss, preserve thread identity, and enter exact waiting/interruption only after current observation; never substitute revision/thread/key."
      },
      {
        "id": "M5",
        "recovery": "Leave Task running and dependencies locked when any grant, confirmation, receipt, execution, fence, Project or Task fact is uncertain; preserve verified turn fact for authorized retry."
      },
      {
        "id": "M6",
        "recovery": "Do not complete/integrate on failed gates, unresolved review, scope drift, stale evidence or artifact survivor; preserve task/coordinator truth and use documented recovery only."
      }
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
      {"id": "V13", "state_binding": "material"}
    ],
    "risk_controls": [
      {
        "id": "R1",
        "mitigation": "Use exact port/journal interfaces, dependency tests, distinct core/adapter records, injected backends and application-only Domain/authorization/finalization ownership.",
        "recovery": "Fail incompatible/integrity, remove unsupported export before A1 and preserve both record sets for reconciliation."
      },
      {
        "id": "R2",
        "mitigation": "Commit intent/executing before act, enforce tuple idempotency in core and journal, independently inspect, persist immutable evidence and test every crash/restart.",
        "recovery": "Inspect before retry, return exact persisted finalization, and route unknown state to waiting ambiguity without replay/deletion."
      },
      {
        "id": "R3",
        "mitigation": "Use one-step vocabulary lineage, exact closed arrays/digests, bidirectional migration assertions, zero-authority migration and full adoption/upgrade/renew/restart matrices.",
        "recovery": "Rollback the migration transaction and reject corrupt/incompatible state if any row/digest cannot be preserved."
      },
      {
        "id": "R4",
        "mitigation": "End effect-free takeover, reconcile intents/journal first, allocate greater attempt/fence only after proof, and exact-CAS every write.",
        "recovery": "Stop stale worker, retain old attempt/evidence and enter waiting when takeover is not proven safe."
      },
      {
        "id": "R5",
        "mitigation": "Represent turn success, cancel request, interruption verification, completion decision and Domain terminal transition as distinct records/actions.",
        "recovery": "Leave Task running/dependencies locked; re-observe or obtain fresh confirmed completion instead of inferring terminal state."
      },
      {
        "id": "R6",
        "mitigation": "Use closed schemas, stable codes, bounded references, complete waiting validation and sentinel redaction tests.",
        "recovery": "Drop unclassifiable content, retain minimal safe refusal/waiting code and never expose raw adapter/caller material."
      },
      {
        "id": "R7",
        "mitigation": "Carry lifecycle digest versions 1/2/3 through all readers/writers/verifiers/restore paths and test real prior-schema backup/restore/recovery.",
        "recovery": "Refuse write/restore as typed corruption without publication and preserve original database/backup bytes."
      },
      {
        "id": "R8",
        "mitigation": "Trace scope/state, bind evidence, reserve only final review, preserve attempts, prune only coordinator, and bind gates exact head.",
        "recovery": "Stop on base/scope/review drift, revise approval only with fresh A0, and retain task editable until evidence passes."
      }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "d8afb79090906c263c7b91eca5234e613e066d04",
      "current_material_base": "d8afb79090906c263c7b91eca5234e613e066d04",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-08-31 02:24:00+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-08-31 02:24:00+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-08-31 02:24:00+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-08-31 02:24:00+08:00"},
      {"id": "M5", "status": "complete", "updated_at": "2026-08-31 02:24:00+08:00"},
      {"id": "M6", "status": "complete", "updated_at": "2026-08-31 02:24:00+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Schema-v3 trace, terminal-resolve, chain-check, coordinator evidence and fresh independent A0",
        "evidence": "Unique pushed EP-02A predecessor, exact d8afb79090906c263c7b91eca5234e613e066d04 base, current approval digest, task ownership and activation lineage were reproduced with no base, scope, overlap or pre-existing-dirty error.",
        "state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Migration registry, fresh/prefix upgrade, historical decode, doctor and backup/restore/recovery tests",
        "evidence": "Canonical migration 0006, zero-authority migration, exact schema-v6 23+6 grant partition, all released-prefix upgrades, lifecycle digest history, typed corruption refusal, restart, authorized backup, restore and recovery pass; migration SHA-256 is 3D27258B3C9FB4B11B56B989CA2F341CB4DC68C96168D864D3763D93A4799153.",
        "state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "ato.execution/v1 contract vectors and Manual/Fake shared exchange suite",
        "evidence": "Corrected-before-first-implementation actions, closed fields, workspace_mode=none, identities, lifecycles, receipt and error taxonomy accept canonical vectors and reject missing, extra, cross-class, version, action, accessor and proxy drift before backend invocation.",
        "state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Manual backend/control contract, competing-writer, restart, terminal immutability and packed-export tests",
        "evidence": "Production Manual journal operations and the sole confirmed outcome writer are tuple-idempotent, restart durable, independently inspectable and exact-CAS; response loss, drift, terminal rewrite and competing writers fail safely; Fake remains test-only and absent from 105 packed files.",
        "state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Vocabulary-4-to-5-to-6 authorization, confirmation, failpoint, corruption and atomic readback tests",
        "evidence": "Migration/bootstrap/renewal and vocabulary 5 expose no Manual authority; separately confirmed 5-to-6 creates exactly 29 origin grants in a decoder-enforced 23-linked-legacy plus 6-v6 partition; denials and every failpoint leave no unauthorized effect or partial authority.",
        "state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Durable checkpoint, response-loss, replay, restart and verified-not-finalized recovery matrix",
        "evidence": "Start, resume, retry, cancel and Manual report reopen from every protocol checkpoint; exact retries retain one semantic key/effect/finalization, executing state inspects first, and ambiguous state never blindly replays or succeeds.",
        "state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Execution-loop lifecycle, continuation, cancellation and interruption tests",
        "evidence": "Verified start/inspect/resume/retry paths preserve exact identities and observations; cancellation request does not terminate Task, and only authoritative independently verified interruption closes cancelled state, including waiting cancellation through explicit stopped disposition.",
        "state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Expired pending/executing reconciliation, takeover, stale-owner and stale-fence regressions",
        "evidence": "Expired or foreign-owner intents never invoke old-fence effects; reconciliation finalizes proven absence or preserves ambiguity before a strictly greater successor attempt/fence, and stale writes leave no partial state.",
        "state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Manual turn-success and separate completion-decision end-to-end tests",
        "evidence": "turn_succeeded and verified report finalization leave Task running and dependencies locked; only a distinct current execution.completion.accept grant and fresh completion confirmation atomically record completion decision, Domain completion, terminal execution, audit and exact replay.",
        "state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "Manual architecture/contracts/package/public-version review plus docs and package smoke",
        "evidence": "Ownership and dependency direction remain singular; persistence does not authorize or select Domain work; Fake is test-only; ato.api/v1 is unchanged; docs and package claim only the library Manual loop and retain all dispatcher/scheduler/MCP/Codex/workspace/Git/gate non-goals.",
        "state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "Security, malformed-input, trusted-identity, authorization freshness, forgery and redaction tests",
        "evidence": "Malformed/overlong/accessor/proxy/injection inputs stop before ingress/effect; principal/root and Prepare/Act/Finalize authorization remain current; forged receipts and content-derived authority fail; durable/public records exclude sentinel path, prompt, environment, credential, raw error, SQL and stack material.",
        "state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07"
      },
      {
        "id": "V12",
        "status": "passed",
        "method": "Repeated frozen verify:offline, focused 24/24 and 115/115 routes, diff-check and task inventory",
        "evidence": "Exact final material state passed lint 168/25, strict typecheck/build, 384/384 tests with no failure/skip/todo and artifact hygiene 14-to-14, docs 77/248/21/0, zero-production-dependency shape, 105-file packed install, Windows SQLite with zero survivor and blocked Codex boundary; git diff --check passed and every changed path is task-owned with an empty index.",
        "state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07"
      },
      {
        "id": "V13",
        "status": "passed",
        "method": "Fresh independent non-fail-fast A1 and three fresh A2 attempts with schema-v3 finding routing",
        "evidence": "A1's nine findings and A2 attempts 1-2 residuals are preserved; fresh independent A2 attempt 3 binds the exact final material state, closes all required A1 findings and prior A2-001..004, reports no new finding and is closure-safe. No EP-02C file exists in the task diff.",
        "state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/ep02a_a0",
        "independence": "Fifth fresh independent read-only A0. The reviewer rebuilt evidence from the current plan, guidance, contracts, Git state and harness sources without relying on an earlier conclusion, and made no file, Git, coordinator, permission, network or external-state mutation.",
        "scope": "Schema-v3 A0 of the current active EP-02B plan, including F-EP02B-A0-004 closure, approval-only scope revision, complete dirty-versus-scope inventory, predecessor/base and lifecycle history, goal/non-goals, authorization, schema-v6 Tier-2 persistence, ato.execution/v1, Manual journal/control ownership, reliability and recovery, public-interface exclusions, binary validations, risks and execution_contract.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-31 00:02:20+08:00",
        "approval_sha256": "0DDE3D4D2C6E7F006D3DDF0D0E2B239DF4D91F9F5E63E6EEEA2AF63EE076BFA8",
        "reviewed_material_base": "d8afb79090906c263c7b91eca5234e613e066d04",
        "evidence": "Complete reread covered the active plan, repository guidance, schema/A0/persistence-audit rules and every directly relevant authorization, Domain, adapter, persistence, reliability, completion/workspace, versioning, ownership, validation, toolchain, CLI, Git-flow, privacy and threat contract. Independent compact sorted-key UTF-8 canonicalization produced exactly 28,194 bytes and SHA-256 0DDE3D4D2C6E7F006D3DDF0D0E2B239DF4D91F9F5E63E6EEEA2AF63EE076BFA8. Removing exactly the two new test ownership entries reconstructed the previous 28,060-byte contract and digest EE416953040AD2C7E60FD53F55492B58D0F004C357DB321DCD9AA3A9F0FED95E. Fresh inventory found 40 tracked dirty plus 13 untracked paths, all 53 covered by 62 scope entries with outside_scope empty and index unstaged. Both added tests are validation-only and directly required by unchanged V5/V12. Attempts 1-4 and all revisions remain truthful. Trace reproduced exact base/digest with no warning and only the expected missing-current-A0 lifecycle gate; HEAD/master/origin/master and predecessor terminal all matched d8afb79090906c263c7b91eca5234e613e066d04. Full non-fail-fast review reconfirmed additive schema-v6 lineage, explicit no-auto-grant vocabulary upgrade, corrected-before-first-implementation ato.execution/v1, the sole confirmed Manual outcome writer, intent/effect/observation/receipt/finalization recovery, distinct completion ownership, closed non-goals and binary validations. No current finding remained.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/ep02a_a1",
        "independence": "Fresh independent non-fail-fast read-only A1 by a reviewer that did not implement or repair EP-02B. The reviewer received no parent candidate disclosure before review and made no file, Git, ExecPlan, coordinator, permission, network, test-artifact, or external-state mutation.",
        "scope": "Exact stable pre-repair EP-02B state git-sha1:652319afa456ffbeec6c7175728485849ccec0c7 at result head e2db1b3e94fd314a777f03b347dd79dc6b8c9cc2 and base d8afb79090906c263c7b91eca5234e613e066d04; complete 54-path committed diff, schema-v6 persistence, historical vocabulary/schema readability, authorization and trusted identity, semantic CAS/idempotency, intent/effect/receipt/finalization, Manual cancellation/completion, crash/reconcile/fence behavior, retry/waiting propagation, port/package/CLI compatibility, redaction, ownership, dependency direction and non-goals.",
        "reviewed_at": "2026-08-31 00:26:50+08:00",
        "evidence": "Independent trace at the reviewed state reported exact head/base, approval digest 0DDE3D4D2C6E7F006D3DDF0D0E2B239DF4D91F9F5E63E6EEEA2AF63EE076BFA8, clean worktree/index, outside_scope=[], errors=[] and warnings=[]. The reviewer read the complete plan, audit methods, authoritative contracts, changed implementation and relevant tests, and confirmed five HIGH, three MEDIUM and one LOW finding. The parent independently reproduced and accepted every finding as in-scope and task-diff-changing; all require fresh independent A2 after repair.",
        "reviewed_state_id": "git-sha1:652319afa456ffbeec6c7175728485849ccec0c7",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-EP02B-A1-001",
            "severity": "HIGH",
            "summary": "Effect invocation and finalization reused a stale prepare-time authorization decision.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Add an immutable prepare/act/finalize authorization-binding chain with intent CAS revision; revalidate trusted identity, policy and current grant immediately before every effect and inside every finalization transaction, recording the consumed decision on Manual operations and finalizations.",
            "closure_evidence": "Schema-v6 bindings and decision references, loop/journal enforcement, authoritative contracts, and four revoke-after-prepared/executing/observed/verified regressions are present at git-sha1:6554f84fb5d8966e6080ccd60710f0ae889f76c9; the 96-test focused suite and typecheck pass.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02B-A1-002",
            "severity": "HIGH",
            "summary": "Reliable execution did not bind the asserted principal or runtime root to persisted local identity.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Reuse one authoritative actor/principal/platform/runtime-root validator at operation entry, every authorization refresh and finalization.",
            "closure_evidence": "The exported shared validator is used by the reliable loop and mismatched-principal plus substituted-root no-effect/no-write regressions pass at git-sha1:6554f84fb5d8966e6080ccd60710f0ae889f76c9.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02B-A1-003",
            "severity": "HIGH",
            "summary": "A well-shaped forged inspect receipt could falsely cancel a Task.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Match every Manual inspect receipt against the authoritative durable turn tuple, lifecycle, revision, code/evidence and operation lineage; require exact request-cancel plus confirm-cancelled lineage before cancellation verification.",
            "closure_evidence": "The authoritative matcher rejects a recomputed-hash forged cancelled receipt, records ambiguity only, leaves the journal nonterminal and creates no execution terminal row in the passing malicious-adapter regression at git-sha1:6554f84fb5d8966e6080ccd60710f0ae889f76c9.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02B-A1-004",
            "severity": "HIGH",
            "summary": "Verified cancellation from an accepted waiting state was unfinalizable.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Finalize a waiting Task through Domain cancel with an explicit stopped execution disposition bound to the verified receipt, while retaining interruption_verified for running Tasks.",
            "closure_evidence": "The full start-to-wait-to-request-cancel-to-confirm-cancelled regression reaches a durable interrupted finalization and cancelled Task/terminal execution at git-sha1:6554f84fb5d8966e6080ccd60710f0ae889f76c9.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02B-A1-005",
            "severity": "HIGH",
            "summary": "Expired reconciliation could initiate a new start with the expired attempt and old fence.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Never invoke a mutation under an expired or foreign-owner fence; reconcile pending/executing intents by authoritative inspection or durable no-effect finalization, then require a strictly higher successor attempt/fence.",
            "closure_evidence": "Restart regressions at both prepared and executing crash points prove zero old-fence adapter calls, finalized no-effect evidence, and successful attempt-2/fence-2 takeover at git-sha1:6554f84fb5d8966e6080ccd60710f0ae889f76c9.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02B-A1-006",
            "severity": "MEDIUM",
            "summary": "Adapter failure taxonomy was lost and retry_wait did not durably wait.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Persist the closed category/code/retryable/ambiguous/retryAfter/retry-count projection, keep retry_wait durable before its due time, and reauthorize the same semantic operation/key only when due.",
            "closure_evidence": "Schema, repository, waiting projection and due-gated process logic retain exact rate_limited evidence; the regression proves one pre-due call, same operation/intent/key on due retry, and successful finalization at git-sha1:6554f84fb5d8966e6080ccd60710f0ae889f76c9.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02B-A1-007",
            "severity": "MEDIUM",
            "summary": "The SQL Manual-turn guard allowed same-lifecycle terminal rewrites.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Reject every UPDATE whose old Manual lifecycle is terminal, independent of the proposed lifecycle or other CAS fields.",
            "closure_evidence": "The migration trigger now rejects all terminal updates and a raw-SQL same-lifecycle code/revision rewrite leaves the authoritative turn unchanged in the passing regression at git-sha1:6554f84fb5d8966e6080ccd60710f0ae889f76c9.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02B-A1-008",
            "severity": "MEDIUM",
            "summary": "Historical execution decisions were compared with the current Project config revision.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Persist decision-time Project config revision and validate a Project-scoped grant against that historical decision revision while requiring only that historical revisions do not exceed current Project state.",
            "closure_evidence": "Decision schema/decoder now preserve decision-era config; execution followed by Project config revisions 2 and 3 survives restart, authorized backup, restore and reopened combined-state validation at git-sha1:6554f84fb5d8966e6080ccd60710f0ae889f76c9.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02B-A1-009",
            "severity": "LOW",
            "summary": "ato.execution/v1 rejected canonical retryAfter values outside rate_limited.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Accept nullable canonical retryAfter for every closed adapter error category exactly as the authoritative v1 contract specifies.",
            "closure_evidence": "The undocumented category restriction is removed and a permanent_external non-null retryAfter contract vector passes at git-sha1:6554f84fb5d8966e6080ccd60710f0ae889f76c9.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "/root/ep02a_a2",
        "independence": "Fresh independent read-only A2 attempt 3. The reviewer did not implement the repairs or rely on the parent agent's conclusions, made no file, Git, ExecPlan, coordinator, permission, network, test-artifact or external-state mutation, and ran no artifact-producing tests.",
        "scope": "Exact EP-02B material state git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07 over base d8afb79090906c263c7b91eca5234e613e066d04 and result HEAD e2db1b3e94fd314a777f03b347dd79dc6b8c9cc2. Complete task diff, active schema-v3 ExecPlan, validation history, authoritative authorization/persistence/reliability/adapter/CLI/security contracts, migration 0006, application and persistence owners, execution loop, Manual backend, package smoke and directly relevant tests; all nine A1 findings, prior A2-001..003 and the complete A2-004 repair were rechecked under the Tier-2 persistence lens.",
        "reviewed_at": "2026-08-31 02:23:23+08:00",
        "evidence": "Independent trace reproduced exact final material state, base, result HEAD and approval digest with outside_scope=[], overlap=[], pre_existing_dirty=[] and warnings=[]; git diff --check passed. F-EP02B-A2-004 is closed: authorization_grants_v6 admits only six Manual actions; symmetric insert guards plus immutable IDs prevent cross-table reuse or update bypass; the decoder retains physical owner/action, rejects global grant and relation collisions, validates relation identity and exact per-epoch inventories, and enforces vocabulary-6 23 linked legacy plus 6 v6. Three corruption tests invoke the combined decoder after real wrong-relation, missing-action and duplicate-ID mutations and require CORRUPT_ROW. Normal upgrade/renew/revoke, legacy application/lifecycle foreign keys, restart, historical decisions, backup/restore and packed verification remain consistent. A1-001..009 and prior A2-001..003 remain closed. The repeated 384/384 full route and 115/115 focused route corroborate but do not replace the review. No adjacent regression or new finding exists; the report is closure-safe.",
        "reviewed_state_id": "git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07",
        "parent_disposition": "complete",
        "closes": [
          "F-EP02B-A1-001",
          "F-EP02B-A1-002",
          "F-EP02B-A1-003",
          "F-EP02B-A1-004",
          "F-EP02B-A1-005",
          "F-EP02B-A1-006",
          "F-EP02B-A1-007",
          "F-EP02B-A1-008",
          "F-EP02B-A1-009"
        ],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-EP02B-A0-001", "F-EP02B-A0-002", "F-EP02B-A0-003"],
        "disposition": "superseded",
        "reason": "Fresh independent A0 required the approval contract to freeze an authorized pre-first-implementation ato.execution/v1 correction, close the sole authorization-bound Manual outcome writer/readback path, and bind lifecycle-aware base/readiness evidence to material state."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "superseded",
        "reason": "The clean activation A0 was archived after active-plan preflight exposed only the harness-normalized singular proposal lifecycle path as missing from task ownership; the ownership-only approval revision changes no product behavior, permission or deliverable."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "superseded",
        "reason": "The clean resumed-implementation A0 was archived after the first full-suite run proved that test/configuration.test.mjs owns the canonical migration EOL inventory assertion and must be updated for additive migration 0006. Adding that one test file to task ownership changes no product behavior, authority, compatibility rule or deliverable; implementation remains paused until fresh independent A0."
      },
      {
        "audit": "A0",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": ["F-EP02B-A0-004"],
        "disposition": "superseded",
        "reason": "Accepted F-EP02B-A0-004: the independent dirty-versus-scope inventory proved that the already-goal-bound claim-foundation and execution-loop authorization tests were missing from task ownership. The minimal ownership-only revision adds exactly those two files and changes no product behavior, authority, compatibility rule or deliverable."
      },
      {
        "audit": "A2",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-EP02B-A2-001", "F-EP02B-A2-002", "F-EP02B-A2-003"],
        "disposition": "reopened",
        "reason": "Fresh independent A2 at git-sha1:5e2f67f538835f39f265aad5e1e1839a81a2b40b closed A1 findings 003-009 but found three authorization-family residuals: finalized replay returned before principal/runtime-root validation; inspection reused a historical allow or denial when no observation advanced its ordinal; and denied Act/Finalize rows reused the unchanged successful-binding revision identities and blocked later authorized recovery. All three are in-scope task-diff changes and require local repair plus a fresh independent A2."
      },
      {
        "audit": "A2",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-EP02B-A2-004"],
        "disposition": "reopened",
        "reason": "Fresh independent A2 at git-sha1:3f96209270651943ae6383339321ab1f110263bb closed all nine A1 findings and all three prior A2 residuals, but found one in-scope MEDIUM persistence residual: vocabulary-6 split grant decoding did not preserve or enforce the exact physical 23+6 partition or global cross-table grant identity. The parent accepted and repaired it; fresh independent A2 attempt 3 at git-sha1:a27d0dd5d592bbd4e48e6422a45f30b71b94ad07 independently closed it with no new finding."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V12",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-31 00:18:00+08:00",
        "evidence": "The pre-A2 candidate at git-sha1:5e2f67f538835f39f265aad5e1e1839a81a2b40b passed the complete offline route with 379/379 tests, package smoke, docs, dependency shape, SQLite and the blocked Codex boundary, but fresh independent A2 subsequently found three authorization-family residuals. That successful route is preserved but superseded and cannot support current closure.",
        "state_id": "git-sha1:5e2f67f538835f39f265aad5e1e1839a81a2b40b"
      },
      {
        "validation_id": "V12",
        "attempt": 2,
        "classification": "deterministic_failure",
        "at": "2026-08-31 01:20:00+08:00",
        "evidence": "After repairing the three A2 residuals, the full test phase passed 381/381 but verify:offline exited nonzero at package smoke with bounded PERSISTENCE_FAILURE. Repetition and stage instrumentation at pre-link state git-sha1:85158d596682cb1d1565efd04f1cec7a7403151b proved that a vocabulary-6 origin grant for an already-representable action could be selected by UUID order from authorization_grants_v6 and then be rejected by the unchanged authorization_decisions foreign key to authorization_grants. This was an implementation defect, not a passing or environment result; the diagnostic instrumentation was removed after the additive epoch-link repair.",
        "state_id": "git-sha1:85158d596682cb1d1565efd04f1cec7a7403151b"
      },
      {
        "validation_id": "V12",
        "attempt": 3,
        "classification": "environment_failure",
        "at": "2026-08-31 02:12:00+08:00",
        "evidence": "All 115 selected recovery, security, port, Manual backend, migration and backup tests passed, but a previously launched overlapping test runner changed the shared .task-artifacts inventory during this runner's observation window, so artifact hygiene correctly made the command exit nonzero and preserved diagnostics. After the overlapping runner ended, the unchanged test selection passed 115/115 with artifact hygiene preserving the stable baseline exactly from 14 entries to 14. The failed attempt is retained as environment concurrency evidence and is not a passing gate.",
        "state_id": "git-sha1:a404b72cc7fc8c02e6b59f0d9df34dc6e51e8384"
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-08-30 21:22:42+08:00",
        "summary": "Closed F-EP02B-A0-001 through F-EP02B-A0-003 by explicitly correcting the still-unimplemented ato.execution/v1 before first release, defining the sole trusted authorization/confirmation-bound Manual outcome ingress with full CAS/readback/restart closure, and making V1 material- and lifecycle-aware.",
        "previous_approval_sha256": "19DDA859EEA31C1CECADAB63A7D15341651AF3825E492397365202A83E5ADCF0"
      },
      {
        "at": "2026-08-30 21:31:27+08:00",
        "summary": "Added the harness-normalized singular proposal lifecycle path to task ownership while retaining the repository's actual plural proposal path; no product file, authority, compatibility rule or deliverable changed.",
        "previous_approval_sha256": "26E3DC6E3921F1289311E5F1F7FD563532BC1805BCBF62B2200709B02C7B47F3"
      },
      {
        "at": "2026-08-30 23:48:00+08:00",
        "summary": "Added test/configuration.test.mjs to task ownership after the full suite identified its canonical migration-EOL inventory assertion as a required EP-02B update; no product file, authority, compatibility rule or deliverable changed.",
        "previous_approval_sha256": "826E2A25C1AD085D1AFB94D24CAE5B8C4413621E56FA95EC84E0F669FF72BD0C"
      },
      {
        "at": "2026-08-30 23:55:50+08:00",
        "summary": "Closed F-EP02B-A0-004 by adding the already-goal-bound claim-foundation and execution-loop authorization test files to task ownership; no product file, authority, compatibility rule or deliverable changed.",
        "previous_approval_sha256": "EE416953040AD2C7E60FD53F55492B58D0F004C357DB321DCD9AA3A9F0FED95E"
      }
    ],
    "final_summary": "EP-02B closes a library-only reliable local Manual execution loop on additive schema v6: explicit vocabulary-6 upgrade, ato.execution/v1 contract kit, durable Manual journal and outcome control, ordered authorization-bound intent/observe/verify/finalize recovery, fenced reconciliation, and separately confirmed Manual completion. Exact final material state a27d0dd5d592bbd4e48e6422a45f30b71b94ad07 passed the repeated complete offline route and fresh independent closure-safe A2 with no current finding; dispatcher, scheduler, public Phase-2 CLI and every later-phase integration remain absent."
  }
}
~~~

## Context

Start-time terminal evidence is the coordinator-verified EP-02A push receipt at d8afb79090906c263c7b91eca5234e613e066d04: master, origin/master and remote head matched; predecessor task was pushed; reservation/pending were null; integration and predecessor worktrees were clean; no cleanup was invoked. EP-02B start then froze that base, artifact manifest, task/ep-02b worktree and eighteen gates. No EP-02C/EP-02D file exists in this task.
