# ExecPlan：建立 reconcile-first Manual Dispatcher

本计划只实现 Phase 2 的第三段：在已验证并推送的 EP-02B 可靠 Manual 执行闭环上，建立 library-only、仅显式 Manual trigger 的 reconcile-first Dispatcher。EP-02B 的终态和随后校正的 schema-v6 checksum 合同是本计划的只读基线；本计划拥有独立的 planning、activation、implementation、audit、validation 和 Git-flow 生命周期。

~~~execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-31 02:50:34+08:00",
    "updated_at": "2026-08-31 06:25:35+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user directive in thread 01a0521b-4236-7130-9116-bfd80373cf18",
        "at": "2026-08-31 02:50:34+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "current user directive and repository persistence/ExecPlan contracts",
        "at": "2026-08-31 02:50:34+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "At the verified EP-02B terminal lineage and corrected schema-v6 contract base, implement and validate a library-only reconcile-first Manual Dispatcher that creates an authorization-bound durable run for each explicit Manual trigger, fences run ownership and heartbeat, reconciles unfinished execution evidence and stale runs before any new candidate work, atomically seals the complete finite ready-Task membership, resolves every sealed member to exactly one durable finite outcome with claim/start-intent atomicity, recovers competing workers and pending members, and publishes a terminal durable summary only through exact completeness and owner/revision CAS checks.",
    "non_goals": [
      "Do not implement SchedulerBackend, scheduler registration, hourly or automatic scheduling, scheduled-trigger deduplication, daemon/service installation, Codex, Git, workspace, ProjectPolicy, CompletionBackend, completion gates, MCP, multi-host dispatch, D:\\quant dogfood, release, deployment, telemetry, diagnostic bundles, general log files, or cleanup.",
      "Do not add or change a public Phase 2 product CLI/API command. ato.api/v1 remains the Phase 1 product surface; EP-02D alone owns compatibility analysis and product ingress for Manual dispatch, execution inspect, resume, retry, cancel, and Manual completion acceptance.",
      "Do not change Task eligibility, Task state transitions, waiting/completion/cancellation semantics, ato.execution/v1, the Manual backend contract, or turn_succeeded completion ownership except for the narrow internal composition needed to prepare a dispatch-bound start intent atomically with a successful claim.",
      "Do not create or activate EP-02D before EP-02C has a verified terminal commit, current-head artifact-prune and gate receipts, FF-only local integration, and verified ordinary origin/master push.",
      "Do not rewrite historical completed plans, evidence, released migrations 0001 through 0006, historical authorization vocabulary/epochs/grants, lifecycle digests, or audit history."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "The unique EP-02B terminal plan commit is 544bf159f5dfe3517ec7d2535894422888c8a7e9. Current material base fcbd537bfcc0ba41f037031790a3f487c05e7378 adds only the separately validated persistence-contract checksum correction and is pushed identically to master and origin/master. The ordered chain remains EP-01D -> EP-02A -> EP-02B -> EP-02C -> EP-02D -> Phase 3.",
        "source": "current user directive; docs/plans/README.md; coordinator and remote terminal evidence"
      },
      {
        "id": "C2",
        "statement": "The historical single EP-02 is an umbrella refined by the current user into EP-02A through EP-02D. EP-02A recorded that refinement; EP-02C preserves it without editing historical completed plan bytes or treating umbrella text as implementation evidence.",
        "source": "current user directive; docs/plans/completed/EP-02A-durable-execution-claim-foundation.md"
      },
      {
        "id": "C3",
        "statement": "Schema change is one narrow additive canonical migration 0007. It allocates only vocabulary-7 lineage, lifecycle-digest provenance version 4, and dispatcher Manual-trigger request/decision/audit, run ownership/heartbeat, reconciliation, sealed membership, terminal member outcome and summary records required by this implementation. Digest version 4 has one physical provenance owner and its exact projection is the complete version-3 projection plus vocabulary-7 epochs/grants/linkage and every dispatcher trigger, decision, audit, run, reconciliation item/summary, membership/member and terminal summary record. Byte-semantic readers for digest versions 1, 2 and 3 remain unchanged. Backup cloned-provenance verification selects the exact projection recorded by each lifecycle authorization, using version 4 only for version-4 authorization and preserving versions 1, 2 and 3; manifest shape, public backup/restore behavior and permissions remain unchanged. Migrations 0001-0006 remain byte-identical and every shipped prefix remains strictly readable, upgradeable only after the existing verified backup boundary, restorable, doctor-classifiable and corruption-checked; migration itself creates no digest-provenance, authorization or dispatcher row.",
        "source": "current user directive; docs/reference/persistence-contract.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C4",
        "statement": "The only new grantable action is dispatch.run. Migration, bootstrap, adoption and vocabulary-6 renewal create no dispatch.run grant. One fresh identity- and confirmation-bound 6-to-7 upgrade appends exactly one vocabulary-7 epoch and thirty fresh origin grants at that epoch lifetime: the twenty-three Phase-2A actions remain in the legacy physical owner and receive exact vocabulary-7 linkage, the six Manual actions remain in their v6 physical owner and receive exact vocabulary-7 linkage, and one dispatch.run grant is stored in the v7 physical owner. Vocabulary-7 renewal likewise appends exactly one vocabulary-7 epoch and thirty fresh grants with the same 23+6+1 partition. Global grant IDs, per-epoch action inventory, physical ownership/linkage and historical 4/5/6 lineage are exact and corruption-checked. Capability upgrade performs no dispatcher work. dispatch.run authorizes only creation, ownership and continuation of one bounded dispatcher run; it never implies execution.claim, execution.start, execution.inspect, execution.lease.takeover, adapter, filesystem, scheduler, network, Git, workspace, completion or cleanup authority.",
        "source": "current user directive; docs/reference/authorization-contract.md"
      },
      {
        "id": "C5",
        "statement": "Only a schema-valid explicit Manual trigger is implemented. Trusted dispatcher ingress supplies actor/principal/runtime-root identity, current UTC time, fresh bounded IDs and a worker owner identity outside command content. Each allowed observation creates its own starting canonical run bound to a final current dispatch.run decision; denial records one bounded unattached observation and no run, Task mutation, claim, intent or adapter effect. Manual observations are not time-proximity deduplicated and reused trusted identities fail closed.",
        "source": "current user directive; docs/reference/scheduler-contract.md#trigger-and-run-identity; docs/reference/authorization-contract.md"
      },
      {
        "id": "C6",
        "statement": "A dispatcher run has the closed status starting, reconciling, sweeping, completed, partial, failed or interrupted, plus one current trusted-ingress worker owner, positive owner revision, positive run revision, immutable requested run-lease duration in whole seconds, current heartbeat and lease expiry. Initial duration must be a safe integer from 30 through 3600 inclusive; expiry is exactly trusted UTC now plus that stored duration. Heartbeat renewal accepts no caller-selected duration, requires the exact run/owner/revision/status, a trusted now strictly after the prior heartbeat, and a computed expiry strictly after the stored expiry; it writes heartbeat=now and expiry=now+stored duration, never old-expiry-plus-duration. Takeover is refused before expiry and is first eligible at trusted now greater than or equal to expiry; it reauthorizes dispatch.run, obtains the worker owner only from trusted ingress, increments owner and run revisions exactly once, and resets heartbeat/expiry from takeover now and the same stored duration. Every old-owner or non-forward write is rejected without mutation.",
        "source": "current user directive; docs/reference/scheduler-contract.md#worker-death; docs/reference/reliability-protocol.md"
      },
      {
        "id": "C7",
        "statement": "Every allowed current run durably verifies its trigger link, then reconciles the complete bounded set of pre-existing unfinished intents, verified-but-unfinalized receipts, expired execution leases and stale dispatcher runs before candidate selection. Reconciliation uses the existing authorization-bound reliable loop and claim/takeover owners, persists bounded per-resource disposition plus an immutable complete summary, never treats process death or an in-memory clean flag as evidence, and prevents a new claim for any resource whose state remains ambiguous or unauthorized while allowing independent resources to continue.",
        "source": "current user directive; docs/reference/scheduler-contract.md#reconcile-first-run-order; docs/reference/reliability-protocol.md#recovery-matrix"
      },
      {
        "id": "C8",
        "statement": "Only after the reconciliation summary is durable may one short writer transaction re-evaluate the current Domain eligibility predicate, sort the complete finite eligible Task set deterministically, and seal an immutable membership revision, expected count and exactly one pending row per distinct Task with contiguous ordinal, Project ID/config/resource revisions, Task ID/revision and candidate-row revision. The empty set is an explicit sealed membership. No claim, start intent, adapter call or candidate-bound mutation occurs before seal commit, and no later eligibility query adds, removes or reorders members.",
        "source": "current user directive; docs/reference/reliability-protocol.md#observable-fan-out; docs/reference/domain-contract.md"
      },
      {
        "id": "C9",
        "statement": "Each sealed member CAS-matches run, membership revision, current run owner/revision, ordinal, Project/Task identities and revisions, pending lifecycle and row revision, then reaches exactly one immutable terminal outcome: claimed, already_claimed, ineligible_at_cas, authorization_denied, policy_deferred, resource_deferred, reconciliation_required or failed. No early exit or resource exhaustion may leave a later sealed member pending without durable recovery work.",
        "source": "current user directive; docs/reference/reliability-protocol.md#observable-fan-out"
      },
      {
        "id": "C10",
        "statement": "A claimed outcome is committed in the same application-owned transaction as the execution claim, ready-to-running Domain transition, sequence/fence/attempt, current execution.claim decision and a complete authorization-bound execution.start intent prepared before any adapter call; the member binds the created execution and intent IDs. dispatch.run is evaluated separately and never substitutes for either execution action. Other member outcomes commit atomically with any applicable decision/audit/Domain evidence. The Dispatcher invokes only the existing reliable-loop continuation outside the writer transaction.",
        "source": "current user directive; ARCHITECTURE.md; docs/reference/authorization-contract.md; docs/reference/reliability-protocol.md"
      },
      {
        "id": "C11",
        "statement": "Competing Manual runs may seal overlapping then-eligible Tasks, but the existing execution sequence/Task CAS permits exactly one claim winner. Every loser receives the finite truthful outcome determined at its own authoritative CAS. A run-owner takeover enumerates its sealed rows instead of repeating eligibility, reconciles every pending or claimed-bound execution/intent, and never infers success from absence, timeout, process death or a stale worker response.",
        "source": "current user directive; docs/reference/scheduler-contract.md#worker-death; docs/reference/reliability-protocol.md#observable-fan-out"
      },
      {
        "id": "C12",
        "statement": "A terminal summary is derived only from durable reconciliation and member rows when expected count equals total rows and distinct Tasks, ordinals are unique and contiguous from zero, every row matches the sealed membership revision, every member is terminal and every claimed member has its exact bound execution/start-intent evidence. Summary insertion and terminal run status share current owner/revision CAS. Any count, identity, revision, lifecycle or binding mismatch leaves the summary absent and returns a typed integrity/recovery failure rather than fabricated completion.",
        "source": "current user directive; docs/reference/reliability-protocol.md#observable-fan-out"
      },
      {
        "id": "C13",
        "statement": "Crash and restart evidence covers trigger/run commit, ownership and heartbeat, each reconciliation checkpoint, summary-before-seal order, before/after seal, every member outcome, claim/start-intent atomicity, response loss, pending-member recovery, claimed-intent recovery and before/after summary CAS. A stale run that died before seal may become interrupted only after other durable work is reconciled; after seal it becomes terminal only when every member is resolved and completeness succeeds.",
        "source": "current user directive; docs/reference/scheduler-contract.md#worker-death; docs/security/threat-model.md"
      },
      {
        "id": "C14",
        "statement": "No adapter call, trusted confirmation, filesystem inspection, ID allocation, clock callback, awaited work or arbitrary code runs inside a SQLite writer transaction. Persistence stores and validates records but neither authorizes dispatch nor selects eligibility, claim, Domain transition or reliable-loop operation. Dispatcher orchestration coordinates application owners and ports without embedding authorization, Domain or reliability decisions.",
        "source": "AGENTS.md; ARCHITECTURE.md; docs/reference/persistence-contract.md#transaction-and-repository-boundary"
      },
      {
        "id": "C15",
        "statement": "Trigger, run, reconciliation, member, decision, audit, summary, status and public library results use closed bounded metadata. They never persist or display Task body, prompt, source content, Project path, environment values, credentials, raw adapter payload/error, SQL, stack, arbitrary free text or reusable authority. Correlation and reason codes are bounded and redacted.",
        "source": "current user directive; docs/security/privacy-and-logging.md; docs/reference/observability-contract.md"
      },
      {
        "id": "C16",
        "statement": "Claims are limited to a library-only Manual Dispatcher and additive package export. ato.api/v1 grammar, output, exit codes and Phase 1 CLI behavior remain exact; ato.execution/v1 and Manual backend remain compatible. scripts/repo-utils.mjs changes only register the two approved dispatcher source files and migration 0007 in the canonical production inventory; test/cli-e2e.test.mjs changes only advance existing current-schema and backup-source-schema expectations from 6 to 7; and test/domain-architecture.test.mjs changes only register the exact approved dispatcher package exports and truthful library-only schema-v7 scaffold/status assertions while retaining productRuntimeImplemented=false, no scheduler/public Phase-2 CLI claim and the existing adapter boundary. None of those paths changes public grammar, fields, errors or behavior. No SchedulerBackend, scheduled trigger, supported platform, daemon, CLI, MCP, workspace, Git, completion-gate, network, release or deployment claim is inferred.",
        "source": "current user directive; docs/reference/cli-contract.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C17",
        "statement": "Fresh independent A0 precedes activation; fresh independent non-fail-fast A1 follows the stable complete material diff; every confirmed in-scope HIGH/MEDIUM or non-mechanical repair receives fresh independent A2. Parent disposition and reviewer report remain separate, findings and failed/superseded evidence are preserved, and no historical evidence is rewritten.",
        "source": "current user directive; harness-exec-plan schema v3"
      },
      {
        "id": "C18",
        "statement": "Use only task/ep-02c and its coordinator-created linked worktree, declared task paths, one terminal result commit, standing-authorized pathless manifest prune, exact-head receipts, ready, FF-only local integration and ordinary non-force origin/master push. Cleanup, reset, rebase, stash, force, PR, release and deployment are prohibited; EP-02D remains absent until the verified push terminal.",
        "source": "current user directive; AGENTS.md; docs/reference/local-agent-git-flow.md"
      }
    ],
    "authorization": {
      "allowed": [
        "Read and modify only declared repository task paths inside the coordinator-created EP-02C worktree.",
        "Append canonical schema v7, vocabulary-7 lineage, library dispatcher/application/persistence code, tests, documentation and package export needed for the approved Manual Dispatcher.",
        "Run frozen local targeted, migration, authorization, concurrency, failpoint, restart, package, documentation and complete offline validation with task-owned disposable artifacts.",
        "Use fresh independent A0, A1 and required A2 reviewers and record their reports without delegating implementation authorization or parent disposition.",
        "Create one task-owned result commit after completion-ready and terminal staged-inventory proof.",
        "After that commit, invoke only the standing-authorized pathless artifact prune and, after exact-head gates, ready and FF-only integration, the standing-authorized ordinary non-force origin/master push."
      ],
      "requires_reapproval": [
        "Any destructive or non-additive schema change, edit to migrations 0001-0006, historical vocabulary/grant/epoch reinterpretation, lifecycle-digest incompatibility, or backup/restore/doctor readability loss.",
        "Any new grantable action beyond dispatch.run, automatic authority expansion, implicit use of dispatch.run as execution authority, or change to confirmation ownership.",
        "Any public product CLI/API major decision, SchedulerBackend or scheduled trigger, Codex, Git, workspace, ProjectPolicy, CompletionBackend/gates, MCP, network, secret, other repository, D:\\quant, release or deployment behavior.",
        "Any changed Task eligibility/state semantics, adapter contract, external effect, data/public/security outcome, owner boundary or validation criterion outside this approval contract.",
        "Any successor-plan creation before verified push terminal, cleanup, or external write beyond the standing ordinary push."
      ],
      "prohibited": [
        "Reset, rebase, stash, force push, force cleanup, coordinator cleanup, evidence/history rewrite, another-repository mutation, PR, release or deployment.",
        "Treat trigger content, Task text, migration, readiness, an old decision, an in-memory candidate list, lease expiry, timeout, process death, adapter output or prior run as authorization or completion evidence.",
        "Call an adapter or trusted callback inside the core writer transaction; let Dispatcher or persistence reimplement authorization, Domain eligibility/transitions, reliable verification or Task completion.",
        "Claim before a durable reconciliation summary and membership seal, blindly replay ambiguous work, let a stale owner write, silently omit a sealed member, or publish a summary with incomplete or inconsistent durable rows.",
        "Implement or claim any non-goal capability."
      ],
      "persistence": {
        "required": true,
        "action": "Append canonical schema v7 and current writer/reader/backup/restore/doctor support for exact vocabulary-7 30-action capability lineage, lifecycle-digest provenance version 4 over the complete dispatcher projection, plus bounded Manual dispatcher trigger, run ownership/heartbeat, reconciliation, immutable membership, terminal member outcome and completeness-gated summary records while preserving every released schema prefix and byte-semantic digest versions 1 through 3.",
        "source": "current user directive; docs/reference/persistence-contract.md; docs/reference/reliability-protocol.md; docs/reference/scheduler-contract.md"
      }
    },
    "scope": {
      "task_paths": [
        {"path": ".gitattributes", "kind": "file"},
        {"path": "AGENTS.md", "kind": "file"},
        {"path": "ARCHITECTURE.md", "kind": "file"},
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "README.md", "kind": "file"},
        {"path": "docs/README.md", "kind": "file"},
        {"path": "docs/compatibility/v0.1.md", "kind": "file"},
        {"path": "docs/plans/proposal/EP-02C-reconcile-first-dispatcher.md", "kind": "file"},
        {"path": "docs/plans/proposals/EP-02C-reconcile-first-dispatcher.md", "kind": "file"},
        {"path": "docs/plans/active/EP-02C-reconcile-first-dispatcher.md", "kind": "file"},
        {"path": "docs/plans/completed/EP-02C-reconcile-first-dispatcher.md", "kind": "file"},
        {"path": "docs/plans/evidence/EP-02C", "kind": "directory"},
        {"path": "docs/reference/adapter-contracts.md", "kind": "file"},
        {"path": "docs/reference/authorization-contract.md", "kind": "file"},
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
        {"path": "migrations/0007-phase2-dispatcher.sql", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "scripts/repo-utils.mjs", "kind": "file"},
        {"path": "src/application.ts", "kind": "file"},
        {"path": "src/authorization.ts", "kind": "file"},
        {"path": "src/dispatcher-application.ts", "kind": "file"},
        {"path": "src/dispatcher.ts", "kind": "file"},
        {"path": "src/execution-application.ts", "kind": "file"},
        {"path": "src/execution-loop.ts", "kind": "file"},
        {"path": "src/index.ts", "kind": "file"},
        {"path": "src/persistence/application-repository.ts", "kind": "file"},
        {"path": "src/persistence/backup.ts", "kind": "file"},
        {"path": "src/persistence/index.ts", "kind": "file"},
        {"path": "src/persistence/migrations.ts", "kind": "file"},
        {"path": "test/application-atomicity.test.mjs", "kind": "file"},
        {"path": "test/application-service.test.mjs", "kind": "file"},
        {"path": "test/authorization.test.mjs", "kind": "file"},
        {"path": "test/configuration.test.mjs", "kind": "file"},
        {"path": "test/cli-e2e.test.mjs", "kind": "file"},
        {"path": "test/domain-architecture.test.mjs", "kind": "file"},
        {"path": "test/dispatcher-application.test.mjs", "kind": "file"},
        {"path": "test/dispatcher-recovery.test.mjs", "kind": "file"},
        {"path": "test/dispatcher-security.test.mjs", "kind": "file"},
        {"path": "test/execution-claim-foundation.test.mjs", "kind": "file"},
        {"path": "test/execution-claim-security.test.mjs", "kind": "file"},
        {"path": "test/execution-loop-authorization.test.mjs", "kind": "file"},
        {"path": "test/execution-loop-recovery.test.mjs", "kind": "file"},
        {"path": "test/execution-loop-security.test.mjs", "kind": "file"},
        {"path": "test/persistence-backup-restore.test.mjs", "kind": "file"},
        {"path": "test/persistence-doctor.test.mjs", "kind": "file"},
        {"path": "test/persistence-repository.test.mjs", "kind": "file"},
        {"path": "test/persistence-schema-migrations.test.mjs", "kind": "file"},
        {"path": "test/persistence-smoke.test.mjs", "kind": "file"},
        {"path": "test/persistence-test-helpers.mjs", "kind": "file"},
        {"path": "test/scaffold.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {"id": "M1", "outcome": "Establish exact predecessor/base evidence, a fresh independently accepted schema-v3 approval contract, and truthful current ownership/status contracts for EP-02C.", "validation_ids": ["V1", "V14"]},
      {"id": "M2", "outcome": "Append schema v7 and explicit vocabulary-7 capability upgrade with strict historical migration, authorization, backup, restore and doctor compatibility.", "validation_ids": ["V2", "V3"]},
      {"id": "M3", "outcome": "Implement typed Manual trigger ingress, durable run creation, ownership/heartbeat/takeover and reconcile-first ordering with bounded durable evidence.", "validation_ids": ["V4", "V5", "V6"]},
      {"id": "M4", "outcome": "Implement atomic finite membership sealing, every terminal member outcome, claim/start-intent binding, competing-worker recovery and completeness-gated summaries.", "validation_ids": ["V7", "V8", "V9", "V10", "V11", "V12"]},
      {"id": "M5", "outcome": "Close security, redaction, package/source compatibility and truthful documentation without public Phase 2 CLI or adjacent Phase 3 capability.", "validation_ids": ["V13", "V14", "V15"]},
      {"id": "M6", "outcome": "Obtain fresh independent stable-diff audit and required closure review, persist terminal validation evidence, and reach a task-owned completion-ready result with EP-02D absent.", "validation_ids": ["V16"]}
    ],
    "validations": [
      {"id": "V1", "type": "manual", "target": "Predecessor, chain, base, scope and activation readiness", "criterion": "terminal-resolve uniquely identifies EP-02B result commit 544bf159f5dfe3517ec7d2535894422888c8a7e9; current base fcbd537bfcc0ba41f037031790a3f487c05e7378 is its clean pushed descendant with only the verified checksum-contract repair; Git-flow and ExecPlan traces report no reservation/base/scope/dirty error; fresh independent A0 reproduces the exact approval digest and reviewed base and reports no finding before activation or after any approval revision."},
      {"id": "V2", "type": "automated", "target": "Additive schema-v7 identity, lifecycle digest and historical persistence compatibility", "criterion": "Canonical migration 0007 has one frozen LF checksum and additive dispatcher/vocabulary/digest-provenance allocation only; 0001-0006 bytes and checksums are unchanged; fresh initialization and every shipped prefix upgrade through v7 after verified backup; migration failpoints roll back and create no authority, dispatcher or digest-provenance row; current decoder rejects missing, extra, cross-table duplicate, wrong-owner, unknown-enum, impossible-count and relation corruption. Digest versions 1/2/3 retain their exact historical projections; every new lifecycle handoff records version 4 whose projection includes full vocabulary-7 and dispatcher state; dispatcher-state drift invalidates a v4 handoff; restart, backup verification, restore, recovery and doctor select the recorded projection and preserve every historical prefix and current dispatcher record exactly."},
      {"id": "V3", "type": "automated", "target": "Explicit complete vocabulary-7 capability epochs without migration-time authority", "criterion": "Fresh schema v7, migrated v6, bootstrap, adoption and vocabulary-6 renewal expose zero dispatch.run grant. Only fresh confirmed current-identity 6-to-7 upgrade appends one vocabulary-7 epoch with exactly thirty fresh origin grants at one lifetime and exact 23 legacy + 6 v6 + 1 v7 physical ownership/linkage; vocabulary-7 renewal recreates exactly the same thirty-action inventory in a new contiguous epoch. Global IDs, action-set digest, restart/readback and every physical relation are exact; all upgrade/renewal failpoints are all-or-none; stale, replayed, wrong-actor/root, revoked, expired, delegated-scope and missing-confirmation cases perform no dispatcher work or unauthorized write."},
      {"id": "V4", "type": "automated", "target": "Manual trigger ingress and run-creation atomicity", "criterion": "A closed valid Manual trigger with current dispatch.run authority creates exactly one bounded observation, final allow decision/audit and starting owned run with terminal readback in one transaction; every separate valid invocation creates its own run; exact request replay is idempotent or rejected without duplication; malformed ingress touches no trusted provider/state; denial records only one unattached bounded observation and decision with no run, candidate, claim, intent, Task mutation or adapter call."},
      {"id": "V5", "type": "automated", "target": "Run ownership, bounded heartbeat, expiry and stale-owner fencing", "criterion": "Initial duration rejects every non-integer, 29 and 3601 value and accepts exact 30/3600-second boundaries; owner comes only from trusted ingress and competing owners have one CAS winner. Heartbeat requires exact run/owner/revision/status, trusted now strictly after the prior heartbeat, no duration input, and stores expiry=now+immutable duration only when that expiry advances; equal/backward/non-forward time and old-expiry banking reject without write. Takeover rejects every now before expiry, is first eligible at now=expiry, reauthorizes dispatch.run, increments owner/run revisions once and resets heartbeat/expiry from trusted now; every late old-owner reconciliation/member/summary write is rejected across restart and failpoints."},
      {"id": "V6", "type": "automated", "target": "Reconcile-first ordering and complete durable reconciliation evidence", "criterion": "Seeded pending/executing/verified-not-finalized/ambiguous intents, expired leases and stale pre-seal/post-seal runs are enumerated from durable state, routed through existing current-authority reliable/claim owners and assigned bounded outcomes before a reconciliation summary commits; failpoints at every phase and process restart never seal or claim before that summary, never replay ambiguous effects, never skip an item through an in-memory flag, and block only affected resources while preserving independent candidates."},
      {"id": "V7", "type": "automated", "target": "Atomic complete finite candidate membership", "criterion": "After reconciliation only, one transaction applies the unchanged Domain eligibility predicate, deterministic ordering and current Project/Task revisions to seal expected count plus exactly one distinct contiguous pending row per eligible Task, including an explicit zero-member seal; crash before commit leaves no seal/member/candidate work, crash after commit reopens the identical immutable rows, and no later query or SQL update can add, remove, reorder or replace membership."},
      {"id": "V8", "type": "automated", "target": "Per-member terminal outcome and claim/start-intent atomicity", "criterion": "Every sealed member transitions once from pending to exactly one finite terminal outcome under full run-owner/member CAS. A claimed outcome atomically includes execution sequence/fence/attempt, ready-to-running Domain state, current execution.claim and execution.start decisions, a complete prepared start intent and bound execution/intent IDs before any adapter call; each non-claim outcome is truthful and atomic with applicable decision/audit/Domain evidence; failpoints leave either the complete unit or the original pending row."},
      {"id": "V9", "type": "automated", "target": "Competing Manual dispatchers and overlapping candidate snapshots", "criterion": "Two or more authorized runs may seal overlapping ready Tasks, but each Task has exactly one successful execution claim/fence and prepared start intent; all competing rows terminalize as already_claimed, ineligible_at_cas, authorization_denied, policy_deferred, resource_deferred, reconciliation_required or failed as applicable; no duplicate Manual effect or missing row occurs under concurrent writers and response loss."},
      {"id": "V10", "type": "automated", "target": "Worker death, run takeover and pending-member recovery", "criterion": "Restart after every run, reconciliation, seal, member, claim/intent and adapter-response checkpoint permits one higher-revision owner to enumerate the immutable sealed rows, reconcile bound executions/intents/receipts and terminalize every pending member without re-querying eligibility; pre-seal death permits no candidate work; post-seal death cannot mark interrupted or publish summary until every row is terminal; old-owner late writes and old-fence adapter results are rejected."},
      {"id": "V11", "type": "automated", "target": "Durable summary completeness and terminal run CAS", "criterion": "Summary counts and bounded reason accounting are derived only from durable rows and publish with terminal status in one current-owner/revision CAS exactly when expected count, total/distinct Task count, contiguous ordinals, membership revisions, terminal lifecycles and claimed execution/intent bindings all match. Missing, duplicate, noncontiguous, stale, cross-run, pending or corrupted rows leave summary absent and cannot report completed, partial or interrupted."},
      {"id": "V12", "type": "automated", "target": "End-to-end library Manual dispatch and reliable-loop composition", "criterion": "From fresh and migrated runtimes, an explicit authorized Manual run reconciles old work, seals all ready Tasks, atomically claims/prepares each permitted member, invokes the real local Manual backend only after commit through the existing reliable loop, reopens durable run/member/intent/turn state after restart, and produces a complete summary; turn_succeeded still leaves Task running until separately authorized confirmed completion acceptance, and no public CLI or scheduler surface is used."},
      {"id": "V13", "type": "automated", "target": "Security negatives, bounded observability and redaction", "criterion": "Malformed/extra/accessor/proxy/oversized/path/prompt/credential/SQL/stack-shaped trigger and state inputs fail before effect; actor/root/grant/revision/owner/fence substitutions cannot write; persisted and returned trigger/run/reconciliation/member/summary/audit material contains only closed bounded identifiers, counts and codes and never Task body, Project path, prompt, environment, credential, raw adapter payload/error, SQL, stack or arbitrary text."},
      {"id": "V14", "type": "manual", "target": "Architecture, public compatibility and truthful capability documentation", "criterion": "Authoritative owners and package status describe exactly schema-v7 library Manual dispatch with one explicit trigger and no SchedulerBackend; dispatcher coordinates application/reliable owners without copying their rules; ato.api/v1 grammar/output/exit codes and ato.execution/v1 are unchanged; docs links resolve; compatibility evidence claims no scheduler cadence, daemon, CLI Phase 2 surface, MCP, Codex/Git/workspace, completion gates, release or platform support."},
      {"id": "V15", "type": "automated", "target": "Impact-selected targeted, full offline, package and SQLite gates", "criterion": "At the accepted material state, targeted dispatcher/authorization/migration/concurrency/restart/security suites and every frozen offline route pass: lint, strict typecheck/build, complete discovered tests, docs, zero production dependencies, packed isolated consumer/export/installed parity/uninstall, real Windows SQLite feasibility and artifact hygiene with no surviving task artifact; Codex remains blocked/unclaimed and no network repair is used."},
      {"id": "V16", "type": "manual", "target": "Independent implementation audit and terminal evidence readiness", "criterion": "Fresh independent non-fail-fast A1 reviews the stable complete material diff and parent disposition; every confirmed finding is routed by schema, all required repairs have current targeted/full evidence and fresh independent closure-safe A2; trace reports no schema, base, scope, state-freshness, outside_scope, overlap or pre-existing-dirty error; every other milestone and validation is terminal, final summary is non-empty, final staged inventory is task-owned, historical evidence is unchanged, and no EP-02D plan or implementation path exists in the task diff."}
    ],
    "risks": [
      {"id": "R1", "risk": "An additive migration or vocabulary partition could silently reinterpret historical authority or make old runtime generations unreadable."},
      {"id": "R2", "risk": "A process crash between claim, member outcome and start-intent persistence could leave a running Task without recoverable dispatch evidence."},
      {"id": "R3", "risk": "In-memory candidate enumeration or early-exit fan-out could silently omit a ready Task or make a summary unverifiable after worker death."},
      {"id": "R4", "risk": "Expired run or execution ownership could permit stale workers or fences to write late, replay effects or publish a false terminal summary."},
      {"id": "R5", "risk": "Reconciliation might confuse absence, timeout, denial or ambiguous external state with success and then admit unsafe new work."},
      {"id": "R6", "risk": "Summary counts could be derived from incomplete, duplicate, cross-revision or corrupted member rows."},
      {"id": "R7", "risk": "Dispatcher records or errors could leak Task content, Project paths, prompts, credentials or raw adapter diagnostics."},
      {"id": "R8", "risk": "Dispatcher orchestration could absorb application/Domain/reliability ownership or call an adapter while holding a SQLite writer transaction."},
      {"id": "R9", "risk": "Library Manual dispatch could be overstated as a scheduler, daemon, product CLI, platform-supported or later-phase integration capability."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {"id": "D1", "statement": "Use one canonical additive schema-v7 migration. A vocabulary-7 epoch owns a complete thirty-action origin inventory with an exact 23 legacy + 6 v6 + 1 v7 physical partition and explicit v7 linkage for both earlier owners; decode grant IDs globally and validate every epoch inventory. Allocate one immutable lifecycle-digest-v7 provenance owner for version 4, whose projection is version 3 plus all vocabulary-7 and dispatcher records, while versions 1/2/3 retain exact historical projection semantics.", "rationale": "Existing closed checks and historical bytes remain immutable, new authority is explicit, backup/restore identity includes current dispatcher state, and every partition/projection is corruption-detectable."},
      {"id": "D2", "statement": "Implement a typed DispatcherApplicationService as the sole transactional owner of trigger decisions, runs, ownership, reconciliation summaries, membership, member outcome and summary CAS; implement ManualDispatcherService as the orchestration layer that calls application and reliable-execution owners.", "rationale": "This preserves application authorization/Domain ownership and keeps dispatcher ordering separate from persistence and adapter semantics."},
      {"id": "D3", "statement": "Treat every valid Manual invocation as a distinct observation/run while making reused trusted request identities fail closed or return their exact persisted result; do not introduce a scheduled tuple, scheduler port or time-window deduplication.", "rationale": "This is the narrow trigger behavior explicitly approved for EP-02C."},
      {"id": "D4", "statement": "Use run leases distinct from execution leases/fences: one immutable safe-integer duration of 30..3600 seconds per run, trusted-ingress owner identity, canonical expiry=trusted now+duration, strictly forward heartbeat renewal from trusted now with no duration input or banking, and first-eligible takeover at now>=expiry. Reauthorize dispatch.run for takeover and bind every phase mutation to current run owner/revision/status.", "rationale": "Dispatcher process ownership and Task execution ownership have different resources, and the exact time policy makes recovery and stale-writer fencing binary."},
      {"id": "D5", "statement": "Reconcile existing execution evidence and stale runs through durable identifiers and current authorization before sealing candidates; persist a complete bounded reconciliation item set and summary, and never cache an in-memory clean result.", "rationale": "Restart and competing workers must recover from records, not process history."},
      {"id": "D6", "statement": "Seal candidates in deterministic Task-ID order under one writer transaction using the unchanged Domain eligibility predicate and exact Project/Task revisions; represent the empty set explicitly.", "rationale": "This produces finite immutable membership that can be recovered and completeness-checked."},
      {"id": "D7", "statement": "Refactor the existing execution application/reliable prepare internals only as needed so a dispatcher successful member transaction commits claim, ready-to-running transition, execution attempt/fence, both current execution authorizations, complete start intent and claimed member outcome before returning; execute the Manual adapter only afterward.", "rationale": "The claimed row and recoverable operation cannot split across a crash boundary, while external effects remain outside SQLite."},
      {"id": "D8", "statement": "For each claimed prepared intent, call the existing reliable reconcile/processing path with deterministic run/member-bound semantic identities; preserve its observation, verification, waiting, ambiguity, old-fence and completion rules unchanged.", "rationale": "EP-02C composes the verified EP-02B loop instead of creating a second effect protocol."},
      {"id": "D9", "statement": "Recover a stale sealed run by taking its ownership, enumerating its immutable rows and reconciling bound executions/intents before resolving pending rows; never repeat its eligibility query. Recover a pre-seal run only after its other durable work is reconciled.", "rationale": "Membership and external work remain exact across worker death."},
      {"id": "D10", "statement": "Derive summaries inside the terminal CAS from current durable rows. Use completed only when all work is complete without deferred/failure outcomes, partial when a complete accounting contains bounded nonfatal denial/defer/reconciliation outcomes, failed only for a durably accounted run failure, and interrupted only for recovered stale ownership after required completeness.", "rationale": "Run status becomes a projection of verifiable records rather than a caller assertion."},
      {"id": "D11", "statement": "Expose only an additive library dispatcher surface and bounded views. Keep the Phase 1 CLI parser/router/public code table byte-compatible and leave product Manual commands to EP-02D compatibility analysis.", "rationale": "This closes EP-02C without guessing the public product major version."},
      {"id": "D12", "statement": "Use the frozen coordinator task/manifest, schema-v3 A0/A1/A2 lifecycle, one result commit, standing-authorized current-head prune, every exact-head gate, ready, FF-only local integration and ordinary push; never call cleanup.", "rationale": "Repository lifecycle and product implementation evidence remain independently auditable."}
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep the plan proposal and implementation paused. Repair approval/source/scope gaps, archive superseded A0 attempts, and obtain a fresh independent A0 before moving the same plan to active."},
      {"id": "M2", "recovery": "Migration and capability-upgrade failpoints must roll back before publication. Preserve migrations 0001-0006, the last valid v6 runtime and backup; do not mark or repair a partial v7 history manually."},
      {"id": "M3", "recovery": "On trigger/run/reconciliation failure, reopen the exact persisted run and current ownership revision; deny stale owners, resume from durable items and summary state, and never advance to seal from an in-memory checkpoint."},
      {"id": "M4", "recovery": "Before seal commit there is no candidate work. After seal, reacquire expired run ownership, enumerate immutable rows, reconcile bound execution evidence and CAS each pending row; leave inconsistent rows and summaries absent for explicit typed recovery rather than rewriting them."},
      {"id": "M5", "recovery": "Remove only task-owned implementation that violates the approved public/security boundary, preserve generated diagnostics for evidence, and rerun affected package/redaction/docs routes before any current review."},
      {"id": "M6", "recovery": "Keep the plan active and task editable on any audit, validation, scope or staged-inventory failure. Repair only in-scope findings, renew material evidence/A2 as required, and do not ready, integrate, push or create EP-02D until all terminal conditions hold."}
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
      {"id": "R1", "mitigation": "Append-only schema/vocabulary partitions, frozen checksum/EOL, exact physical-owner decoder, every-prefix upgrade and backup/restore/doctor/corruption tests.", "recovery": "Reject migration/open atomically and preserve the last valid generation; never rewrite historical migration or authority rows."},
      {"id": "R2", "mitigation": "Commit claimed member, execution claim and complete prepared start intent in one application transaction before adapter invocation, with failpoints after every stage.", "recovery": "A failed transaction leaves the member pending and Task ready; a committed unit is reopened by exact execution/intent IDs and processed idempotently."},
      {"id": "R3", "mitigation": "Atomic immutable finite membership with expected count, contiguous ordinals, row revisions and no candidate work before commit; summary requires every row terminal.", "recovery": "Resume from sealed rows, not a new query; preserve unresolved rows and withhold the summary on any mismatch."},
      {"id": "R4", "mitigation": "Separate bounded run owner lease/revision CAS plus existing per-Task execution fence, current authorization and late-write negative tests at every mutation.", "recovery": "A higher owner revision fences the stale process; re-read durable execution evidence and reject old-owner/fence results without inferred rollback."},
      {"id": "R5", "mitigation": "Use the existing reliable observation/verification/finalization owner and persist explicit reconciliation_required or failed evidence instead of guessing.", "recovery": "Block only the affected resource, retain ambiguity in durable records and retry solely through current authorized reconciliation."},
      {"id": "R6", "mitigation": "Compute terminal counts inside the same current-owner/revision transaction that verifies expected/actual/distinct/ordinal/revision/lifecycle/binding invariants.", "recovery": "Leave summary absent and return typed integrity failure; do not edit rows or publish a partial success claim."},
      {"id": "R7", "mitigation": "Closed parsers and enums, bounded identifiers/codes/counts, canonical sanitized audit details, malicious-shape and no-reflection tests.", "recovery": "Reject before trusted ingress or persistence; preserve only bounded diagnostic codes and remove no evidence through cleanup."},
      {"id": "R8", "mitigation": "Maintain Dispatcher/Application/Persistence/Domain dependency direction and prohibit callbacks/effects/ID allocation inside writer transactions; audit source and failpoints.", "recovery": "Stop and refactor to the authoritative owner before activation/completion; treat owner conflict as a material audit finding."},
      {"id": "R9", "mitigation": "Keep CLI unchanged, no scheduler adapter/dependency, exact package/status/docs language and compatibility matrix evidence.", "recovery": "Remove unsupported claim or adjacent code, rerun docs/package/full gates, and require reapproval for any real scope expansion."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "544bf159f5dfe3517ec7d2535894422888c8a7e9",
      "current_material_base": "fcbd537bfcc0ba41f037031790a3f487c05e7378",
      "base_transitions": [
        {
          "from_base": "544bf159f5dfe3517ec7d2535894422888c8a7e9",
          "to_base": "fcbd537bfcc0ba41f037031790a3f487c05e7378",
          "relation": "ancestor",
          "assessment": "approval_unchanged",
          "assessed_by": "/root",
          "assessed_at": "2026-08-31 03:00:54+08:00",
          "evidence": "Creation-stage terminal-resolve and chain-check uniquely bound EP-02B at 544bf159f5dfe3517ec7d2535894422888c8a7e9. Read-only base-diff to fcbd537bfcc0ba41f037031790a3f487c05e7378 proved an ancestor relation with exactly docs/reference/persistence-contract.md changed. That independently reviewed and pushed one-line correction only aligns the schema-v6 checksum contract with released migration bytes, registry, tests and immutable EP-02B evidence; it changes no EP-02C goal, authorization, schema-v7 outcome, scope, public/security boundary or validation criterion."
        }
      ]
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-08-31 05:31:04+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-08-31 05:31:04+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-08-31 05:31:04+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-08-31 05:31:04+08:00"},
      {"id": "M5", "status": "complete", "updated_at": "2026-08-31 05:31:04+08:00"},
      {"id": "M6", "status": "complete", "updated_at": "2026-08-31 06:25:35+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Schema-v3 state/trace, terminal/base-chain evidence, coordinator state and fresh independent A0",
        "evidence": "Unique EP-02B terminal 544bf159f5dfe3517ec7d2535894422888c8a7e9, accepted checksum-only descendant base fcbd537bfcc0ba41f037031790a3f487c05e7378, exact approval digest, fifth fresh A0 and current task inventory reproduce with no base, scope, overlap or pre-existing-dirty error.",
        "state_id": "approval-sha256:2F831ED1E9AC24204084F80938FCA30273314CA611E6F32F76F59AA760E70632"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Migration registry, every-prefix upgrade, historical digest, corruption, backup/restore/recovery and doctor tests",
        "evidence": "Canonical LF migration 0007 SHA-256 7AB43795AE91C9825E6851393C690144246AFCD14D00C916D978AA708F387987 is additive and zero-allocation; fresh and every shipped prefix reach v7 after verified backup; digest versions 1-3 retain exact projections, version 4 binds vocabulary-7 plus dispatcher state, and typed corruption/restart/backup/restore/doctor routes pass.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Vocabulary-7 upgrade/renewal, partition, failpoint and negative authorization tests",
        "evidence": "Migration/bootstrap/vocabulary-6 renewal create no dispatch.run authority; one separately confirmed 6-to-7 upgrade and v7 renewal each create an exact globally unique 30-action epoch with 23 linked legacy + 6 linked v6 + 1 physical v7 grant, while all 30 grant-stage and request/epoch/decision/audit failpoints are atomic.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Closed Manual trigger, denial, replay, concurrent identity and transaction failpoint tests",
        "evidence": "Valid trigger commits one hashed-idempotency observation, final decision/audit and allowed starting run atomically; exact replay is stable, tuple drift conflicts, denial remains unattached, malformed input touches no trusted ingress/state and response-loss replay creates no duplicate run.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Run lease boundary, heartbeat, owner-CAS, exact-expiry takeover and stale-owner tests",
        "evidence": "29/noninteger/3601 durations reject and exact 30/3600 accept; bounded forward-only reconcile/member checkpoints carry the newest run revision and let one owner finish after more than a complete minimum or maximum lease window without banking; takeover first succeeds at expiry with one higher owner/run revision, while expired same-owner and every late old-owner tuple fail without write.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Durable reconciliation inventory, stale-run/intent/receipt/lease recovery, response-loss and restart tests",
        "evidence": "Durable unfinished work is enumerated and assigned a closed disposition before one complete reconciliation summary; existing Manual turns avoid duplicate effects, backend-journal ambiguity blocks only affected resources, and no restart/failpoint can seal before the summary.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Candidate seal atomicity, deterministic membership, immutability and post-commit loss tests",
        "evidence": "Reconciled runs seal expected count plus one distinct contiguous deterministic member per eligible Task, including empty membership; precommit failure leaves no seal, postcommit restart reads the identical rows, and SQLite guards reject member addition/update/deletion.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Member CAS, authorization/policy/ineligibility outcomes and injected claim/start-intent rollback tests",
        "evidence": "Every member resolves once to a closed outcome; claimed rows atomically include sequence/fence/attempt, ready-to-running Domain state, current claim/start decisions and a complete prepared start intent before effect. A fully bound start denial atomically commits one exact no-execution request/decision/audit triple and denied member with no Task transition, intent or effect; response-loss replay and restart do not duplicate it, while late identity failure restores the original pending row.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Overlapping sealed-run and competing dispatcher tests",
        "evidence": "Overlapping runs produce exactly one Task claim/fence/prepared intent and one durable already-claimed loser with no duplicate Manual effect or omitted member; revoked start authority and post-seal Task/Project changes resolve through bounded authorization/ineligible/policy outcomes.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "Six durable checkpoint process restarts, run takeover and pending-member recovery tests",
        "evidence": "Starting, reconciling, reconciled, sealed, claimed and post-effect restarts are resumed by one higher-revision owner from durable rows; stale runs and claimed intents reconcile before new candidates, and old owner/fence writes cannot publish a result.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "Summary completeness CAS plus relational and typed-corruption matrix",
        "evidence": "Pending, missing, extra, wrong-owner, unknown-code/status, impossible-count, broken member-intent, unfinished claimed-intent, and missing/unknown/mismatched member-denial lineage withholds or corrupts the summary; only exact terminal membership, exact required denial triples and finalized claimed intents atomically publish one count-complete terminal summary.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V12",
        "status": "passed",
        "method": "Fresh/migrated library Manual dispatcher end-to-end, restart and package export tests",
        "evidence": "The explicit Manual run composes current application/claim/reliable owners, invokes the real local backend only after prepared commit, reopens run/member/intent/turn state, and completes one durable summary; turn_succeeded still requires separate confirmed completion and no CLI or scheduler path is used.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V13",
        "status": "passed",
        "method": "Malformed/hostile ingress, identity/authorization substitution, closed-code corruption and redaction tests",
        "evidence": "Extra/accessor/proxy/oversized/path/prompt/credential/SQL/stack-shaped values stop before effect; raw idempotency text is absent, arbitrary codes are rejected, and dispatcher state/results contain only bounded IDs/counts/codes without Task body, Project path, prompt, environment, credential, adapter payload/error, SQL or stack text.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V14",
        "status": "passed",
        "method": "Architecture/contract/compatibility review plus exact documentation link gate",
        "evidence": "Authoritative owners and package status describe only schema-v7 library explicit-Manual dispatch; dispatcher composes rather than copies application/reliable rules; ato.api/v1 and ato.execution/v1 remain unchanged; docs pass 84/251/21/0 and retain every scheduler/public-runtime/MCP/Codex/Git/workspace/gate/release/support non-claim.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V15",
        "status": "passed",
        "method": "Canonical frozen pnpm verify:offline plus focused dispatcher selections",
        "evidence": "Post-repair migration/dispatcher route passed 37/37 and the final dispatcher-only rerun passed 17/17. Full route passed lint 181/27, strict typecheck/build, 401/401 tests with artifact hygiene 76-to-76, docs 84/251/21/0, zero production dependencies, 114-file packed consumer/export/persistence/CLI parity/uninstall, Windows SQLite with zero survivor and Codex blocked/unclaimed; no network repair was used.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      },
      {
        "id": "V16",
        "status": "passed",
        "method": "Fresh independent A1/A2, schema-v3 trace, terminal scope and staged-inventory review",
        "evidence": "Fresh independent A1 preserved two confirmed MEDIUM findings and the parent routed both to A2. The exact repaired state passed current targeted and full evidence; fresh independent A2 bound git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4, closed both IDs, found no adjacent defect and was closure-safe. Current trace reports errors=[], warnings=[], outside_scope=[], overlap=[] and pre_existing_dirty=[] with exact approval/base/state identities. Every other milestone and validation is terminal, historical completed plans and released evidence remain outside the diff, no EP-02D plan or implementation path exists, and the terminal result workflow admits only the complete task-owned staged inventory before commit.",
        "state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/ep02a_a0",
        "independence": "Fresh independent read-only A0 attempt 5. The reviewer did not draft or implement EP-02C and rebuilt the assessment from the current proposal, guidance, authoritative contracts, implementation, validation inventory, Git facts, independent canonicalization, and a fresh trace. Archived attempts were consulted only to verify preserved lifecycle history and closure identifiers, not adopted as conclusions. No file, Git, ExecPlan, coordinator, permission, network, test-artifact, or external-state mutation was performed.",
        "scope": "Reviewed the complete schema-v3 EP-02C proposal; AGENTS.md, ARCHITECTURE.md, docs/plans/README.md and repository documentation guidance; PLAN-SCHEMA, A0-AUDIT and Tier-2 persistence guidance; authorization, Domain, persistence, reliability, scheduler, adapter, versioning, observability, CLI, toolchain, validation, privacy, threat-model, completion/workspace, repository-governance, contract-ownership and local Git-flow contracts; predecessor/base-transition facts; every approval/execution-contract field; current implementation and validation inventory; all application-state digest selectors and remaining production owners; task-scope sufficiency; and current closure of F-EP02C-A0-001 through F-EP02C-A0-007.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-31 03:52:22+08:00",
        "approval_sha256": "2F831ED1E9AC24204084F80938FCA30273314CA611E6F32F76F59AA760E70632",
        "reviewed_material_base": "544bf159f5dfe3517ec7d2535894422888c8a7e9",
        "evidence": "Fresh trace returned schema v3 proposal, ok=true, errors=[], warnings=[], base_transition_blocked=false, approval_contract_bytes=35800, digest 2F831ED1E9AC24204084F80938FCA30273314CA611E6F32F76F59AA760E70632, approval base 544bf159f5dfe3517ec7d2535894422888c8a7e9, current base/HEAD fcbd537bfcc0ba41f037031790a3f487c05e7378, outside_scope/overlap/pre_existing_dirty=[], and next_action=run_a0. Independent compact sorted-key UTF-8 canonicalization reproduced exactly 35800 bytes and the same digest; all 59 task paths are unique. terminal-resolve uniquely returned EP-02B commit 544bf159f5dfe3517ec7d2535894422888c8a7e9. Git proved it is an ancestor of fcbd537bfcc0ba41f037031790a3f487c05e7378; the intervening diff is exactly the one-line persistence-contract checksum correction, and migration 0006 independently hashes to 3D27258B3C9FB4B11B56B989CA2F341CB4DC68C96168D864D3763D93A4799153. Current scope contains AGENTS.md, CHANGELOG.md and docs/reference/contract-ownership.md; scripts/repo-utils.mjs and test/cli-e2e.test.mjs with inventory/schema-only limits; test/domain-architecture.test.mjs with exact library-export/status limits; and src/persistence/backup.ts exactly once. Current C3 constrains backup cloned-provenance verification to the lifecycle-authorization-recorded projection, preserving digest versions 1/2/3 byte-semantically, selecting version 4 only for version-4 authorization, and leaving manifest shape, public backup/restore behavior, permissions and adjacent persistence semantics unchanged. Direct source inspection identified the prior explicit clone selector in src/persistence/backup.ts and confirmed every application-state digest/version selector resides in scoped src/application.ts, src/persistence/application-repository.ts, src/persistence/backup.ts or scoped persistence tests; src/persistence/store.ts and doctor.ts select schema/readers generically, while cli-api, execution-port and Manual-backend owners require no contract change. Same-class scans confirmed all exact migration, schema-version, action-count, package-export, scaffold-status and production-inventory assertions requiring change are task-owned; generic repo-utils, store, doctor, CLI and unchanged port/adapter tests do not require edits. The current repository remains schema 6 with 19+4+6=29 actions, no dispatch.run, no dispatcher source, no migration 0007 and no EP-02D path. Current approval independently closes F-001 through F-007: complete vocabulary-7 upgrade/renewal epochs with exactly 30 fresh grants and 23+6+1 physical ownership/linkage; one digest-version-4 provenance owner over exact v3 plus vocabulary-7 and every dispatcher record while retaining v1/v2/v3 readers; immutable 30..3600-second trusted-now run leases with no-input, non-banking, strictly-forward heartbeat and takeover at now>=expiry; and complete task ownership for all mechanically required status, inventory, export, schema and backup-selector owners. Goal/non-goals, ordered chain, umbrella refinement, authorization separation, additive migration, writer/reader/recovery ownership, reconcile-summary-seal ordering, complete membership/member CAS, claim plus execution.claim/execution.start plus prepared-start-intent atomicity, stale-owner/fence recovery, summary completeness, bounded redaction, unchanged ato.execution/v1 and ato.api/v1, and the no-scheduler/no-public-runtime/no-adjacent-phase boundary are coherent and have binary material validations and recovery controls. No product tests were run because this A0 was required to remain read-only and artifact-free. Non-fail-fast result: no_findings.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/ep02a_a1",
        "independence": "Fresh independent non-implementer A1. The reviewer reconstructed the result from current repository evidence, did not adopt the parent agent's conclusions, and performed no file, Git, ExecPlan, coordinator, permission, network, test-artifact, or external-state mutation.",
        "scope": "Reviewed EP-02C at material base and HEAD fcbd537bfcc0ba41f037031790a3f487c05e7378 and exact worktree material state git-sha1:6ce5b6f74eff520403a18f3ebe5d1a441a349667: repository guidance, schema-v3 A1 and Tier-2 persistence guidance, active plan and evidence, complete task diff, migration 0007, authorization/application/dispatcher/reliable-loop/persistence implementation, relevant tests, and every directly authoritative contract.",
        "reviewed_at": "2026-08-31 05:48:38+08:00",
        "evidence": "Fresh independent trace returned ok=true, errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], approval digest 2F831ED1E9AC24204084F80938FCA30273314CA611E6F32F76F59AA760E70632, base/HEAD fcbd537bfcc0ba41f037031790a3f487c05e7378 and exact state git-sha1:6ce5b6f74eff520403a18f3ebe5d1a441a349667. Index was empty, git diff --check had no error, and migration 0007 independently reproduced 0F0421026A79D14FC26666917DC13BF186B480B06E1876B1C9C0CF5E06D5B3A9 with canonical LF identity. Non-fail-fast review found two MEDIUM implementation gaps and no additional non-speculative finding. The parent independently reproduced both against current source and authoritative contracts: fully-bound execution.start denial omits its deny request/decision/audit, and the orchestration loop never invokes the implemented heartbeat while long reconciliation/effect/fan-out work can cross expiry. Both findings are in scope, change the task diff and require fresh independent A2 after repair.",
        "reviewed_state_id": "git-sha1:6ce5b6f74eff520403a18f3ebe5d1a441a349667",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-EP02C-A1-001",
            "severity": "MEDIUM",
            "summary": "A fully bound execution.start denial terminalizes the dispatcher member without persisting the required denied request, decision and sanitized audit lineage.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Add one additive no-execution start-denial request/decision/audit lineage owned by the dispatcher application and included in the current decoder and digest-v4 projection. Commit it atomically with the authorization_denied member outcome without an execution attempt, Task transition or intent; prove restart, response-loss/replay, exact binding and corruption rejection.",
            "closure_evidence": "Repair is complete at git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4. Migration 0007 adds exactly the no-execution denial request/decision/audit tables and guards; the dispatcher application commits the exact triple with the denied member; decoder and digest-v4 include it. Response-loss replay, restart, exact binding, no Task/execution/intent/effect, three corruption classes, targeted 37/37 and 17/17, and full 401/401 evidence pass. Fresh independent A2 closure remains required.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02C-A1-002",
            "severity": "MEDIUM",
            "summary": "The Manual dispatcher never renews its run heartbeat while doing reconciliation or fan-out work, so a live worker can expire mid-run and fail to reach a terminal summary.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "CAS-renew and carry forward the current run heartbeat/revision at bounded reconciliation and per-member checkpoints surrounding potentially long reliable-loop work. Prove live same-owner completion across minimum and maximum lease boundaries while expired, stale and superseded owners remain fenced.",
            "closure_evidence": "Repair is complete at git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4. The Manual dispatcher performs forward-only CAS heartbeat checkpoints around every reconciliation resource and sealed-member reliable operation, carries the returned run revision, skips only non-forward live time, and refuses expiry. Deterministic 30/3600-second tests prove one owner completes beyond a full lease while existing exact-expiry takeover/stale-owner tests remain green; targeted 37/37 and 17/17 plus full 401/401 evidence pass. Fresh independent A2 closure remains required.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "/root/ep02a_a2",
        "independence": "Fresh independent read-only A2. The reviewer did not implement the repairs or rely on the parent’s conclusions, rebuilt closure from the frozen material state, and performed no file, Git, ExecPlan, coordinator, permission, network, test-artifact, or external-state mutation.",
        "scope": "Reviewed exact EP-02C repair state git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4 against A1 findings F-EP02C-A1-001 and F-EP02C-A1-002, including repository guidance, schema-v3 and Tier-2 audit guidance, active plan/A1 dispositions, complete task inventory and directly relevant diff, authoritative authorization/persistence/reliability/scheduler/security contracts, migration 0007, dispatcher application/orchestration, combined decoder/digest-v4 paths, and focused recovery/security/application tests. Direct adjacency review covered denial cardinality and binding, no-effect atomicity, response-loss/restart replay, terminal-summary gating, heartbeat trusted-time/CAS behavior, revision carry-forward, expiry/takeover fencing, package/CLI boundaries and redaction.",
        "reviewed_at": "2026-08-31 06:19:09+08:00",
        "evidence": "Fresh exec_plan trace returned ok=true, errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], approval digest 2F831ED1E9AC24204084F80938FCA30273314CA611E6F32F76F59AA760E70632, base/HEAD fcbd537bfcc0ba41f037031790a3f487c05e7378 and exact state git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4; V2-V15 bind that state and remaining blockers are M6/V16/A2/final summary. git diff --check produced no error. Independent file hashing reproduced migration 0007 SHA-256 7AB43795AE91C9825E6851393C690144246AFCD14D00C916D978AA708F387987. For F-001, migration 0007 defines closed, immutable no-execution denial request/decision/audit relations; the dispatcher application writes the exact triple and terminal member in one transaction, with terminal combined-state readback before commit. The decoder enforces 1:1 inventories, globally non-colliding identities, run/member/actor/action/Project revision/grant/reason/target/time equality, an unused proposed execution identity, absence of execution and intent effects, and exact denied-member equivalence. Digest version 4 includes all three relations. The real-store regression revokes execution.start, loses the post-commit response, proves Task remains ready with zero execution/intent/operation request, replays without duplication, closes/reopens the store, and replays again; independent physical-database corruption cases exercise missing audit, unknown reason and mismatched target through the production decoder. Terminal summary publication is additionally protected by the SQL member-denial anchor and mandatory typed terminal readback, so incomplete decision/audit lineage cannot commit through the sole writer. For F-002, heartbeatCheckpoint inspects the current durable run, rejects invalid time and now>=expiry, avoids a false write for non-forward live time, and otherwise calls the typed heartbeat with the freshly inspected owner/run/status revisions. The application heartbeat revalidates runtime identity and current dispatch.run authority, applies runFailure owner/revision/live-lease fencing, derives expiry from trusted now plus the immutable bounded duration, and performs the exact forward-only CAS. The orchestration loop places checkpoints before and after every reconciliation resource and before/after member claim and reliable-loop effect, then carries returned revisions into reconciliation commit, member claim and finalization. The deterministic real Manual-backend tests cover both 30-second and 3600-second leases, run longer than a full lease under ownerRevision=1, and require durable accepted heartbeat audit; application tests preserve non-forward rejection, exact-expiry takeover and stale old-owner rejection. Recorded targeted 37/37 and 17/17 plus full verify:offline 401/401 and package/SQLite/docs/boundary results were used only as corroborating context. No new directly adjacent defect was found; no_findings; closure-safe.",
        "reviewed_state_id": "git-sha1:b9455011a988d01ba544fbac8ac5d093d452b4d4",
        "parent_disposition": "complete",
        "closes": ["F-EP02C-A1-001", "F-EP02C-A1-002"],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-EP02C-A0-001", "F-EP02C-A0-002", "F-EP02C-A0-003", "F-EP02C-A0-004"],
        "disposition": "superseded",
        "reason": "Fresh independent Tier-2 A0 required three truthful current-status paths in task ownership, a complete 30-action vocabulary-7 epoch/renewal and 23+6+1 physical partition, lifecycle digest provenance version 4 over the dispatcher projection, and an exact 30..3600-second trusted-now run-lease policy. The parent confirmed all four MEDIUM contract gaps and revised only the approval contract before activation."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-EP02C-A0-005"],
        "disposition": "superseded",
        "reason": "Fresh independent Tier-2 A0 reproduced approval digest 780E8AED679D49ED4B4152280E0FC1181CAC427CC57F5D2EF128BEDA0BC62653 and confirmed the prior four closures, then found that the canonical production inventory owner and the real CLI E2E schema-version assertions were mechanically required by schema-v7 implementation but absent from task scope. The parent confirmed this MEDIUM contract gap and added only those two paths with their exact no-public-CLI-change limits before activation."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": ["F-EP02C-A0-006"],
        "disposition": "superseded",
        "reason": "Fresh independent Tier-2 A0 reproduced approval digest CFBC9D1F17FCC855AF5E531F9A000BF3BDE61FA0E0D87981FE30D402F140682A and confirmed F-EP02C-A0-001 through F-EP02C-A0-005 closed, then found that the exact package-root export and scaffold-status assertion was mechanically required by the approved library dispatcher export but absent from task scope. The parent confirmed this MEDIUM contract gap after a read-only scan of all same-class inventory/schema/status assertions and added only that test path with an exact library-only status limit before activation."
      },
      {
        "audit": "A0",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": ["F-EP02C-A0-007"],
        "disposition": "superseded",
        "reason": "Fresh independent Tier-2 A0 reproduced approval digest D470E74F67CF482C671E6A1600E0A658A16E7D93ECE1139ACA1A1FF330A4975E and confirmed F-EP02C-A0-001 through F-EP02C-A0-006 closed, then found that backup cloned-provenance verification had one explicit digest-version selector that could not preserve version 3 and validate version 4 without changing its production owner. The parent confirmed this MEDIUM contract gap, checked all application-state digest selector call sites, and added only src/persistence/backup.ts with an exact recorded-projection limit before activation."
      }
    ],
    "validation_attempts": [],
    "contract_revisions": [
      {
        "at": "2026-08-31 03:11:53+08:00",
        "summary": "Closed F-EP02C-A0-001 through F-EP02C-A0-004 by adding the three required status/ownership paths, freezing complete vocabulary-7 30-grant epochs and renewal with 23+6+1 physical ownership, adding lifecycle digest provenance version 4 over all dispatcher records while preserving versions 1-3, and defining the exact trusted 30..3600-second non-banking run-lease policy.",
        "previous_approval_sha256": "E959478285459F71142482BD2EC3B9BFD3DB94EDFB75AB025855F987F54B6214"
      },
      {
        "at": "2026-08-31 03:24:15+08:00",
        "summary": "Closed F-EP02C-A0-005 by adding exactly scripts/repo-utils.mjs and test/cli-e2e.test.mjs to task ownership, limiting the former to the two approved dispatcher source entries and migration 0007 inventory, and limiting the latter to current schema-v7 and backup source-schema-v7 expectations without any public CLI grammar, field, error or behavior change.",
        "previous_approval_sha256": "780E8AED679D49ED4B4152280E0FC1181CAC427CC57F5D2EF128BEDA0BC62653"
      },
      {
        "at": "2026-08-31 03:35:18+08:00",
        "summary": "Closed F-EP02C-A0-006 by adding exactly test/domain-architecture.test.mjs to task ownership and limiting it to the approved dispatcher package exports and truthful library-only schema-v7 scaffold/status assertions while preserving productRuntimeImplemented=false, no scheduler or public Phase-2 CLI claim and the existing adapter boundary. A parent read-only same-class scan confirmed every other current production inventory, schema-version and scaffold-status assertion is already task-owned.",
        "previous_approval_sha256": "CFBC9D1F17FCC855AF5E531F9A000BF3BDE61FA0E0D87981FE30D402F140682A"
      },
      {
        "at": "2026-08-31 03:43:35+08:00",
        "summary": "Closed F-EP02C-A0-007 by adding exactly src/persistence/backup.ts to task ownership and limiting its change to selecting the exact lifecycle-authorization-recorded digest projection during cloned-provenance verification, preserving digest versions 1, 2 and 3 byte-semantically and selecting version 4 only for version-4 authorization without changing manifest shape, public backup/restore behavior, permissions or adjacent persistence semantics.",
        "previous_approval_sha256": "D470E74F67CF482C671E6A1600E0A658A16E7D93ECE1139ACA1A1FF330A4975E"
      }
    ],
    "final_summary": "EP-02C closes the library-only reconcile-first Manual Dispatcher on additive schema v7: explicit dispatch.run capability upgrade, durable trigger/run ownership and heartbeat, reconcile-before-seal ordering, immutable finite membership, atomic claim/start-intent or fully bound denial outcomes, stale-run takeover and completeness-gated terminal summaries. Exact final material state b9455011a988d01ba544fbac8ac5d093d452b4d4 passed current targeted and full offline validation plus fresh independent closure-safe A2; public Phase 2 CLI, scheduling and every EP-02D or Phase 3 capability remain absent."
  }
}
~~~

## Context

Start-time evidence establishes a clean pushed current base at fcbd537bfcc0ba41f037031790a3f487c05e7378: master, origin/master, the repair task branch and direct remote query matched; the checksum-contract repair task was pushed with a current-head prune receipt, all exact-head gates, no pending operation and no reservation. The unique historical EP-02B terminal plan resolves at 544bf159f5dfe3517ec7d2535894422888c8a7e9 below that base. Git-flow then created task/ep-02c and its linked worktree with the frozen artifact manifest and twenty-three required gates. No EP-02D plan or implementation exists in this task.
