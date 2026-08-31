# ExecPlan：收口 Phase 2 本地 Manual 产品面

本计划完成 Phase 2 的最后一段：把已经验证并推送的 execution claim、可靠 Manual loop 和 reconcile-first Manual Dispatcher 通过一个严格版本化、脱敏且不复制业务判断的本地产品入口闭合起来。EP-02C 的终态是本计划唯一前置基线；本计划未追加新的持久化 schema，也未实现 Phase 3 的 scheduler、Codex、workspace 或 completion-gate 能力。

~~~execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-31 06:41:02+08:00",
    "updated_at": "2026-08-31 14:36:12+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user directive in thread 01a0521b-4236-7130-9116-bfd80373cf18",
        "at": "2026-08-31 06:41:02+08:00"
      },
      "persistence": {
        "authorized": false,
        "by": null,
        "at": null
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "At the verified EP-02C terminal lineage, close Phase 2 as a local Manual product by preserving ato.api/v1 exactly, adding an explicit ato.api/v2 product contract for capability upgrade, Manual dispatch/run recovery, execution inspect/resume/retry/cancel, trusted Manual outcome reporting and separately confirmed Manual completion acceptance, routing every operation through one typed product application facade over the existing authorization, dispatcher, reliable-loop, Domain and schema-v7 persistence owners, and proving source/build/packed-install/restart/migration/CLI parity, redaction, documentation and truthful capability status.",
    "non_goals": [
      "Do not add schema v8, edit migrations 0001 through 0007, reinterpret historical rows, add a second persistence owner, or change backup, restore, doctor, lifecycle-digest or migration semantics.",
      "Do not implement MCP, Codex, Git, workspace, SchedulerBackend, scheduled or automatic trigger delivery, daemon/service installation, ProjectPolicy, CompletionBackend, completion gates, multi-candidate policy sweep beyond the existing Manual Dispatcher, D:\\quant dogfood, release, deployment, telemetry, diagnostic bundles, general log files, retention jobs or cleanup.",
      "Do not change ato.execution/v1, Manual backend journal semantics, Task state semantics, dispatcher reconciliation/membership/summary semantics, or treat turn_succeeded as Task completion.",
      "Do not rewrite any historical completed plan or evidence and do not create a Phase 3 plan or implementation path.",
      "Do not claim a supported platform, external API, scheduler, remote service, release or deployment from local fixture, package or Windows feasibility evidence."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "EP-02C has one verified terminal result commit 0700d65e9c0db78626aa31baa56f15f009fef41e, pushed identically to local master and origin/master before this plan was created. The ordered chain is EP-01D -> EP-02A -> EP-02B -> EP-02C -> EP-02D -> Phase 3, and no successor may exist before this plan reaches its own verified pushed terminal.",
        "source": "current user directive; docs/plans/README.md; completed EP-02C plan; Git-flow and remote terminal evidence"
      },
      {
        "id": "C2",
        "statement": "The historical single EP-02 remains an umbrella. The current user refined it into EP-02A, EP-02B, EP-02C and EP-02D; EP-02A records that refinement, and this plan preserves the chain without editing historical bytes or treating umbrella prose as implementation evidence.",
        "source": "current user directive; docs/plans/completed/EP-02A-durable-execution-claim-foundation.md"
      },
      {
        "id": "C3",
        "statement": "The closed ato.api/v1 cannot compatibly acquire Phase 2 commands: command availability, authorization requirements, state effects, response shapes and errors would change. Preserve its default selection, complete grammar, validation, action vocabulary, response bytes/key order, redaction, errors and exit codes. Add explicit ato.api/v2 instead; version dispatch occurs before runtime selection, trusted ingress or Domain evaluation, and no request is guessed or coerced between majors.",
        "source": "docs/reference/versioning-compatibility-contract.md; docs/reference/cli-contract.md"
      },
      {
        "id": "C4",
        "statement": "Schema v7 already owns every execution, intent, observation, verified receipt, finalization, Manual journal/completion decision and dispatcher run/member/summary record needed by this product surface. EP-02D therefore adds no migration or durable record shape. Fresh schema and shipped-prefix upgrade tests still reach exact schema v7 through the frozen chain; migration creates no Phase 2 authority, and the new binary must reopen existing schema-v7 runtimes without rewriting evidence.",
        "source": "current user directive; docs/reference/persistence-contract.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C5",
        "statement": "ato.api/v2 includes the Phase 1 commands with unchanged application semantics plus authorization upgrade and the Phase 2 Manual commands. An unversioned invocation remains ato.api/v1. ato.api/v2 authorization issue/evaluate accepts only the complete current finite thirty-action vocabulary; ato.api/v1 continues to accept only its historical nineteen-action vocabulary. authorization upgrade performs exactly one existing contiguous 4-to-5, 5-to-6 or 6-to-7 transition per confirmed invocation, never skips a vocabulary, never dispatches work and never manufactures authority through migration or renewal.",
        "source": "docs/reference/authorization-contract.md; docs/reference/versioning-compatibility-contract.md; existing typed application service"
      },
      {
        "id": "C6",
        "statement": "The product actor, principal, runtime-root key, Manual dispatcher worker owner and execution lease owner come only from the current validated OS/runtime ingress. CLI text cannot assert or replace them. The execution lease owner remains the stable actor/root identity needed by separate Manual CLI invocations; every product process/service derives a fresh bounded dispatcher worker owner cryptographically bound to that identity. Dispatcher composition supplies that fresh owner for run ownership/takeover and the stable owner for atomically claimed executions. Existing dispatcher-application callers without the optional execution-owner seam and existing Manual-dispatcher callers without the optional worker-owner seam retain their historical single-owner behavior. authorization upgrade requires exact UPGRADE LOCAL CAPABILITIES confirmation; Manual outcome reporting requires exact RECORD MANUAL OUTCOME confirmation after a fresh current execution.inspect allow; Manual completion acceptance requires exact ACCEPT MANUAL COMPLETION confirmation and its independent execution.completion.accept allow. Confirmation values are consumed only by their named current request and never persisted or displayed.",
        "source": "current user directive; docs/reference/authorization-contract.md; docs/security/threat-model.md"
      },
      {
        "id": "C7",
        "statement": "Replace the library-only local_manual_operator name check with the existing invariant that the current actor/principal/runtime-root tuple equals the persisted local runtime identity. Historical actor IDs and evidence remain readable and immutable. A product command cannot report a Manual outcome for another actor, root, project, Task, execution, attempt or fence.",
        "source": "current user directive; docs/reference/authorization-contract.md; existing execution-loop runtimeActorFailure owner"
      },
      {
        "id": "C8",
        "statement": "A new typed product application facade, not CLI presentation code, reads current schema-v7 state, resolves the exact registered Project/Task/execution/turn/intent/receipt/finalization tuple, derives backend/thread/input/policy/deadline/observation/journal/lifecycle fields, calls the existing Manual Dispatcher or reliable execution service, and returns a closed product view. It fails on missing, duplicate, stale, ambiguous or incompatible durable lineage. CLI owns only closed parsing, bounded tokens/revisions/timestamps, trusted identity and named confirmation plumbing, presentation and public error mapping.",
        "source": "AGENTS.md; ARCHITECTURE.md; docs/reference/reliability-protocol.md; docs/reference/cli-contract.md"
      },
      {
        "id": "C9",
        "statement": "The ato.api/v2-only command grammar is exact: authorization upgrade --expires-at TIME --confirm \"UPGRADE LOCAL CAPABILITIES\"; dispatch run --idempotency-key ID --lease-duration-seconds N; dispatch resume --run-id ID; execution inspect COMMON; execution resume COMMON --continuation-reference ID --required-action-receipt-id ID; execution retry with the same two added fields; execution request-cancel COMMON --reason-code ID; manual outcome-report COMMON --report-id ID --outcome OP --code ID [--evidence-reference ID] --confirm \"RECORD MANUAL OUTCOME\"; and execution accept-manual-completion COMMON --confirm \"ACCEPT MANUAL COMPLETION\". COMMON is exactly --project-id ID --expected-project-resource-revision REV --expected-project-config-revision REV --task-id ID --expected-task-revision REV --execution-id ID --expected-execution-revision REV --expected-attempt-number REV --expected-fencing-token REV --idempotency-key ID. ID and reference values use the existing operational-ID ASCII grammar and 1..128-byte bound, while --reason-code and Manual outcome --code use that same grammar with the closed ato.execution/v1 1..64-byte bound; revisions are canonical positive safe integers; OP is exactly activate|wait|succeed|fail|confirm_cancelled; N is a canonical whole safe integer 30..3600; TIME is canonical UTC, strictly more than seven and no more than thirty-one days after trusted current time. No aliases, alternate ordering rules, implicit fields or extension map exist.",
        "source": "current user directive; docs/reference/adapter-contracts.md; docs/reference/reliability-protocol.md"
      },
      {
        "id": "C10",
        "statement": "Execution inspect is an authorization-bound durable observation operation, not a raw database query. Resume, retry, cancellation, Manual reporting and completion derive their non-public semantic tuple from authoritative state but CAS the complete caller-supplied public revisions/attempt/fence. Reusing one idempotency key with an unequal tuple is a stable conflict. For dispatch trigger replay, the stable identity is the idempotency key plus trusted actor and requested lease tuple, not the replaceable process worker: an exact same-actor tuple may read the canonical persisted run across worker instances, while an unequal actor or lease conflicts. Exact response-loss replay returns durable state and performs no duplicate run, Manual journal mutation, adapter call, Task transition or completion decision; an active expired run must still be taken over through owner/run CAS before continuation.",
        "source": "docs/reference/reliability-protocol.md; docs/reference/adapter-contracts.md"
      },
      {
        "id": "C11",
        "statement": "dispatch run invokes only the existing reconcile-first Manual Dispatcher and may return the canonical durable replay view or a complete, partial, failed or interrupted run view after that owner has produced its existing summary. dispatch resume reopens one durable run. A same-process current worker may heartbeat; an exact cross-process trigger replay may read the canonical run without changing its owner; and only after lease expiry may the distinct restarted product worker use the existing takeover/CAS path before reconciliation, sealing, resolution or finalization. Claimed execution attempts retain the stable execution lease owner rather than the run worker owner. Old-worker writes then fail the existing owner revision/CAS. CLI neither enumerates candidates nor computes outcomes or completeness.",
        "source": "current user directive; docs/reference/scheduler-contract.md; docs/reference/reliability-protocol.md"
      },
      {
        "id": "C12",
        "statement": "Manual outcome-report is the necessary trusted local control ingress for the real Manual backend. Its succeed result remains only turn_succeeded with Task running. execution accept-manual-completion is a separate current high-risk decision that derives and verifies the exact successful receipt/finalization lineage and alone may atomically move running to completed. No report, adapter return, CLI text or dispatcher summary substitutes for that decision.",
        "source": "current user directive; docs/reference/authorization-contract.md; docs/reference/adapter-contracts.md; docs/reference/reliability-protocol.md"
      },
      {
        "id": "C13",
        "statement": "ato.api/v2 reuses every ato.api/v1 success object with identical field order and meaning while changing only the envelope apiVersion to ato.api/v2. authorization.upgrade is exactly mode, expiresAt, capabilityCount, epochRevision. dispatch.run and dispatch.resume are exactly runId, status, ownerRevision, runRevision, heartbeatAt, leaseExpiresAt, membershipRevision, expectedMemberCount, pendingMemberCount, terminalMemberCount, terminalStatus, replayed. Every execution.inspect/resume/retry/request-cancel, manual.outcome-report and execution.accept-manual-completion result is exactly executionId, taskId, taskState, taskRevision, executionRevision, attemptNumber, fencingToken, lifecycle, observationNumber, waiting, replayed. waiting is null or exactly reason, phase, requiredAction, lastErrorCode, lastErrorSummary, retryable, retryCount, retryAfter, executionId, workspaceRevision, waitingTaskRevision in that order. Actor/principal/owner, Project/runtime paths, input/policy/backend/thread/intent/receipt/finalization IDs, Task body, confirmation, idempotency text, prompt/source/environment/credential values, raw adapter payload/error, SQL, stack and arbitrary text are omitted. JSON and human serializers preserve the documented envelope/result order and one-line/no-stderr rules.",
        "source": "docs/security/privacy-and-logging.md; docs/reference/observability-contract.md; docs/reference/cli-contract.md"
      },
      {
        "id": "C14",
        "statement": "The product surface observes outcomes only through existing durable records, current bounded audit rows and closed redacted CLI summaries. It adds no general logger, event sink, diagnostic command/bundle, telemetry endpoint, retention policy/job or automatic cleanup.",
        "source": "current user directive; docs/reference/observability-contract.md; docs/security/privacy-and-logging.md"
      },
      {
        "id": "C15",
        "statement": "Source TypeScript, built dist and packed-installed ato must have exact v1 compatibility and exact v2 behavior for success, denial, malformed input, restart, response loss and public exit codes. Package smoke uses the real local Manual backend and temporary trusted runtime, proves sequential capability upgrades through vocabulary 7, dispatch plus execution recovery plus separately confirmed completion after restart, and leaves no package/runtime secret or task artifact in the committed inventory.",
        "source": "current user directive; docs/reference/toolchain-contract.md; docs/reference/validation-policy.md"
      },
      {
        "id": "C16",
        "statement": "Capability status after completion truthfully reports a local Phase 2 Manual product runtime and execution runtime with only manual-local, schema v7, explicit Manual dispatch and ato.api/v2. docs/adr/README.md changes only its stale current-runtime sentence to that qualified truth. Both continue to report no supported release or platform, SchedulerBackend, automatic cadence, MCP, Codex/Git/workspace, ProjectPolicy, CompletionBackend/gates, release or deployment.",
        "source": "current user directive; AGENTS.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C17",
        "statement": "Fresh independent A0 precedes activation; fresh independent non-fail-fast A1 follows the stable complete material diff; every confirmed in-scope HIGH/MEDIUM or non-mechanical repair receives fresh independent A2. Parent disposition remains separate, and failed or superseded evidence is preserved without rewriting history.",
        "source": "current user directive; harness-exec-plan schema v3"
      },
      {
        "id": "C18",
        "statement": "Use only task/ep-02d and its coordinator-created linked worktree, declared task paths, one terminal result commit, standing-authorized pathless artifact prune, exact-head receipts, ready, FF-only local integration and ordinary non-force origin/master push. Cleanup, reset, rebase, stash, force, PR, release and deployment are prohibited.",
        "source": "current user directive; AGENTS.md; docs/reference/local-agent-git-flow.md"
      },
      {
        "id": "C19",
        "statement": "The ato.api/v2 public error table is exhaustive: it inherits every ato.api/v1 code, fixed message and exit unchanged, then adds exit 5 EXECUTION_NOT_FOUND/The execution was not found. and DISPATCH_RUN_NOT_FOUND/The dispatcher run was not found.; exit 6 STALE_FENCE/The execution or dispatcher ownership fence is stale., LEASE_EXPIRED/The execution or dispatcher lease has expired., and RECONCILIATION_REQUIRED/Durable reconciliation is required before the operation can continue.; exit 7 ADAPTER_FAILURE/The Manual execution adapter failed.; and exit 8 AMBIGUOUS_EXTERNAL_STATE/The external execution state is ambiguous. Application and persistence failures retain the exhaustive v1 mapping, including capability-upgrade ineligibility to AUTHORIZATION_DENIED. Reliable-loop INVALID_INPUT maps to CLI_INVALID_INPUT; AUTHORIZATION_DENIED, CONFIRMATION_REQUIRED, PROJECT_NOT_FOUND, TASK_NOT_FOUND and STALE_REVISION map to their same-named public codes; PROJECT_DISABLED, TASK_NOT_ELIGIBLE and EXECUTION_TERMINAL map to DOMAIN_REJECTED; EXECUTION_NOT_FOUND, STALE_FENCE, LEASE_EXPIRED, RECONCILIATION_REQUIRED, ADAPTER_FAILURE and AMBIGUOUS_EXTERNAL_STATE map to their same-named v2 additions; IDEMPOTENCY_CONFLICT maps to OPERATION_CONFLICT; PROJECT_IDENTITY_CHANGED maps to PROJECT_REGISTRY_REJECTED; PERSISTENCE_FAILURE maps to PERSISTENCE_UNAVAILABLE. Dispatcher INVALID_INPUT maps to CLI_INVALID_INPUT; AUTHORIZATION_DENIED and STALE_REVISION map to their same-named public codes; RUN_NOT_FOUND maps to DISPATCH_RUN_NOT_FOUND; IDEMPOTENCY_CONFLICT and LEASE_NOT_EXPIRED map to OPERATION_CONFLICT; STALE_OWNER maps to STALE_FENCE; LEASE_EXPIRED maps identically; RUN_NOT_RECONCILED, RUN_NOT_SEALED, MEMBER_NOT_FOUND, MEMBER_NOT_PENDING and RECONCILIATION_INCOMPLETE map to RECONCILIATION_REQUIRED; PROJECT_IDENTITY_CHANGED maps to PROJECT_REGISTRY_REJECTED; INTEGRITY_FAILURE maps to STATE_CORRUPT; PERSISTENCE_FAILURE maps to PERSISTENCE_UNAVAILABLE. Any impossible/unclassified value maps to INTERNAL_ERROR, and no internal message is reflected.",
        "source": "docs/reference/cli-contract.md; docs/reference/versioning-compatibility-contract.md; current application, dispatcher and reliable-loop error taxonomies"
      }
    ],
    "authorization": {
      "allowed": [
        "Read and modify only declared repository task paths inside the coordinator-created EP-02D worktree.",
        "Add ato.api/v2, one typed local Phase 2 product application facade, trusted local execution/dispatcher ingress composition, public CLI routing/presentation, tests, package smoke and truthful documentation while preserving v1 and schema v7.",
        "Make the narrow Manual-report actor correction from a magic actor name to the already-persisted trusted local actor/principal/runtime-root identity without rewriting historical evidence.",
        "Run frozen local targeted, source/build, migration/restart, CLI/security, package and complete offline validation using only task-owned disposable artifacts.",
        "Use fresh independent A0, A1 and required A2 reviewers and record their reports without delegating implementation authorization or parent disposition.",
        "Create one task-owned result commit after completion-ready and terminal staged-inventory proof.",
        "After that commit, invoke only the standing-authorized pathless artifact prune and, after exact-head gates, ready and FF-only integration, the standing-authorized ordinary non-force origin/master push."
      ],
      "requires_reapproval": [
        "Any schema v8 or durable record change, edit to migrations 0001-0007, historical API/authorization/evidence reinterpretation, backup/restore/doctor behavior change, or ato.api/v1 wire/state-effect change.",
        "Any new authorization action, implicit authority expansion, skipped capability vocabulary, weaker trusted identity/confirmation, changed Task/dispatcher/reliability semantics, or changed ato.execution/v1 contract.",
        "Any public command or data field outside the approved v2 Manual product surface, general logging/diagnostic/telemetry/retention feature, SchedulerBackend, scheduled trigger, MCP, Codex, Git, workspace, ProjectPolicy, CompletionBackend/gates, other repository, D:\\quant, release or deployment behavior.",
        "Any secret/network/external-service access, destructive cleanup, successor-plan creation before verified terminal push, or external write beyond the standing ordinary push."
      ],
      "prohibited": [
        "Reset, rebase, stash, force push, force cleanup, coordinator cleanup, historical plan/evidence rewrite, another-repository mutation, PR, release or deployment.",
        "Let CLI or persistence select Domain, authorization, dispatcher, reliability, retry, reconciliation, completion or candidate-membership decisions.",
        "Trust caller actor/owner identity, Task text, confirmation text alone, adapter output, timeout, process death, migration, old grant, old receipt or dispatcher summary as reusable authority or Task completion.",
        "Expose raw Task/source/prompt/path/actor/owner/backend/thread/intent/receipt/finalization/credential/error/SQL/stack content or implement any non-goal capability."
      ],
      "persistence": {
        "required": false,
        "action": "none",
        "source": "Schema v7 already owns the complete durable Phase 2 record set; EP-02D changes only typed product/application ingress, presentation, compatibility evidence and documentation."
      }
    },
    "scope": {
      "task_paths": [
        {"path": "AGENTS.md", "kind": "file"},
        {"path": "ARCHITECTURE.md", "kind": "file"},
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "README.md", "kind": "file"},
        {"path": "package.json", "kind": "file"},
        {"path": "docs/README.md", "kind": "file"},
        {"path": "docs/adr/README.md", "kind": "file"},
        {"path": "docs/compatibility/v0.1.md", "kind": "file"},
        {"path": "docs/plans/proposal/EP-02D-phase-2-product-closure.md", "kind": "file"},
        {"path": "docs/plans/proposals/EP-02D-phase-2-product-closure.md", "kind": "file"},
        {"path": "docs/plans/active/EP-02D-phase-2-product-closure.md", "kind": "file"},
        {"path": "docs/plans/completed/EP-02D-phase-2-product-closure.md", "kind": "file"},
        {"path": "docs/plans/evidence/EP-02D", "kind": "directory"},
        {"path": "docs/reference/adapter-contracts.md", "kind": "file"},
        {"path": "docs/reference/authorization-contract.md", "kind": "file"},
        {"path": "docs/reference/cli-contract.md", "kind": "file"},
        {"path": "docs/reference/contract-ownership.md", "kind": "file"},
        {"path": "docs/reference/observability-contract.md", "kind": "file"},
        {"path": "docs/reference/persistence-contract.md", "kind": "file"},
        {"path": "docs/reference/reliability-protocol.md", "kind": "file"},
        {"path": "docs/reference/scheduler-contract.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "docs/reference/validation-policy.md", "kind": "file"},
        {"path": "docs/reference/versioning-compatibility-contract.md", "kind": "file"},
        {"path": "docs/security/privacy-and-logging.md", "kind": "file"},
        {"path": "docs/security/threat-model.md", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "scripts/repo-utils.mjs", "kind": "file"},
        {"path": "src/application.ts", "kind": "file"},
        {"path": "src/cli-api.ts", "kind": "file"},
        {"path": "src/cli.ts", "kind": "file"},
        {"path": "src/dispatcher-application.ts", "kind": "file"},
        {"path": "src/dispatcher.ts", "kind": "file"},
        {"path": "src/execution-loop.ts", "kind": "file"},
        {"path": "src/index.ts", "kind": "file"},
        {"path": "src/persistence/local-ingress.ts", "kind": "file"},
        {"path": "src/product-runtime.ts", "kind": "file"},
        {"path": "test/cli-contract.test.mjs", "kind": "file"},
        {"path": "test/cli-e2e.test.mjs", "kind": "file"},
        {"path": "test/cli-phase2-e2e.test.mjs", "kind": "file"},
        {"path": "test/cli-security.test.mjs", "kind": "file"},
        {"path": "test/configuration.test.mjs", "kind": "file"},
        {"path": "test/domain-architecture.test.mjs", "kind": "file"},
        {"path": "test/dispatcher-application.test.mjs", "kind": "file"},
        {"path": "test/execution-loop-authorization.test.mjs", "kind": "file"},
        {"path": "test/execution-loop-security.test.mjs", "kind": "file"},
        {"path": "test/product-runtime-security.test.mjs", "kind": "file"},
        {"path": "test/product-runtime.test.mjs", "kind": "file"},
        {"path": "test/scaffold.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {"id": "M1", "outcome": "Establish exact EP-02C predecessor/base evidence, freeze the ato.api/v2 compatibility decision and obtain a fresh independent schema-v3 A0 before activation.", "validation_ids": ["V1", "V2"]},
      {"id": "M2", "outcome": "Implement trusted local Phase 2 ingress and one typed product facade that derives durable execution/dispatcher tuples and composes existing owners without changing schema v7.", "validation_ids": ["V3", "V4", "V5", "V6"]},
      {"id": "M3", "outcome": "Implement the strict ato.api/v2 CLI/API grammar, public views, error mapping and named confirmations while preserving ato.api/v1 exactly.", "validation_ids": ["V2", "V7", "V8", "V9"]},
      {"id": "M4", "outcome": "Prove fresh/migrated/restarted runtime workflows, response-loss recovery, source/build/packed parity, package smoke and redaction with the real local Manual backend.", "validation_ids": ["V10", "V11", "V12", "V13"]},
      {"id": "M5", "outcome": "Update authoritative contracts, package status, compatibility evidence and navigation to describe exactly the closed local Manual Phase 2 product and every retained non-claim.", "validation_ids": ["V14", "V15"]},
      {"id": "M6", "outcome": "Obtain fresh independent stable-diff audit and required closure review, preserve terminal validation evidence and reach a task-owned completion-ready result.", "validation_ids": ["V16"]}
    ],
    "validations": [
      {"id": "V1", "type": "manual", "target": "Predecessor, chain, clean base, task ownership and activation readiness", "criterion": "terminal-resolve uniquely identifies completed EP-02C commit 0700d65e9c0db78626aa31baa56f15f009fef41e; local master, origin/master, direct remote ref and the EP-02D material base match it; the preserved coordinator start receipt proves the task began clean except its proposal. Every later reapproval trace has no reservation/pending/identity error, an empty index, complete task ownership, no outside-scope/overlap/pre-existing-dirty item, the unchanged predecessor/material base and intact historical evidence. Fresh independent A0 reproduces the exact current approval digest/base and reports no finding before activation or after any approval revision."},
      {"id": "V2", "type": "automated", "target": "ato.api/v1 byte/behavior compatibility and explicit ato.api/v2 dispatch", "criterion": "Every existing v1 parse success/failure, command set, nineteen-action validation, confirmation, JSON/human byte string, key order, public error/exit and state effect remains exact with omitted version defaulting to v1. Every v2-only command under omitted/v1/unknown version rejects before runtime/trusted ingress; explicit v2 dispatches only the closed v2 schema and never coerces a v1 request."},
      {"id": "V3", "type": "automated", "target": "Trusted local identity, owner and named-confirmation boundary", "criterion": "Product actor/principal/root and stable execution lease owner derive only from validated local runtime identity; each product process/service has a distinct bounded dispatcher worker owner cryptographically bound to that identity. Dispatcher-application atomically claims executions with its optional trusted execution owner while run transitions use the current worker owner; omitting that seam preserves the historical single-owner behavior. Manual-dispatcher composition supplies the product worker owner through its optional seam and otherwise falls back to the stable lease owner. Caller-supplied/changed actor, root, either owner or confirmation cannot reach state. Upgrade, Manual report and completion each require their exact named fresh confirmation, reject missing/wrong/replayed/cross-action values atomically and never display or persist confirmation text."},
      {"id": "V4", "type": "automated", "target": "Typed product-facade ownership and exact durable tuple derivation", "criterion": "For every product command the facade reads one current validated state, rejects missing/duplicate/stale/mismatched Project/Task/execution/attempt/fence/turn/intent/receipt/finalization lineage, derives every non-public semantic field, and calls only the existing dispatcher or reliable-loop owner. Source/architecture tests prove CLI contains no candidate selection, authorization evaluation, Task transition, waiting/retry/reconciliation/completeness or completion rule."},
      {"id": "V5", "type": "automated", "target": "Capability upgrade and finite v2 authorization vocabulary", "criterion": "Explicit v2 authorization upgrade performs one and only one confirmed contiguous 4-to-5, 5-to-6 or 6-to-7 transition per invocation with terminal readback; skip, stale identity, wrong expiry/confirmation, replay and failpoints add no partial authority or dispatch. v2 issue/evaluate accepts exactly the thirty current actions; v1 retains exactly nineteen; migration and renewal never upgrade vocabulary."},
      {"id": "V6", "type": "automated", "target": "Manual Dispatcher product run and durable resume", "criterion": "Explicit v2 dispatch run with exact 30/3600 bounds calls the existing reconcile-first Manual Dispatcher, persists its run/member/intent/summary evidence and returns only its bounded projection. Response loss and an exact same-actor/key/lease replay across process workers read the canonical run and create no duplicate run/effect; actor or lease tuple drift conflicts. A same-process worker may continue its live run; a different worker cannot mutate it before expiry; after expiry a restarted product process performs the existing owner-revision/run-revision takeover CAS, rejects old-worker late writes, and recovers through reconciliation/member/summary protocol. Every newly claimed execution retains the stable actor/root execution lease owner and remains usable by later Manual CLI invocations. Existing callers without either optional owner seam preserve the historical single-owner behavior. Missing/corrupt/stale run state maps to a fixed public failure and CLI never enumerates candidates or computes completeness."},
      {"id": "V7", "type": "automated", "target": "Execution inspect, resume, retry and cancellation product behavior", "criterion": "Each closed command validates all public revisions/attempt/fence before effect, derives current Manual tuple and routes to the existing reliable service. Inspect creates a fresh authorized durable observation; resume/retry honor exact waiting receipt/continuation semantics and safe successor fencing; cancel accepts an operational reason code only through 64 bytes and remains request-then-inspect/verified-interruption. Stale revision/fence, expired lease, wrong lifecycle, ambiguous state and replay produce their fixed bounded outcomes with no blind retry or duplicate effect."},
      {"id": "V8", "type": "automated", "target": "Trusted Manual outcome and separately accepted completion", "criterion": "Manual outcome-report accepts only the closed operation set, a 1..64-byte operational code and a 1..128-byte optional evidence reference, current local identity, fresh execution.inspect authority and exact RECORD MANUAL OUTCOME confirmation, then records through the real Manual control and independent inspect/finalize path. succeed leaves Task running. Only a separate current execution.completion.accept allow plus exact ACCEPT MANUAL COMPLETION confirmation and derived verified receipt/finalization can atomically complete; response loss replays one durable decision and every forged/stale/cross-execution lineage fails without completion."},
      {"id": "V9", "type": "automated", "target": "Closed v2 public schemas, fixed errors and one-line human/JSON presentation", "criterion": "Every inherited v1 result under v2 changes only the envelope version; upgrade, dispatch and execution results match C13's exact field order, including the exact bounded waiting projection. Exhaustive table-driven tests cover every C19 application/persistence/reliable/dispatcher mapping and exact added code/message/exit tuple, one stdout line, empty stderr and no internal-text reflection. Unknown flags/fields, duplicate options, malformed Unicode/control text, noncanonical numbers/timestamps, the exact 64/65 reason-code and Manual-code boundary, the 128/129 boundary for other operational IDs/references, and arbitrary shell/SQL/path endpoints reject before runtime access."},
      {"id": "V10", "type": "automated", "target": "Fresh, every-prefix migration and restart CLI end-to-end", "criterion": "A fresh runtime and copies originating at each shipped schema prefix reach exact schema v7 through the frozen migrations, require explicit sequential capability upgrades, perform Phase 1 setup, Manual dispatch, inspect/outcome/wait/resume or retry/cancel and separately accepted completion across process/store restarts, and preserve exact durable state/audit readback. Migration files/checksums and historical rows remain byte/semantically unchanged and no schema v8 exists."},
      {"id": "V11", "type": "automated", "target": "Durable crash, response-loss and ambiguous-state product recovery", "criterion": "Product-level failpoint/restart tests cover committed dispatch response loss, started turn response loss, every existing intent/observation/verified-not-finalized boundary, stale run/lease takeover, pending member recovery, Manual report response loss, completion response loss and old-fence late write. Restart resumes from durable evidence without duplicate verified effect; unresolved external state remains explicit waiting/ambiguity and cannot be reported as success."},
      {"id": "V12", "type": "automated", "target": "Redaction and security negatives across product output and stored evidence", "criterion": "Known sentinel Task/body/path/prompt/source/environment/credential/confirmation/idempotency/raw adapter error/SQL/stack values are absent from v2 JSON, human output, fixed errors, durable audit and product projections. Actor/principal/owner and backend/thread/intent/receipt/finalization identifiers are absent from v2 JSON, human output, fixed errors and product projections, while existing schema-v7 durable records and bounded audit retain only their contract-required opaque actor/correlation/target and protocol lineage and never sensitive content. Malicious shapes, identity substitutions and corrupted closed enums fail before effect or as typed corruption without a general log/diagnostic/telemetry artifact."},
      {"id": "V13", "type": "automated", "target": "Source, build and packed-install parity plus package smoke", "criterion": "Source TypeScript, built dist and an offline packed-installed ato produce exact matching v1 and v2 success/failure outputs and exits. The isolated package consumer typechecks public declarations, imports the truthful product facade/status, exercises sequential upgrade through vocabulary 7 and a real local Manual dispatch-to-completion restart flow, invokes the console, and leaves no production dependency, Fake backend, runtime database, backup, log, diagnostic, secret or surviving task artifact in the package inventory."},
      {"id": "V14", "type": "manual", "target": "Architecture, compatibility and capability truthfulness", "criterion": "Manual review confirms one owner for every changed rule; schema remains 7; ato.api/v1 and ato.execution/v1 remain closed; ato.api/v2 is explicitly selected and has a complete migration note; CLI is ingress/presentation only; the product facade composes current owners; package/status/docs claim only local explicit-Manual Phase 2 and no supported platform, scheduler, daemon, MCP, Codex/Git/workspace, ProjectPolicy, CompletionBackend/gates, release or deployment."},
      {"id": "V15", "type": "automated", "target": "Impact-selected targeted and complete repository gates", "criterion": "At the accepted material state, targeted CLI/application/authorization/dispatcher/reliable-loop/restart/migration/security/package tests and every frozen offline route pass: lint, strict typecheck, build, complete discovered tests, persistence suite, docs links/fragments, dependency shape, package smoke, Windows SQLite feasibility, Codex isolation and artifact hygiene; no network repair, unsupported support claim or surviving task artifact exists."},
      {"id": "V16", "type": "manual", "target": "Independent implementation audit and terminal evidence readiness", "criterion": "Fresh independent non-fail-fast A1 reviews the stable complete material diff and parent disposition; every confirmed finding is routed by schema, all required repairs have current targeted/full evidence and fresh independent closure-safe A2; trace reports no schema/base/scope/state-freshness/outside-scope/overlap/pre-existing-dirty error; all milestones and validations are terminal, final summary is non-empty, final staged inventory is task-owned, historical evidence is unchanged and no Phase 3 path exists."}
    ],
    "risks": [
      {"id": "R1", "risk": "Adding Phase 2 commands to the wrong API major or changing shared serialization could silently break the closed v1 contract."},
      {"id": "R2", "risk": "CLI could derive internal operation fields or reimplement authorization, reliability, dispatcher completeness or completion rules."},
      {"id": "R3", "risk": "The existing magic Manual actor name could either block the real OS-derived product actor or be loosened into caller-asserted identity."},
      {"id": "R4", "risk": "A product retry after response loss could duplicate a Manual journal operation, dispatcher run, adapter effect or completion decision."},
      {"id": "R5", "risk": "A convenience projection could leak actor/owner, filesystem, Task content, backend/thread or receipt lineage through success or errors."},
      {"id": "R6", "risk": "Product closure could accidentally create schema v8 or change frozen migration/backup/restore/doctor semantics despite no new durable requirement."},
      {"id": "R7", "risk": "Package-only success could mask source/build/installed CLI drift or omit restart/migration behavior."},
      {"id": "R8", "risk": "Truthful local Manual product status could be overstated as supported-platform, scheduler, Codex, workspace, gates or release readiness."},
      {"id": "R9", "risk": "Broad E2E and failpoint routes can leave repository task artifacts that invalidate exact-head validation or final inventory."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {"id": "D1", "statement": "Keep CLI_API_VERSION as the ato.api/v1 compatibility/default constant and introduce an explicit ato.api/v2 identifier, per-major command registries, validators, public projections and error tables. Dispatch the declared major before selecting a command route or touching runtime state.", "rationale": "The closed v1 stays mechanically verifiable while v2 owns the changed behavior."},
      {"id": "D2", "statement": "Do not append a migration. Reuse schema-v7 records through existing readers and owners, and make every fresh/prefix migration/restart test assert current schema remains exactly 7.", "rationale": "No new durable fact is required merely to expose an already implemented product workflow."},
      {"id": "D3", "statement": "Add ProductRuntimeService as the typed application facade over createManualDispatcher and createReliableExecutionService. Give it narrow public commands and bounded views; centralize state tuple resolution and error normalization there, leaving cli-api parsing/formatting only.", "rationale": "This preserves owner direction and makes CLI/application parity directly testable."},
      {"id": "D4", "statement": "Extend local ingress composition with trusted runtime-root key, a stable execution lease owner derived from validated actor/root, a fresh bounded process-local dispatcher worker owner cryptographically bound to that identity, reliable-loop IDs and exact named confirmation delivery. Add an optional ManualDispatcherIngress currentDispatcherOwner seam that falls back to currentLeaseOwner, and map it to DispatcherIngress.currentWorkerOwner. Add an optional DispatcherIngress.currentExecutionLeaseOwner seam that falls back to currentWorkerOwner; claim member executions with that execution owner while every dispatcher run transition and takeover remains bound to currentWorkerOwner. Product composition supplies its fresh dispatcher owner and stable execution owner. Cross-worker exact trigger replay compares trusted actor plus idempotency/lease tuple, returns the canonical stored run and does not rewrite its owner; expired continuation still uses takeover CAS. Never parse actor or either owner from command text.", "rationale": "The product can fence competing/restarted dispatcher workers, preserve cross-process Manual execution and response-loss replay, and leave every existing caller on the historical single-owner behavior when it omits the optional seams."},
      {"id": "D5", "statement": "Remove only the literal local_manual_operator actor-name predicate from Manual reporting and retain the stronger persisted runtime actor/principal/root validation already executed before and after confirmation. Keep historical fixture identities valid when they are the persisted runtime owner.", "rationale": "This closes the real product seam without widening authority or rewriting records."},
      {"id": "D6", "statement": "For execution commands, require public Project/Task/execution revisions plus attempt/fence and derive input, policy, backend/thread, observation, journal, lifecycle, receipt and finalization data from one exact current lineage. Require explicit continuation and required-action receipt identities only where Domain continuation semantics make them user-owned inputs.", "rationale": "CAS expectations remain caller-visible while sensitive/internal protocol coordinates stay with the application owner."},
      {"id": "D7", "statement": "Expose Manual outcome-report because the real local backend is deliberately non-executing. Keep report and completion as two named confirmations and two independent authorization/evidence paths; never combine succeed with completion.", "rationale": "The local Manual product can close the running/completed loop without inventing CompletionBackend or gates."},
      {"id": "D8", "statement": "Project reliable and dispatcher results through allowlists. Omit internal IDs and raw messages, map only closed error codes, and keep exact one-line JSON/human serialization per major.", "rationale": "Durable evidence remains authoritative while product output stays useful and redacted."},
      {"id": "D9", "statement": "Prove behavior at source, build and packed-installed boundaries using deterministic clocks/IDs and disposable trusted runtimes, then repeat the real Manual flow across store/process restarts and every shipped migration prefix.", "rationale": "The product claim binds the actual delivered console and package rather than source tests alone."},
      {"id": "D10", "statement": "Use the frozen coordinator task/manifest, schema-v3 A0/A1/A2 lifecycle, one result commit, standing-authorized current-head prune, every exact-head gate, ready, FF-only local integration and ordinary push; never call cleanup.", "rationale": "Repository lifecycle and product evidence remain serial, recoverable and independently auditable."}
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep the plan proposal and implementation paused. Repair approval/source/scope gaps, archive superseded A0 attempts and obtain fresh independent A0 before moving the same plan to active."},
      {"id": "M2", "recovery": "On facade/identity failure, preserve schema-v7 records and v1 behavior, remove only task-owned product wiring that violates owner boundaries and reopen the exact durable tuple; never patch database rows or migrations."},
      {"id": "M3", "recovery": "On parser/projection/error drift, hold implementation active, restore the documented per-major closed table through task-owned edits and rerun all v1 byte fixtures plus affected v2 security/E2E routes."},
      {"id": "M4", "recovery": "Retain failed task-owned artifacts for diagnosis until a successful rerun; resume each runtime from durable state, never fake rollback or delete ambiguous evidence, then use only the coordinator standing prune after the result commit."},
      {"id": "M5", "recovery": "Remove unsupported capability language or out-of-scope behavior, reconcile every normative statement to its sole owner and rerun docs/package/status/compatibility checks."},
      {"id": "M6", "recovery": "Keep the plan active and task editable on any audit, validation, scope or staged-inventory failure. Repair only in-scope findings, renew material evidence/A2 as required and do not ready, integrate or push until all terminal conditions hold."}
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
      {"id": "V10", "state_binding": "material"},
      {"id": "V11", "state_binding": "material"},
      {"id": "V12", "state_binding": "material"},
      {"id": "V13", "state_binding": "material"},
      {"id": "V14", "state_binding": "material"},
      {"id": "V15", "state_binding": "material"},
      {"id": "V16", "state_binding": "material"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Separate per-major registries/tables, keep v1 default/constants and retain byte-exact fixtures across source/build/packed boundaries.", "recovery": "Reject v2 routing and hold the plan active until every existing v1 fixture and state-effect test reproduces exactly."},
      {"id": "R2", "mitigation": "One typed product facade derives internal tuples and calls existing owners; architecture tests prohibit decision vocabulary in CLI.", "recovery": "Move the duplicated rule back to its authoritative application/dispatcher/reliable owner and rerun parity plus independent review."},
      {"id": "R3", "mitigation": "Use persisted runtimeActorFailure identity/root validation before and after fresh confirmation; remove only the literal actor-name check.", "recovery": "Deny without mutation on any identity drift and retain historical rows; never accept caller actor text or rewrite evidence."},
      {"id": "R4", "mitigation": "Bind exact public revisions plus full derived semantic tuple to existing idempotency and durable replay owners; test response loss at each operation.", "recovery": "Inspect durable state first, return the persisted exact outcome or explicit conflict/ambiguity and never blindly repeat an effect."},
      {"id": "R5", "mitigation": "Allowlist projections and fixed messages, sentinel scans across stored/public output, bounded schema validators and no raw exception reflection.", "recovery": "Drop the unsafe projection, return only fixed INTERNAL_ERROR where necessary and rerun all redaction/security gates."},
      {"id": "R6", "mitigation": "No migration path in scope, explicit schema=7 assertions and frozen migration checksum/every-prefix/restart tests.", "recovery": "Refuse any schema change, preserve the last valid runtime and seek reapproval if a genuinely new durable fact is discovered."},
      {"id": "R7", "mitigation": "Run identical deterministic scenarios through source, compiled and packed console plus declaration/import smoke and restart migration E2E.", "recovery": "Hold product status false, repair package/inventory/entrypoint drift and repeat all three boundaries."},
      {"id": "R8", "mitigation": "Exact status type, compatibility row and normative non-claims for every later capability or unsupported environment.", "recovery": "Remove the unsupported claim, keep only observed local evidence and rerun docs/status/package review."},
      {"id": "R9", "mitigation": "Creator-owned .task-artifacts generations, success-only baseline checks and coordinator frozen-manifest prune after the result commit.", "recovery": "Leave diagnostics intact on failure, rerun safely, then invoke only the standing pathless prune and rebind every exact-head receipt."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "0700d65e9c0db78626aa31baa56f15f009fef41e",
      "current_material_base": "0700d65e9c0db78626aa31baa56f15f009fef41e",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-08-31 14:00:20+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-08-31 14:00:20+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-08-31 14:00:20+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-08-31 14:00:20+08:00"},
      {"id": "M5", "status": "complete", "updated_at": "2026-08-31 14:00:20+08:00"},
      {"id": "M6", "status": "complete", "updated_at": "2026-08-31 14:36:12+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Schema-v3 trace/scope, predecessor resolution, Git refs, coordinator start state and fresh independent A0",
        "evidence": "EP-02C uniquely resolves at 0700d65e9c0db78626aa31baa56f15f009fef41e; task base, local master and origin/master matched it at start. Current trace preserves that base, empty index and full task ownership with errors=[], warnings=[], outside_scope=[], overlap=[] and pre_existing_dirty=[]. Fresh independent A0 attempt 5 reproduced the current approval digest and accepted the repair envelope.",
        "state_id": "approval-sha256:EE9F8E080D30D29881B3098C5722E6947023059F0C59EE65A11458AA0E67840A"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Closed per-major parser, serializer, public-error and full source CLI compatibility tests",
        "evidence": "Unversioned and explicit ato.api/v1 retain the exact Phase 1 command/error/result boundary; explicit ato.api/v2 alone admits the closed Phase 2 tree. Unknown or v2-only commands under v1 stop before runtime selection, and table tests cover duplicate-free option sets, inherited output and deterministic fixed errors.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Local ingress identity/confirmation tests, dispatcher application ownership tests and product security tests",
        "evidence": "The validated local actor/principal/root derives one stable execution owner and a fresh per-product dispatcher owner. Dispatcher claims use the stable execution owner while run transitions use the worker owner; legacy optional-seam callers retain one owner. Missing, substituted or wrong named confirmations and identity tuples fail before mutation and confirmation text is neither stored nor projected.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Typed product-facade unit/E2E, architecture import/inventory and malformed-lineage tests",
        "evidence": "ProductRuntimeService alone derives current Project/Task/execution/attempt/fence/turn/intent/receipt/finalization tuples and delegates to authorization, dispatcher and reliable-loop owners. CLI remains closed ingress/presentation; malformed, accessor, stale and cross-lineage inputs stop without trusted state access or business-rule duplication.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Capability-upgrade, failpoint, vocabulary partition, v1/v2 authorization and migration compatibility tests",
        "evidence": "Each confirmed product upgrade advances exactly one 4-to-5, 5-to-6 or 6-to-7 epoch, returns terminal readback and never dispatches work. v1 remains nineteen actions, v2 admits exactly thirty, failpoints remain atomic, and neither migration nor renewal implicitly upgrades vocabulary or authority.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Dispatcher application/product CLI replay, expiry takeover, pending-member and stale-owner tests",
        "evidence": "Explicit Manual dispatch preserves reconcile-first ordering and bounded projection. Same-actor key/lease replay returns one canonical run across distinct workers without duplicate effect; tuple drift conflicts. Expiry permits one higher-revision takeover, pending members recover, the old worker is fenced, and every claimed execution retains the stable actor/root lease owner.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Product inspect/resume/retry/request-cancel E2E, waiting metadata and reliable-loop boundary tests",
        "evidence": "All commands validate public revisions, attempt and fence, derive the current Manual lineage and route to the reliable owner. Inspect is authorization-bound and durable; resume/retry use exact continuation receipts; cancellation remains request then verified interruption. Stale, expired, terminal and ambiguous states remain typed and effect-safe.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Manual outcome and independent completion acceptance E2E, replay, forgery and confirmation negatives",
        "evidence": "Manual outcome reporting uses the real local backend, fresh inspect authority, exact RECORD MANUAL OUTCOME confirmation and closed operation/code bounds. succeed leaves the Task running. Only separate execution.completion.accept authority plus ACCEPT MANUAL COMPLETION and verified lineage completes it; report and completion response loss replay one durable result.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Exact command schema/key-order/error matrix and hostile pre-runtime parser tests",
        "evidence": "Table tests cover every inherited and added public code/message/exit, exact one-line JSON/human envelopes, closed result ordering and waiting projection. reason-code and Manual code accept 64 bytes and reject 65; other operational IDs accept 128 and reject 129. Unknown, duplicate, malformed Unicode, numeric, timestamp, path, shell and SQL shapes stop before runtime access.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "Real source ato.api/v2 CLI fresh-runtime and table-driven schema-v1-through-v7 migration/restart workflows",
        "evidence": "The fresh workflow and all seven shipped schema prefixes perform explicit sequential upgrades, Phase 1 setup, dispatch, inspect, Manual report and separately accepted completion across process restarts. Every case reaches exactly schema 7, preserves prefix migration rows/checksums and historical readback, and proves no schema 8 object exists.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "Product facade durable-checkpoint, response-loss, cross-worker takeover, pending recovery and ambiguity tests",
        "evidence": "Product-level recovery reopens prepared, executing, independent-inspect, observed, receipt, verified, finalized and adapter-effect checkpoints; dispatch, Manual-start, Manual-report and completion response loss; expired-run takeover; pending members; and old-fence writes. Reopen produces no duplicate intent, observation, receipt, finalization or effect, while unresolved external state remains explicit waiting/ambiguity.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V12",
        "status": "passed",
        "method": "Product security/redaction sentinel matrix, closed durable decoder and public projection review",
        "evidence": "Task, path, prompt, source, environment, credential, confirmation, idempotency, raw adapter error, SQL and stack sentinels never enter v2 output or sensitive durable evidence. Public views omit actor/principal/owner and protocol IDs; existing schema-v7 bounded audit and opaque lineage remain contract-readable. No logger, diagnostic bundle, telemetry or product cleanup path was added.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V13",
        "status": "passed",
        "method": "Isolated source/build/packed-install package smoke with complete Phase 2 console transcript parity",
        "evidence": "All three console boundaries produce exact normalized success, denial, malformed, restart, replay and human-output behavior through upgrades, dispatch, inspect, report and completion. The 118-file package passes declarations/import/persistence/uninstall, includes no production dependency or Fake backend, and leaves its test runtime only inside creator-owned generation with no survivor.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V14",
        "status": "passed",
        "method": "Manual architecture/contract/status/compatibility review plus exact documentation gate",
        "evidence": "Schema remains 7; ato.api/v1 and ato.execution/v1 remain closed; explicit ato.api/v2 and ProductRuntimeService compose existing owners. Status and 92 Markdown files describe only the local explicit-Manual Phase 2 runtime/manual-local capability and retain every scheduler, daemon, MCP, Codex/Git/workspace, policy/gate, platform, release and deployment non-claim; docs links/fragments pass 252/21 with forbidden=0.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V15",
        "status": "passed",
        "method": "Impact-selected focused routes plus canonical pinned-runtime pnpm verify:offline",
        "evidence": "After the preserved failed A2 and narrow CLI-contract repair, the targeted CLI route passes 8/8 and the full offline route passes lint 193/28, strict typecheck/build, 431/431 tests, artifact hygiene with zero terminal entries, docs 92/252/21/0, zero production dependencies, 118-file package parity, Windows SQLite 3.53.3 with zero survivor and Codex blocked/unclaimed. No network repair, omitted dependent gate, unsupported claim or surviving task artifact exists.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      },
      {
        "id": "V16",
        "status": "passed",
        "method": "Fresh independent A1, preserved failed A2, fresh closure-safe repeat A2 and terminal schema-v3 trace/scope review",
        "evidence": "A1 reported five MEDIUM and one LOW finding. A2 attempt 1 independently closed five but found MEDIUM F-EP02D-A2-001 in the normative CLI bound paragraph; that history and the superseded green route remain preserved. After the sole contract repair and current targeted/full validation, fresh independent repeat A2 /root/ep02d_a2_final bound git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96, closed all six A1 IDs and F-EP02D-A2-001 in its evidence, found no adjacent defect and was closure-safe. Current check/trace report exact approval/base/state, errors=[], warnings=[], outside_scope=[], overlap=[] and pre_existing_dirty=[]; the index is empty, all task material is owned, every milestone/validation is terminal, final summary is non-empty and no Phase 3 path exists.",
        "state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/ep02d_a0_reapproval3",
        "independence": "Fresh independent, non-fail-fast, read-only schema-v3 A0. The reviewer did not draft EP-02D, participate in its substantive design, implement or repair its material diff, or perform A1. No file, Git/index, coordinator, plan, runtime, artifact, network, permission, test-output, or external-state mutation was made.",
        "scope": "Complete revised EP-02D proposal and all preserved A0/A1 history; repository AGENTS.md, ARCHITECTURE.md, docs/plans/README.md and authoritative governance, Domain, CLI, versioning, authorization, persistence, reliability, adapter, scheduler, completion/workspace, observability, privacy, threat, toolchain, validation, contract-ownership and Git-flow contracts; harness-exec-plan SKILL, PLAN-SCHEMA, A0 method and full Tier-2 persistence lens; current dispatcher application/orchestration, execution, local-product ingress, product facade, CLI, package and selected owner-level test sources; predecessor, Git, coordinator, scope and canonical approval identity.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-31 13:19:00+08:00",
        "approval_sha256": "EE9F8E080D30D29881B3098C5722E6947023059F0C59EE65A11458AA0E67840A",
        "evidence": "Independent canonical JSON serialization produced 37,440 UTF-8 bytes and SHA-256 EE9F8E080D30D29881B3098C5722E6947023059F0C59EE65A11458AA0E67840A. Fresh trace, scope and audit-init exited 0; terminal freshness trace returned ok=true, errors=[], warnings=[], lifecycle=proposal, approval/current material base and HEAD 0700d65e9c0db78626aa31baa56f15f009fef41e, state git-sha1:430b6b8848a476729adee31733549c079a359970, empty index, outside_scope=[], overlap=[], pre_existing_dirty=[], and next_action=run_a0. HEAD, task branch, local master and refs/remotes/origin/master matched the predecessor; terminal-resolve and chain-check accepted the EP-02C terminal. Git-flow trace was clean with no pending operation/reservation, all 24 gates pending and .task-artifacts absent. The revised two-level optional owner seams, cross-worker canonical trigger replay, expiry takeover CAS, stable execution owner, V1 and V12 criteria are coherent and narrowly implementable in declared paths while preserving historical single-owner callers. The v1/v2 decision, thirty-action contiguous upgrades, 64-byte closed execution-code bounds, exhaustive fixed errors, schema-v7 boundary, source/build/packed/every-prefix recovery evidence and redaction criteria are consistent and binary. Tier-2 review confirmed one schema-v7 writer/decoder owner, typed product reads and fail-closed identity/CAS/replay without a new migration, writer, logger, telemetry or cleanup product. All six preserved A1 findings remain confirmed, in scope, material-changing and routed to fresh A2. No Phase 3 path exists. No tests ran because A0 was read-only and artifact-free; the immutable report is docs/plans/evidence/EP-02D/a0-attempt-5.md.",
        "parent_disposition": "complete",
        "findings": [],
        "reviewed_material_base": "0700d65e9c0db78626aa31baa56f15f009fef41e"
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/ep02d_a1",
        "independence": "Fresh independent non-implementer, non-repairer A1. The reviewer reconstructed the result from repository evidence, actively searched beyond existing passing-test claims, and performed no file, Git/index, coordinator, ExecPlan, permission, network, test-artifact, runtime-state, or external-state mutation.",
        "scope": "Reviewed EP-02D base/HEAD 0700d65e9c0db78626aa31baa56f15f009fef41e and complete 39-path stable worktree material state git-sha1:cd8a5c296f676650afadc955b1618000064ec83d, including repository guidance, schema-v3 and A1 guidance, the active plan and evidence, all 31 tracked modifications and 8 untracked task-owned files, authoritative contracts, product facade, trusted ingress, CLI routing/serialization, execution-loop seam, package smoke, source CLI E2E, security tests, capability status, redaction, compatibility, schema-v7 non-change, and explicit non-goals.",
        "reviewed_at": "2026-08-31 12:35:11+08:00",
        "evidence": "Fresh audit-init, trace and state reproduced approval-contract bytes 34146, SHA-256 9DB4EC14F569B53AAAA73A6E5FF80171F6C5D3B58B1F3B42AF2B8257F25B5011, base/current base/HEAD/master/origin-master 0700d65e9c0db78626aa31baa56f15f009fef41e, material identity git-sha1:cd8a5c296f676650afadc955b1618000064ec83d, empty index, exact scope, errors=[], warnings=[], and git diff --check success. Full non-fail-fast review found five MEDIUM gaps and one LOW documentation inconsistency; the immutable report is docs/plans/evidence/EP-02D/a1-report.md. The parent independently reproduced and accepted all six findings. Existing lower-layer tests are not product-bound proof. The reviewer ran no tests and made no artifact.",
        "reviewed_state_id": "git-sha1:cd8a5c296f676650afadc955b1618000064ec83d",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-EP02D-A1-001",
            "severity": "MEDIUM",
            "summary": "A deterministic actor/root owner makes every CLI process the same dispatcher worker, preventing correct expired-run takeover and distinct stale-worker fencing.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Add one compatible optional worker-owner seam to ManualDispatcherIngress: existing callers fall back to currentLeaseOwner, while the product provides a fresh bounded process worker owner for dispatcher run ownership and retains its stable actor/root execution lease owner for cross-process Manual commands. Preserve exact durable replay through the run identity/read seam and test takeover, stale-worker rejection and duplicate-free replay.",
            "closure_evidence": "Closed at git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96 by separate stable execution and fresh dispatcher owners, compatible optional seams, canonical cross-worker replay, exact-expiry takeover and stale-owner fencing. Product and dispatcher tests plus full 431/431 evidence pass; fresh independent repeat A2 found no residual.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02D-A1-002",
            "severity": "MEDIUM",
            "summary": "The v2 public reason-code and Manual-code 128-byte bound conflicts with the closed ato.execution/v1 64-byte bound.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Preserve ato.execution/v1; narrow only v2 --reason-code and Manual --code to 1..64, retain 1..128 for other IDs/references, obtain fresh A0, and add exact pre-runtime boundary tests.",
            "closure_evidence": "Closed at git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96. Parser and product facade accept exact 64 and reject 65 for only reason-code and Manual code, retain 128/129 for IDs/references, and the repaired normative CLI contract now says the same. A2 attempt 1 finding F-EP02D-A2-001 is preserved; fresh repeat A2 independently closes the complete boundary.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02D-A1-003",
            "severity": "MEDIUM",
            "summary": "The fresh-only Phase-2 CLI E2E does not satisfy V10 every-prefix migration/restart and historical-readback evidence.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Add table-driven product CLI migration/restart evidence for every shipped prefix, exact schema 7/no schema 8, explicit upgrades, required Manual workflow and preserved historical rows/checksums.",
            "closure_evidence": "Closed at git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96 by real source CLI workflows from every shipped schema prefix 1 through 7 with explicit upgrades, restart, dispatch/report/completion, preserved migration history/checksums, exact schema 7 and no schema 8. Current full validation and fresh repeat A2 confirm the closure.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02D-A1-004",
            "severity": "MEDIUM",
            "summary": "The product tests omit dispatchResume and the required V11 crash, response-loss, takeover, pending-member, replay, old-fence and ambiguity recovery classes.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Reopen every existing lower-layer durable boundary through the real product facade or v2 CLI and prove exact replay, no duplicate verified effect, pending-member completion, takeover/fence CAS, report/completion replay and explicit ambiguity.",
            "closure_evidence": "Closed at git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96 by product-bound recovery across every durable checkpoint, dispatcher/start/report/completion response loss, expired takeover, pending members, old-owner rejection, duplicate-count assertions and explicit ambiguous external state. Current full validation and fresh repeat A2 found no residual.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02D-A1-005",
            "severity": "MEDIUM",
            "summary": "Source/build/installed console parity covers doctor and malformed input, not successful/denied Phase-2 CLI operations, human v2, restart or replay.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Run a deterministic trusted-runtime Phase-2 CLI scenario through source, built and packed-installed ato with upgrades, dispatch/inspect/report/completion, restart/replay, denial, malformed input, JSON/human output and public exits.",
            "closure_evidence": "Closed at git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96 by isolated source/build/packed-installed full v2 success, denial, malformed, restart, replay and human-output transcript parity, durable schema-v7 readback, package inventory and uninstall. The 118-file smoke and fresh repeat A2 confirm no residual or runtime survivor.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02D-A1-006",
            "severity": "LOW",
            "summary": "The adapter contract retains the obsolete local_manual_operator path name and the toolchain contract says both explicit three sequential upgrades.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Mechanically name the current OS/runtime-derived actor/principal/root boundary and change both explicit three to three sequential without adjacent semantic change.",
            "closure_evidence": "Closed at git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96 by the exact OS/runtime-derived actor/principal/root wording and corrected three-sequential-upgrades wording. Documentation passes 92/252/21/0, git diff check passes and fresh repeat A2 found no adjacent semantic drift.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "/root/ep02d_a2_final",
        "independence": "Fresh independent, read-only, non-fail-fast schema-v3 repeat A2. The reviewer did not participate in EP-02D implementation, any repair, A1, or A2 attempt 1. No file, index, Git/coordinator, ExecPlan, runtime, test-artifact, permission, network, or external-state mutation was made; no test was run.",
        "scope": "Reviewed the complete repaired 45-path task material state and all six current A1 a2_required findings, preserved A1 and A2-attempt-1 reports, validation evidence, repository guidance, active EP-02D plan, authoritative Domain, authorization, persistence, reliability, adapter, dispatcher/scheduler, CLI, observability, versioning, validation, privacy, threat, toolchain and Git-flow contracts, plus harness-exec-plan schema-v3 A2 and Tier-2 persistence guidance. Direct source and test review covered worker/execution-owner separation, replay/takeover/fencing, exact code and identity bounds, every-prefix migration, product recovery, source/build/installed parity, redaction, v1/v2 compatibility, schema-v7 closure, and Phase-3 exclusions.",
        "reviewed_at": "2026-08-31 14:34:42+08:00",
        "evidence": "Fresh read-only trace, scope, state and audit-init exited 0 and reproduced approval SHA-256 EE9F8E080D30D29881B3098C5722E6947023059F0C59EE65A11458AA0E67840A, base/HEAD 0700d65e9c0db78626aa31baa56f15f009fef41e, material state git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96, empty index, exact task ownership, errors=[], warnings=[], outside_scope=[], overlap=[] and pre_existing_dirty=[]. Git diff --check exited 0. Audit-init derived exactly the six A1 closure IDs. F-EP02D-A1-001 is closed: local ingress derives one stable actor/root execution owner and a fresh cryptographically bound dispatcher worker; compatible optional seams keep legacy behavior, trigger replay binds actor plus idempotency/lease tuple rather than worker, expiry takeover increments owner revision, claimed executions retain the stable owner, and old-worker writes are fenced. F-EP02D-A1-002 and preserved F-EP02D-A2-001 are closed: C9/V7/V8/V9, the authoritative CLI contract, cli-api and product-runtime consistently retain 1..128 ASCII IDs/references while limiting only reason-code and Manual code to 1..64; exact 64/65 and 128/129 tests match. F-EP02D-A1-003 is closed by the real v2 CLI loop over schema prefixes 1 through 7, frozen migrations, separate-process restart, exact schema 7, preserved prefix history/checksums and absence of schema-v8/Phase-3 objects. F-EP02D-A1-004 is closed by product-bound response-loss/replay, expired takeover, pending-member recovery, stale-owner evidence, every reliable checkpoint, adapter-effect, report/completion/start response-loss, duplicate-count assertions and explicit ambiguity. F-EP02D-A1-005 is closed by isolated source/build/packed-installed full scenarios covering denial, upgrades, dispatch, inspect, report, separate completion, restart/replay, human output, transcript parity, durable readback, redaction, inventory and uninstall. F-EP02D-A1-006 is closed by the exact current OS/runtime-derived actor/principal/root wording and corrected sequential-upgrades wording. Adjacent review found one typed product facade and existing schema-v7 owners, no migration or second writer, closed projections/errors, unchanged default ato.api/v1, explicit ato.api/v2, no schema v8 and no later-phase or product-cleanup implementation. Passing validation was corroborating evidence only; findings=[]; closure-safe.",
        "reviewed_state_id": "git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96",
        "parent_disposition": "complete",
        "closes": [
          "F-EP02D-A1-001",
          "F-EP02D-A1-002",
          "F-EP02D-A1-003",
          "F-EP02D-A1-004",
          "F-EP02D-A1-005",
          "F-EP02D-A1-006"
        ],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-EP02D-A0-001", "F-EP02D-A0-002"],
        "disposition": "superseded",
        "reason": "Fresh independent A0 reproduced approval digest 7EF09297574BA30F71EDE956272405EEC944A1FB2EC240C9B42108016C32D3A8 and confirmed the plan was otherwise coherent, then found one current capability-status navigation path missing from scope and that the first ato.api/v2 approval did not yet freeze authorization-upgrade expiry, exact success shapes/key order and the exhaustive public error mapping. The parent independently confirmed both gaps, added only docs/adr/README.md with a qualified status-edit limit, froze the complete v2 grammar/projections/error table in C9/C13/C19 and V9, archived the report, and requires a fresh independent A0 before activation."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-EP02D-A0-003"],
        "disposition": "superseded",
        "reason": "Fresh independent A0 reproduced approval digest DE2A9EE06BB1345546004DFCB1B1DBC34DE47A64DEDB8DCD4C4B3A6A3B738D63, confirmed the proposal was otherwise coherent and found that C19 mapped two internal INVALID_INPUT values to a nonexistent same-named public code. The parent independently confirmed the contract gap, archived the report, changed only those mappings to the inherited public CLI_INVALID_INPUT code, retained every other mapping and requires a fresh independent A0 before activation."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "Fresh independent A0 at 2026-08-31 10:56:16+08:00 accepted digest 9DB4EC14F569B53AAAA73A6E5FF80171F6C5D3B58B1F3B42AF2B8257F25B5011 and activated EP-02D. Fresh independent A1 then confirmed F-EP02D-A1-002: the approved 128-byte public reason-code and Manual-code bound conflicts with the closed ato.execution/v1 64-byte boundary. The parent reproduced the conflict, preserved the complete A1 report, narrowed only those two public fields to 64 while retaining every other 128-byte operational ID/reference, and requires fresh A0 before repair."
      },
      {
        "audit": "A0",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": ["F-EP02D-A0-004", "F-EP02D-A0-005", "F-EP02D-A0-006"],
        "disposition": "superseded",
        "reason": "Fresh independent A0 reproduced approval digest D6C85C81225C6A716B48DA68977710F169110C74FB717440D94093AB0D5B574C and found three MEDIUM gaps: the wrapper-only owner seam could not separate run ownership, trigger replay identity and claimed execution ownership; V1 retained an unsatisfiable proposal-only clean-worktree criterion after preserved A1 material; and V12 contradicted authoritative schema-v7 audit lineage. The parent independently accepted all three, archived the immutable report at docs/plans/evidence/EP-02D/a0-attempt-4.md, revised only those approval surfaces, and requires another fresh independent A0 before repair."
      },
      {
        "audit": "A2",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-EP02D-A2-001"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A2 at 2026-08-31 14:14:24+08:00 bound git-sha1:f20da5e7cd02ba30173a66c6fdc9294bb76dbc73 and independently closed A1 findings 001, 003, 004, 005 and 006. A1-002 was closed in implementation and 64/65 plus 128/129 tests, but the sole normative ato.api/v2 CLI contract still assigned the 128-byte grammar to every Phase 2 code. This confirmed in-scope MEDIUM F-EP02D-A2-001 requires one narrow authoritative-contract repair, current validation and fresh independent repeat A2. The complete immutable report is docs/plans/evidence/EP-02D/a2-attempt-1.md."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V15",
        "attempt": 1,
        "classification": "superseded",
        "at": "2026-08-31 14:17:11+08:00",
        "evidence": "The pre-A2 candidate passed the complete pinned-runtime offline route with 431/431 tests, docs, package, SQLite, Codex-boundary and artifact-hygiene results plus exact scope and diff checks. Fresh independent A2 attempt 1 then found F-EP02D-A2-001 in the normative CLI bound paragraph. The green route remains factual history but cannot support closure after the required contract repair.",
        "state_id": "git-sha1:f20da5e7cd02ba30173a66c6fdc9294bb76dbc73"
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-08-31 06:59:00+08:00",
        "summary": "Closed F-EP02D-A0-001 by adding the stale ADR navigation owner to task scope with only the approved local Manual product status correction, and closed F-EP02D-A0-002 by freezing the complete ato.api/v2 option grammar and bounds, exact per-command result projections/key order, exhaustive fixed public errors/exits and deterministic internal mappings before implementation.",
        "previous_approval_sha256": "7EF09297574BA30F71EDE956272405EEC944A1FB2EC240C9B42108016C32D3A8"
      },
      {
        "at": "2026-08-31 10:47:55+08:00",
        "summary": "Closed F-EP02D-A0-003 by mapping the reliable-loop and dispatcher internal INVALID_INPUT codes to the inherited public CLI_INVALID_INPUT code while preserving the rest of the exhaustive ato.api/v2 error table and deterministic mapping unchanged.",
        "previous_approval_sha256": "DE2A9EE06BB1345546004DFCB1B1DBC34DE47A64DEDB8DCD4C4B3A6A3B738D63"
      },
      {
        "at": "2026-08-31 12:40:12+08:00",
        "summary": "After confirmed A1 F-EP02D-A1-002, preserved the closed ato.execution/v1 contract and narrowed only the ato.api/v2 --reason-code and Manual outcome --code fields from 128 to 64 bytes; all other operational IDs and references remain 128 bytes. Fresh A0 is required before implementation repair.",
        "previous_approval_sha256": "9DB4EC14F569B53AAAA73A6E5FF80171F6C5D3B58B1F3B42AF2B8257F25B5011"
      },
      {
        "at": "2026-08-31 12:47:28+08:00",
        "summary": "After reproducing A1 F-EP02D-A1-001, added only src/dispatcher.ts and an optional compatible worker-owner seam to the approved repair envelope: product dispatcher runs receive a fresh per-process owner, execution leases retain the stable actor/root owner required by separate Manual CLI invocations, and existing library callers preserve their historical fallback behavior. The interrupted pre-revision A0 produced no report; fresh A0 is required for this complete revision.",
        "previous_approval_sha256": "D0FAE4B6D16ED4D23112C752614041A5D55F499B997150F53ABFABD6CC8F0EC3"
      },
      {
        "at": "2026-08-31 13:03:37+08:00",
        "summary": "Closed F-EP02D-A0-004 by adding dispatcher-application plus its narrow owner-level test to scope and freezing compatible separate run-worker/execution-owner seams with cross-worker canonical trigger replay and takeover CAS; closed F-EP02D-A0-005 by replacing the stale proposal-only cleanliness assertion with the preserved clean-start receipt plus current empty-index/full-ownership trace; and closed F-EP02D-A0-006 by limiting identity-lineage omission to public projections while preserving contract-required bounded opaque durable audit and schema-v7 lineage.",
        "previous_approval_sha256": "D6C85C81225C6A716B48DA68977710F169110C74FB717440D94093AB0D5B574C"
      }
    ],
    "final_summary": "EP-02D closes Phase 2 as a local explicit-Manual product on unchanged schema v7: unversioned ato.api/v1 remains exact, explicit ato.api/v2 adds confirmed contiguous capability upgrades, Manual dispatch/run recovery, execution inspect/resume/retry/request-cancel, trusted Manual outcome reporting and separately confirmed completion acceptance through one typed product facade over the existing authorization, dispatcher and reliable-loop owners. Source, build and packed-installed consoles, fresh and every shipped schema prefix, restart/response-loss/fencing/ambiguity recovery, redaction and package hygiene pass at exact material state git-sha1:336fd31dc4d4c7e1c2654c133360b34dcaa51d96. Fresh independent repeat A2 closes all six A1 findings and preserved F-EP02D-A2-001 with no current finding; scheduler, MCP, Codex/Git/workspace, ProjectPolicy, CompletionBackend/gates, telemetry, diagnostic, release, deployment and product cleanup remain absent."
  }
}
~~~

## Context

EP-02A、EP-02B 与 EP-02C 已分别实现并验证 execution claim、可靠本地 Manual loop 与 library-only reconcile-first Manual Dispatcher。当前缺口不是新的可靠性记录，而是一个能从真实 OS 派生本地身份、显式升级有限能力、调用这些现有 owner、在崩溃后重开同一 durable evidence，并只显示脱敏有界结果的版本化产品入口。
