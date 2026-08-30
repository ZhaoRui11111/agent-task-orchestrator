# ExecPlan：建立持久化执行 Claim 基础

本计划实现 Phase 2 的第一段、且仅实现执行 claim/lease/fence 基础。旧的单一 “EP-02” 路线标签继续作为 umbrella；依据当前用户指令，它被细化为严格串行链：EP-01D → EP-02A → EP-02B → EP-02C → EP-02D → Phase 3。该 refinement 不重写任何历史 completed plan，也不把后续阶段描述成当前能力。

~~~execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-30 18:06:56+08:00",
    "updated_at": "2026-08-30 20:46:00+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user directive in thread 01a0521b-4236-7130-9116-bfd80373cf18",
        "at": "2026-08-30 18:06:56+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "current user directive and repository plan/Git-flow contracts",
        "at": "2026-08-30 18:06:56+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "At the verified Phase 1 terminal base, implement and validate the narrow durable execution-claim foundation: an additive schema-v5 migration and one application-owned typed service atomically authorize and claim a ready Task into running, persist ordered attempts, one active execution, lease ownership/revision/expiry, per-Task fencing, idempotency identity and CAS revisions, support authorized claim inspection, lease renewal, expiry observation and safe no-effect takeover, reject stale fences, preserve all historical authorization and migration data, and require an explicit confirmation-bound capability upgrade before any Phase 2 grant exists.",
    "non_goals": [
      "Do not implement an execution port, Manual or Fake adapter, backend call, external effect, durable effect intent/receipt/verification/finalization, cancellation loop, dispatcher sweep, scheduler, MCP, workspace, Git integration, completion gate, public Phase 2 CLI/API, release, deployment, telemetry, diagnostic bundle, or general log file.",
      "Do not create EP-02B, EP-02C, or EP-02D plan files or activate their work before EP-02A has a verified terminal commit, exact-head gates, FF-only integration, and verified ordinary origin/master push.",
      "Do not edit historical completed plans/evidence or released migrations 0001 through 0004, and do not claim adapter, dispatcher, scheduler, platform, release, or external-effect support."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "The former single EP-02 roadmap label remains an umbrella and the current user-authorized chain is exactly EP-01D -> EP-02A -> EP-02B -> EP-02C -> EP-02D -> Phase 3; EP-01D terminal commit 0eaa23c14b6e5f9a4d3511d51c11311bb00bc675 and the later Phase 1 repairs are read-only predecessors, and no successor plan is created or activated until this plan reaches the separately verified Git-flow terminal.",
        "source": "Current user directive; docs/plans/README.md; read-only terminal-resolve and exact-head coordinator evidence"
      },
      {
        "id": "C2",
        "statement": "Schema allocation is the narrow additive version 5 owned by EP-02A. Released migration files 0001/0002/0003/0004 and historical rows remain byte-semantically unchanged; any necessary closed-check table rebuild preserves every prior row and relation and adds no EP-02B/02C/02D placeholder.",
        "source": "Current user directive; docs/reference/persistence-contract.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C3",
        "statement": "Version 5 allocates only the execution-attempt and per-Task execution-sequence records needed for attempt number, one active execution, claim owner, lease revision/expiry, strictly increasing fence, idempotency key plus authoritative semantic tuple, execution/sequence revisions, authorization binding, and safe supersession. Physical checks, indexes, foreign keys and immutable/restricted-write triggers preserve one owner and concurrent-writer exclusion.",
        "source": "Current user directive; docs/reference/reliability-protocol.md; docs/adr/ADR-004-durable-claim-and-concurrency-control.md"
      },
      {
        "id": "C4",
        "statement": "The initial claim is one BEGIN IMMEDIATE application transaction that re-decodes current state, re-evaluates Domain eligibility and current Project/grant/policy revisions, records request and final allow decision, allocates the next attempt/fence, persists the active execution, applies the Domain ready->running claim_accepted transition, appends sanitized audit, decodes terminal state and commits all or none. Preflight is advisory and persistence never selects the command or grants authority.",
        "source": "Current user directive; docs/reference/domain-contract.md; docs/reference/authorization-contract.md; docs/reference/reliability-protocol.md"
      },
      {
        "id": "C5",
        "statement": "The only new grantable actions are execution.claim, execution.claim.inspect, execution.lease.renew and execution.lease.takeover. authorization.capability.upgrade is a separate non-grantable local trust-root transition requiring exact current OS/runtime identity, a fresh named confirmation, finite expiry and atomic terminal readback; schema migration, fresh schema bootstrap, ordinary renewal, Task readiness, prior decisions and content never manufacture these four grants.",
        "source": "Current user directive; docs/reference/authorization-contract.md; docs/security/threat-model.md"
      },
      {
        "id": "C6",
        "statement": "Schema-v3/v4 bootstrap, vocabulary, grant, epoch, request, decision and audit data remain strictly readable. Native schema-v5 bootstrap still creates only the nineteen Phase 1 grants at vocabulary 4. Upgrade appends a vocabulary-5 epoch and exactly the full version-5 origin set; later renewal preserves the already established current vocabulary, while a never-upgraded runtime cannot renew into Phase 2 authority.",
        "source": "Current user directive; docs/reference/authorization-contract.md; docs/reference/persistence-contract.md"
      },
      {
        "id": "C7",
        "statement": "Lease inspection derives active versus expired from trusted UTC time without treating expiry as proof of effect termination. Renewal CAS-matches execution, owner, execution revision, lease revision, fence, active status and expected Task revision. Safe takeover is allowed only after current expiry and only because EP-02A has no external-effect or unfinished-intent path; it supersedes the prior attempt, increments attempt and per-Task fence, keeps the Task running, and rejects every late old-fence mutation.",
        "source": "Current user directive; docs/reference/reliability-protocol.md"
      },
      {
        "id": "C8",
        "statement": "Idempotent replay returns the exact persisted claim/takeover outcome only when the stored semantic tuple matches byte-for-byte. Reuse of an idempotency key with another Task/revision/Project binding/operation/predecessor/owner is an integrity conflict; no retry substitutes a newer revision.",
        "source": "docs/reference/reliability-protocol.md"
      },
      {
        "id": "C9",
        "statement": "Application remains the command, authorization and transaction orchestrator; Domain remains the Task-transition owner; persistence owns SQLite shape, decode and atomic writes. No interface, test helper or future dispatcher becomes a second business-rule or SQL writer.",
        "source": "AGENTS.md; ARCHITECTURE.md; docs/reference/contract-ownership.md"
      },
      {
        "id": "C10",
        "statement": "ato.api/v1 grammar, field meanings, errors, authorization behavior and command set remain unchanged and contain no execution command. Package exports may expose the typed EP-02A library service only with truthful foundation status; no productRuntimeImplemented, adapter-support or platform-support claim becomes true.",
        "source": "Current user directive; docs/reference/cli-contract.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C11",
        "statement": "Tier-2 persistence evidence covers writer/reader closure, every shipped prefix 0/1/2/3/4 to 5 with verified pre-upgrade backup where applicable, immutable migration bytes, schema identity, malformed/corrupt/newer-state refusal, concurrent claims, transaction failpoints, restart readback, idempotent response-loss replay, expiry/takeover, CAS conflicts and stale-fence rejection.",
        "source": "docs/reference/validation-policy.md; harness-exec-plan persistence lens"
      },
      {
        "id": "C12",
        "statement": "Only fixed allowlisted audit metadata and bounded opaque IDs may persist or display. Task body, Project/runtime path, actor raw identity, prompt, tool output, secret, environment value, raw SQL/error and unclassified content remain excluded; EP-02A adds no general logger, log retention, diagnostics or telemetry.",
        "source": "Current user directive; docs/security/privacy-and-logging.md; docs/reference/observability-contract.md"
      },
      {
        "id": "C13",
        "statement": "Development uses coordinator task ep-02a only. Final state contains only declared task-owned paths; exact-head artifact prune, all frozen gates, ready, FF-only local integration and the standing-authorized ordinary origin/master push are required. Coordinator cleanup, reset, rebase, stash, clean, force, PR, release and deployment are prohibited.",
        "source": "Current user directive; AGENTS.md; docs/reference/local-agent-git-flow.md"
      }
    ],
    "authorization": {
      "allowed": [
        "Edit, test, stage and commit only the declared EP-02A task paths in task/ep-02a and its coordinator-owned linked worktree.",
        "Run local source/build/typecheck/package/database/test/documentation commands and creator-owned temporary runtime fixtures without network access.",
        "Create the one schema-v3 EP-02A proposal, activate it only after fresh independent A0, obtain fresh independent A1 and required A2, and persist the completed plan/evidence in the task result commit.",
        "After the exact task result commit, invoke the repository standing-authorized pathless artifact prune, record exact-head gate receipts, ready, FF-only integrate, and ordinary non-force origin/master push."
      ],
      "requires_reapproval": [
        "Any change to the goal, chain order, four grantable Phase 2 actions, non-grantable upgrade ceremony, schema/data/security/public outcome, task-path envelope, external-path set, validation criterion, terminal persistence action, or authorization boundary.",
        "Any adapter, external effect, intent/receipt/finalization, dispatcher, scheduler, workspace, completion, public Phase 2 CLI/API, MCP, arbitrary filesystem/shell/SQL surface, logging/diagnostic/telemetry product, external repository, secret/account, dependency, network action other than the exact standing push, PR, release, deployment, destructive action, or cleanup.",
        "Any ambiguity in repository/actor identity, coordinator CAS, historical migration or completed-plan integrity, migration compatibility, path ownership, or current permission."
      ],
      "prohibited": [
        "Modify completed plans/evidence, migrations 0001 through 0004, another repository, real user runtime/Project data, coordinator state by hand, or any out-of-scope path.",
        "Use reset, force push, rebase, stash, clean, merge commit, history rewrite, forced worktree removal, coordinator cleanup or caller-selected artifact deletion.",
        "Perform or simulate an execution backend call, external side effect, scheduler run, dispatcher sweep, workspace/Git product operation, completion gate, MCP action, release or deployment.",
        "Claim Phase 2B/2C/2D, product execution loop, adapter/platform/API support, telemetry, diagnostic bundle, external-effect safety, release readiness or automatic cleanup."
      ],
      "persistence": {
        "required": true,
        "action": "Commit the exact completed EP-02A plan, task-owned implementation, tests, contracts and sanitized evidence in one terminal task result commit before coordinator artifact prune and exact-head gates.",
        "source": "Current user directive; docs/plans/README.md; docs/reference/local-agent-git-flow.md"
      }
    },
    "scope": {
      "task_paths": [
        { "path": ".gitattributes", "kind": "file" },
        { "path": "AGENTS.md", "kind": "file" },
        { "path": "ARCHITECTURE.md", "kind": "file" },
        { "path": "CHANGELOG.md", "kind": "file" },
        { "path": "README.md", "kind": "file" },
        { "path": "docs/compatibility/v0.1.md", "kind": "file" },
        { "path": "docs/plans/proposal/EP-02A-durable-execution-claim-foundation.md", "kind": "file" },
        { "path": "docs/plans/proposals/EP-02A-durable-execution-claim-foundation.md", "kind": "file" },
        { "path": "docs/plans/active/EP-02A-durable-execution-claim-foundation.md", "kind": "file" },
        { "path": "docs/plans/completed/EP-02A-durable-execution-claim-foundation.md", "kind": "file" },
        { "path": "docs/plans/evidence/EP-02A", "kind": "directory" },
        { "path": "docs/reference/authorization-contract.md", "kind": "file" },
        { "path": "docs/reference/cli-contract.md", "kind": "file" },
        { "path": "docs/reference/contract-ownership.md", "kind": "file" },
        { "path": "docs/reference/domain-contract.md", "kind": "file" },
        { "path": "docs/reference/persistence-contract.md", "kind": "file" },
        { "path": "docs/reference/reliability-protocol.md", "kind": "file" },
        { "path": "docs/reference/toolchain-contract.md", "kind": "file" },
        { "path": "docs/reference/validation-policy.md", "kind": "file" },
        { "path": "docs/reference/versioning-compatibility-contract.md", "kind": "file" },
        { "path": "docs/security/privacy-and-logging.md", "kind": "file" },
        { "path": "docs/security/threat-model.md", "kind": "file" },
        { "path": "migrations/0005-phase2-execution-claim.sql", "kind": "file" },
        { "path": "package.json", "kind": "file" },
        { "path": "scripts/package-smoke.mjs", "kind": "file" },
        { "path": "scripts/repo-utils.mjs", "kind": "file" },
        { "path": "src/application.ts", "kind": "file" },
        { "path": "src/authorization.ts", "kind": "file" },
        { "path": "src/cli-api.ts", "kind": "file" },
        { "path": "src/execution-application.ts", "kind": "file" },
        { "path": "src/index.ts", "kind": "file" },
        { "path": "src/persistence/application-repository.ts", "kind": "file" },
        { "path": "src/persistence/backup.ts", "kind": "file" },
        { "path": "src/persistence/doctor.ts", "kind": "file" },
        { "path": "src/persistence/index.ts", "kind": "file" },
        { "path": "src/persistence/migrations.ts", "kind": "file" },
        { "path": "src/persistence/store.ts", "kind": "file" },
        { "path": "test", "kind": "directory" }
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "The unique schema-v3 proposal records the EP-02 umbrella refinement, binds the verified current base and EP-01D predecessor, freezes the exact boundary and passes fresh independent A0 before activation.",
        "validation_ids": ["V1"]
      },
      {
        "id": "M2",
        "outcome": "The additive schema-v5 migration and combined decoder preserve every shipped prefix and historical authorization row while allocating only the EP-02A attempt/sequence foundation and closed vocabulary expansion.",
        "validation_ids": ["V2", "V3"]
      },
      {
        "id": "M3",
        "outcome": "The confirmation-bound capability upgrade is the only creator of the four Phase 2 grants; bootstrap, migration and never-upgraded renewal remain Phase 1-only and historical vocabulary stays readable.",
        "validation_ids": ["V3", "V6"]
      },
      {
        "id": "M4",
        "outcome": "The typed application owner atomically authorizes and claims one eligible ready Task into running with one ordered active attempt, fence, idempotency binding, sanitized audit and terminal readback.",
        "validation_ids": ["V4", "V6"]
      },
      {
        "id": "M5",
        "outcome": "Authorized inspection and renewal expose trusted expiry, safe no-effect takeover creates a higher attempt/fence without a second Domain transition, and every stale owner/fence/revision/idempotency conflict fails without partial writes.",
        "validation_ids": ["V5", "V6"]
      },
      {
        "id": "M6",
        "outcome": "Source/build/package/restart/upgrade evidence, authoritative docs and capability status converge at one stable diff; fresh independent A1 and any routed A2 close before the completed plan and evidence enter the terminal commit.",
        "validation_ids": ["V7", "V8", "V9", "V10", "V11"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "plan schema, predecessor, chain refinement, scope and activation readiness",
        "criterion": "terminal-resolve uniquely identifies phase predecessor EP-01D at 0eaa23c14b6e5f9a4d3511d51c11311bb00bc675 and Git proves it is an ancestor of the current base; every intervening Phase 1 maintenance task has an exact terminal/push receipt; terminal-resolve identifies material predecessor repair-persistence-ownership at c5c584e7570420a2d627f3c08296e74cc4c58235 and chain-check accepts that exact EP-02A base; exec_plan trace reports schema v3, exact clean scope, errors/warnings/outside_scope/overlap/pre_existing_dirty empty, base_transition_blocked=false, exact approval digest and reviewed material base, and a0_ready=true. For initial proposal activation the next action is activation before status becomes active; after a later approval revision on an already active plan, the pre-A0 trace may fail closed solely for missing current A0 and the post-A0 next action is deterministic implementation resumption, while the historical initial-activation evidence remains preserved. Expected completion-pending gates remain explicitly non-blocking for either activation or resumption."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "schema-v5 identity, historical readers and migration atomicity",
        "criterion": "Released 0001/0002/0003/0004 canonical bytes/checksums are unchanged; fresh 0->5 and every shipped 1/2/3/4->5 path pass with verified pre-upgrade backup where required, exact registry/fingerprint/history and foreign_key_check; malformed transport, checksum/history/fingerprint/newer schema, corrupt legacy/current rows, failed migration and interruption commit either complete v5 or unchanged prior prefix, with no later-phase table."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "finite vocabulary and explicit capability upgrade without migration expansion",
        "criterion": "A migrated or fresh schema-v5 runtime has zero Phase 2 grants until exact trusted identity, named confirmation, eligible vocabulary-4 origin and finite expiry accept authorization.capability.upgrade atomically; all missing/false/replayed/stale/wrong-identity/partial/failpoint cases add no epoch/grant/request/decision/audit fragment; accepted upgrade appends one vocabulary-5 epoch and exactly one origin grant per current action while preserving every historical vocabulary-3/4 row, and renewal never upgrades an unupgraded runtime."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "atomic initial claim, contention and idempotent response-loss replay",
        "criterion": "For one eligible ready Task with exact Project/grant/policy/revision bindings, request+allow decision+active attempt+sequence/fence+Domain ready->running+sanitized audit+terminal readback commit together; injected failure at every staged durable boundary leaves all counts and Domain bytes unchanged; competing claims yield one winner, one active attempt and one fence; exact idempotency replay returns the persisted winner without another decision/audit, while key/tuple drift is a typed conflict."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "lease renewal, expiry observation, safe takeover and stale-fence refusal",
        "criterion": "Inspection uses trusted current time and exact expected revisions; renewal matches owner/execution/Task/lease/fence CAS and only advances expiry plus revisions; pre-expiry takeover is denied, post-expiry takeover supersedes exactly one effect-free attempt, increments attempt and per-Task fence, keeps Task running and commits its decision/audit atomically; all old-fence, old-owner, stale-revision and losing concurrent writes are rejected before mutation and remain rejected after restart."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "authorization, input, corruption, privacy and threat-model negatives",
        "criterion": "Unknown/malformed/oversized/accessor-backed input, content-claimed authority, absent/expired/revoked/wrong-scope grants, disabled/stale Project, ineligible Task, reused operation identities, impossible active rows and corrupted execution/authorization relations fail closed without partial product state; persisted audit and returned values contain only documented bounded opaque metadata and no Task body, path, raw identity, prompt, secret, environment, SQL/error or stack."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "module direction, package surface and unchanged public ato.api/v1",
        "criterion": "Strict typecheck/build and architecture tests prove Domain imports no outer layer, persistence does not authorize/select commands, application owns orchestration, production source/migration inventories are exact, package consumption exposes only the documented typed foundation, and source/build/packed Phase 1 CLI contract remains byte-equivalent with no Phase 2 command or new public error/state effect."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "impact-selected targeted and full offline repository gates",
        "criterion": "All targeted authorization/application/execution/persistence/migration/concurrency/restart tests pass, then pnpm test:persistence, pnpm test, package smoke and pnpm verify:offline exit zero at the exact final material state with no download, repair, omission, skipped/todo test or surviving task artifact."
      },
      {
        "id": "V9",
        "type": "manual",
        "target": "authoritative documentation and capability truthfulness",
        "criterion": "Exact-case docs links/fragments pass and manual owner review finds one current owner for schema, action vocabulary, claim/lease/fence/idempotency/CAS and audit; current docs claim only the implemented EP-02A foundation, retain the EP-02 umbrella refinement, and keep adapters, intents/receipts, dispatcher, scheduler, CLI execution, workspace, completion, MCP, logging, telemetry, release and support unimplemented."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "task-owned terminal inventory and whitespace",
        "criterion": "git diff --check passes; the final staged inventory is entirely within declared task paths, contains the completed plan and sanitized evidence, excludes runtime/database/WAL/SHM/backup/log/build/dependency/ignored/secret material, and the task worktree has no staged, unstaged or untracked nonignored residue after commit."
      },
      {
        "id": "V11",
        "type": "manual",
        "target": "independent implementation review and completion readiness",
        "criterion": "A fresh independent A1 reviews the stable material state and reports complete with parent disposition complete and no unresolved finding; every HIGH/MEDIUM repair receives fresh A2, LOW repair follows only schema-permitted closure; the final helper check finds active-or-completed lifecycle, every milestone and validation terminal, all state bindings current, required audit closure complete, a nonempty final summary, and no schema/scope/state error."
      }
    ],
    "risks": [
      {
        "id": "R1",
        "risk": "Extending closed authorization tables or the combined decoder could make historical schema-v3/v4 data unreadable, alter released migration identity, or allow a partial version-5 rebuild."
      },
      {
        "id": "R2",
        "risk": "Reusing current bootstrap/renewal mechanics could silently grant Phase 2 actions during migration, fresh initialization or ordinary renewal without the explicit upgrade ceremony."
      },
      {
        "id": "R3",
        "risk": "Competing claims, response loss, expired leases or stale workers could create multiple active attempts, reuse an idempotency key for another tuple, or write through an old fence."
      },
      {
        "id": "R4",
        "risk": "The no-effect safe-takeover proof could be overstated and accidentally become authority for EP-02B external-effect replay or dispatcher behavior."
      },
      {
        "id": "R5",
        "risk": "New claim/audit/package/status output could expose sensitive content or overclaim a product execution loop, public CLI, adapter, support or observability capability."
      },
      {
        "id": "R6",
        "risk": "Material-base movement, out-of-scope edits, stale audit/validation receipts, artifact residue or partial push could invalidate the reviewed terminal state."
      }
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Append migration 0005 with LF canonical identity. Rebuild only existing closed-check application relations that must admit the non-grantable upgrade action and four grantable actions, preserve every old row through exact bidirectional comparison, and add execution_attempts plus task_execution_sequences; do not edit prior migration bytes.",
        "rationale": "SQLite CHECK sets cannot be extended in place, while phase-scoped additive allocation and historical compatibility require one explicit forward migration."
      },
      {
        "id": "D2",
        "statement": "Keep the nineteen Phase 1 actions as the bootstrap/vocabulary-4 set and define the current vocabulary-5 set as those nineteen plus execution.claim, execution.claim.inspect, execution.lease.renew and execution.lease.takeover. authorization.capability.upgrade is application-only and non-grantable.",
        "rationale": "This makes the user-required non-expansion guarantee testable and prevents current AUTHORIZATION_ACTIONS length from silently changing bootstrap authority."
      },
      {
        "id": "D3",
        "statement": "Use a trusted execution ingress for worker owner and generated execution/operation identities; accept only a bounded explicit idempotency key and expected revisions as command data. Compute lease expiry from trusted time plus a bounded duration.",
        "rationale": "Ownership, time and allocated identities cannot come from Task or command content, while retry needs a stable caller-held idempotency identity."
      },
      {
        "id": "D4",
        "statement": "Extend the combined application transaction/readback owner so execution records participate in corruption checks and application-state identity. The new typed execution application service reuses Domain and authorization owners rather than duplicating their predicates.",
        "rationale": "Claim atomicity spans Domain, authorization, audit and execution persistence, and backup/current-state evidence must bind the same authoritative closure."
      },
      {
        "id": "D5",
        "statement": "Represent one active attempt by a partial unique index and a per-Task sequence row carrying the last attempt, current fence and CAS revision. Each attempt carries operation kind, authoritative semantic members, expected/pre/post Task revisions, Project revisions, owner, lease/execution revisions, idempotency key, decision and supersession link.",
        "rationale": "The table/index pair gives a durable one-winner invariant and enough stored tuple to prove idempotent replay and stale-writer refusal."
      },
      {
        "id": "D6",
        "statement": "Expiry observation is read-only; renewal and takeover re-evaluate current authorization and all exact CAS inputs in short transactions. Takeover is permitted only from an expired active attempt while EP-02A has no intent/effect writer and creates a new attempt/fence without a same-state Domain transition.",
        "rationale": "Expiry alone is not proof an effect stopped, and the no-effect boundary is the only safe takeover proof available before EP-02B reconciliation."
      },
      {
        "id": "D7",
        "statement": "Use failpoint hooks only in test-facing constructors and record durable restart evidence from real SQLite files; Fake adapters, backend results and simulated external receipts are excluded.",
        "rationale": "EP-02A must prove every local durable transaction seam without accidentally implementing or claiming the next plan's adapter/effect protocol."
      }
    ],
    "milestone_recovery": [
      {
        "id": "M1",
        "recovery": "Keep the sole file in proposal and rerun trace/A0 after correcting any contract or base issue; do not activate or implement with a stale audit."
      },
      {
        "id": "M2",
        "recovery": "On migration or decoder failure, leave the recognized prior prefix byte-identical or version 5 wholly committed, retain verified pre-upgrade backup evidence, and never repair released history."
      },
      {
        "id": "M3",
        "recovery": "On upgrade failure, roll back the complete request/decision/audit/epoch/grant unit; preserve earlier grants and require a fresh identity/confirmation for retry."
      },
      {
        "id": "M4",
        "recovery": "On claim failure or contention, roll back the complete decision/execution/Domain/audit unit; re-read current state and reuse only an exact matching idempotency identity."
      },
      {
        "id": "M5",
        "recovery": "On lease/takeover conflict, preserve the current active row and Task state, return the typed stale/denied/conflict result, and require a fresh authoritative read rather than substituting latest values."
      },
      {
        "id": "M6",
        "recovery": "A failed gate leaves the task reserved and editable. Repair in scope, commit a new exact head, refresh material validation/A1 or A2 as required, and never hide partial integration/push or invoke cleanup."
      }
    ],
    "validation_bindings": [
      { "id": "V1", "state_binding": "material" },
      { "id": "V2", "state_binding": "material" },
      { "id": "V3", "state_binding": "material" },
      { "id": "V4", "state_binding": "material" },
      { "id": "V5", "state_binding": "material" },
      { "id": "V6", "state_binding": "material" },
      { "id": "V7", "state_binding": "material" },
      { "id": "V8", "state_binding": "material" },
      { "id": "V9", "state_binding": "material" },
      { "id": "V10", "state_binding": "material" },
      { "id": "V11", "state_binding": "material" }
    ],
    "risk_controls": [
      {
        "id": "R1",
        "mitigation": "Freeze old migration blobs/checksums, use one v4 historical decoder, exact old/new row comparison, transaction postcondition, prefix matrix and backup-before-upgrade.",
        "recovery": "Reject before mutation or roll back 0005 wholly; retain the verified prior prefix and never rewrite migration history."
      },
      {
        "id": "R2",
        "mitigation": "Separate PHASE1 and current action sets, require an explicit vocabulary-5 upgrade record/confirmation, assert zero new grants after migration/bootstrap and version-aware renewal.",
        "recovery": "Roll back any partial upgrade and treat an impossible action/epoch/grant relation as typed corruption."
      },
      {
        "id": "R3",
        "mitigation": "Use BEGIN IMMEDIATE, partial unique active index, per-Task monotonic sequence/fence, exact semantic tuple comparison, execution/lease/Task revisions and negative concurrency/failpoint tests.",
        "recovery": "Return the persisted idempotent winner or a typed stale/conflict result; never create a second active row or accept a late fence."
      },
      {
        "id": "R4",
        "mitigation": "Encode the absence of any EP-02B intent/effect table or call as a hard takeover precondition and keep later reconciliation explicitly non-goal/current non-claim.",
        "recovery": "If any effect-bearing path becomes necessary, stop and route it to a revised approval contract and fresh A0 rather than broadening takeover."
      },
      {
        "id": "R5",
        "mitigation": "Use closed audit/output schemas, sentinel redaction tests and manual capability review; keep ato.api/v1 command grammar unchanged and foundation status explicit.",
        "recovery": "Drop unclassified output, map failures to fixed typed values and remove any unsupported claim before A1."
      },
      {
        "id": "R6",
        "mitigation": "Trace/base-diff before base acceptance, exact task scope, stable-diff A1, exact-head full gates, manifest-bound prune receipt, FF-only integration and ordinary push receipt.",
        "recovery": "Refresh only through coordinator before task commits, invalidate stale material evidence on any head/base change, and preserve truthful merged-local state if push fails."
      }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "c5c584e7570420a2d627f3c08296e74cc4c58235",
      "current_material_base": "c5c584e7570420a2d627f3c08296e74cc4c58235",
      "base_transitions": []
    },
    "milestone_progress": [
      { "id": "M1", "status": "complete", "updated_at": "2026-08-30 20:41:20+08:00" },
      { "id": "M2", "status": "complete", "updated_at": "2026-08-30 20:41:20+08:00" },
      { "id": "M3", "status": "complete", "updated_at": "2026-08-30 20:41:20+08:00" },
      { "id": "M4", "status": "complete", "updated_at": "2026-08-30 20:41:20+08:00" },
      { "id": "M5", "status": "complete", "updated_at": "2026-08-30 20:41:20+08:00" },
      { "id": "M6", "status": "complete", "updated_at": "2026-08-30 20:46:00+08:00" }
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "terminal-resolve, chain-check, Git ancestry, coordinator trace, schema-v3 trace and fresh A0",
        "evidence": "The unique EP-01D predecessor and every later Phase 1 maintenance terminal resolve below base c5c584e7570420a2d627f3c08296e74cc4c58235; master, origin/master and the task base began exact there. The proposal records the user-authorized EP-02 umbrella refinement, fresh A0 reproduced approval digest DF60CD8EE144D5D064E7B1FD892A8CC2305D23E6F95928C47B4D908DE14960C4, and current trace has no base, scope, warning or chain error.",
        "state_id": "git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "canonical migration identity, shipped-prefix upgrade, backup-before-upgrade, schema-shape, rollback and corruption tests",
        "evidence": "Released migrations 0001-0004 remain unchanged; additive migration 0005 has canonical LF SHA-256 27AB1730F5A56A2127479C02570068E6BA1CA3DB565147FB0325AAA412CD5C81. Fresh and 1/2/3/4-to-5 matrices, exact history/fingerprint/FK checks, malformed/current/newer corruption refusal, rollback, populated v4 lifecycle digest, v4 backup, migrated backup writer/verifier/direct restore/recovery and restart readback all pass.",
        "state_id": "git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "capability-upgrade authorization, lineage, failpoint, adoption, restart and renewal tests",
        "evidence": "Migration, native v5 bootstrap and never-upgraded renewal create zero Phase 2 grant. Exact identity plus fresh named confirmation upgrades eligible vocabulary-4 lineage to one vocabulary-5 epoch and 23 origin grants; every staged failure is all-or-none. The v3-to-v5 adoption-upgrade-restart-repeat route preserves immutable bootstrap and all legacy grants while exposing Phase 2 grants only after explicit upgrade.",
        "state_id": "git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "atomic claim, contention, failpoint/restart and exact semantic-idempotency tests",
        "evidence": "Application-owned BEGIN IMMEDIATE claim commits request, allow decision, one sequence/attempt/fence, Domain ready-to-running transition, sanitized audit and terminal readback together. All staged crash points reopen unchanged, competing claims have one winner, exact replay returns the persisted result, and Task/Project/revision/owner/operation/predecessor tuple drift is a typed conflict.",
        "state_id": "git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "lease inspection, renewal, takeover, CAS, failpoint/restart and stale-fence tests",
        "evidence": "Inspection derives expiry from trusted UTC time. Renewal uses trusted now plus a bounded duration, refuses non-forward expiry and cannot bank lease time. Pre-expiry takeover is denied; expired effect-free takeover supersedes exactly one attempt with a higher attempt/fence while Task stays running. Renewal/takeover staged restart matrices and concurrent/old-owner/old-fence/stale-revision negatives all pass.",
        "state_id": "git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "authorization, malformed ingress, semantic corruption, redaction and threat-model negative tests",
        "evidence": "Malformed Phase 2 and upgrade envelopes return before trusted ingress or persistence; absent/expired/revoked/wrong-scope authority, disabled/stale Project, ineligible Task, replayed trusted identity and impossible execution relations fail closed without partial state. Returned and audited execution observables remain bounded opaque metadata with no Task body, path, principal, prompt, environment, SQL, stack or secret.",
        "state_id": "git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "strict typecheck/build, architecture, package smoke and unchanged ato.api/v1 tests",
        "evidence": "Strict NodeNext typecheck and build pass; Domain has no outer-layer dependency, persistence does not authorize or select commands, and Application remains the only orchestration owner. The 88-file packed package exposes only the typed claim foundation; source/build/installed Phase 1 CLI parity and exact ato.api/v1 grammar/error behavior remain unchanged with no Phase 2 CLI command.",
        "state_id": "git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "affected routes, complete persistence suite and frozen-Node offline repository gate",
        "evidence": "Frozen Node 24.19 targeted migration route passes 20/20, pnpm test:persistence passes 95/95, and the accepted complete pnpm verify:offline rerun passes 302/302 with zero failure/skip/todo, artifact baseline/terminal 65/65, lint 155/21, typecheck/build, docs 75/246/21/0, zero production dependencies, package smoke, SQLite 3.53.3 with no surviving generation member, and the Codex boundary explicitly blocked/unclaimed.",
        "state_id": "git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "docs-check plus manual authority, ownership and capability-truthfulness review",
        "evidence": "Docs-check accepts 75 Markdown files, 246 exact-case local links, 21 fragments and zero forbidden reference. Manual review finds one owner for schema, vocabulary, claim/lease/fence/idempotency/CAS and audit, claims only the EP-02A foundation, and keeps ports/adapters/effects/intents/receipts/dispatcher/scheduler/completion/workspace/MCP/public execution CLI/logging/telemetry/release/deployment unimplemented.",
        "state_id": "git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "terminal lifecycle move, cached inventory, cached whitespace check and task-scope trace",
        "evidence": "The terminal staged inventory contains exactly 47 task-owned paths, including only the completed EP-02A lifecycle file and its evidence; git diff --cached --check passes. The current task-scope trace has empty outside_scope, overlap and pre_existing_dirty sets, and the completed lifecycle leaves no successor plan in this task.",
        "state_id": "git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "fresh independent A1, routed A2 repairs, three fresh A2 attempts and current exact-state trace",
        "evidence": "Fresh A1 bound git-sha1:75947b383b5b1c1548e27dc3434dbfe6ffc137a6 and reported two HIGH, four MEDIUM and one LOW finding. After repairs, two fresh A2 attempts found bounded lifecycle-digest backup/restore residuals; both histories are preserved. Third fresh independent A2 reviewer /root/ep02a_a2 bound git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e, closed all seven A1 findings and both residual roots, and reported no current finding.",
        "state_id": "git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/ep02a_a0",
        "independence": "Fresh independent read-only A0 closure reviewer; did not author the revision, edit files or Git, mutate coordinator/external state, or grant authority.",
        "scope": "Re-read the complete active EP-02A plan and current harness ExecPlan schema, A0 method, and Tier-2 persistence lens. Non-fail-fast reviewed F-EP02A-A0-003 closure, lifecycle ownership paths and history, current material base, and the full approval/execution contracts.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-30 18:28:46+08:00",
        "approval_sha256": "DF60CD8EE144D5D064E7B1FD892A8CC2305D23E6F95928C47B4D908DE14960C4",
        "reviewed_material_base": "c5c584e7570420a2d627f3c08296e74cc4c58235",
        "evidence": "Independent canonical serialization produced 22,431 UTF-8 bytes and SHA256 DF60CD8EE144D5D064E7B1FD892A8CC2305D23E6F95928C47B4D908DE14960C4, matching the supplied facts. HEAD and both material bases remain c5c584e7570420a2d627f3c08296e74cc4c58235; the sole lifecycle file is task-owned. The pre-A0 E_LIFECYCLE was the expected fail-closed state for an active plan missing current A0, with no warning or product/contract blocker. F-EP02A-A0-003 is closed because V1 separately defines initial proposal activation and post-revision active-plan implementation resumption, preserves historical activation evidence, requires a current post-A0 clean trace and exact digest/base, and permits only expected completion-pending gates. The singular/plural proposal ownership envelopes add no product file, permission, persistence behavior, or deliverable. Attempt 3 and previous digest remain preserved; full non-fail-fast review found no remaining substantive finding.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/ep02a_a1",
        "independence": "Fresh independent read-only A1 reviewer that did not implement or repair EP-02A. The reviewer made no file, Git, plan, coordinator, permission, network, secret, external-repository or external-state mutation; the parent disclosed two bounded candidates only after the initial full report, and the addendum remained bound to the same frozen state.",
        "scope": "Exact stable EP-02A material state git-sha1:75947b383b5b1c1548e27dc3434dbfe6ffc137a6 from material base c5c584e7570420a2d627f3c08296e74cc4c58235; all 45 material paths, current plan/trace and validation evidence, schema migration, application/persistence/backup/doctor implementation, authoritative authorization/Domain/persistence/reliability/version/CLI/security contracts, and relevant new and historical tests. The bounded addendum reviewed adopted-v3 capability upgrade and response-loss replay authorization semantics only.",
        "reviewed_at": "2026-08-30 19:58:29+08:00",
        "evidence": "The final independent trace remained exact at git-sha1:75947b383b5b1c1548e27dc3434dbfe6ffc137a6 with approval digest DF60CD8EE144D5D064E7B1FD892A8CC2305D23E6F95928C47B4D908DE14960C4 and empty errors, warnings, outside_scope, overlap and pre_existing_dirty. The reviewer read the complete schema-v3 planning and Tier-2 persistence audit methods, stable task diff, contracts and validation evidence. It reproduced two HIGH, four MEDIUM and one LOW defect: the v4 lifecycle digest projection is not preserved across v5 reading/backup verification; claim/takeover replay omits Project ID; renewal accumulates expiry rather than using trusted now plus bounded duration; renewal/takeover lack staged restart failpoint matrices; malformed new envelopes consume trusted ingress before parse success; one bootstrap/epoch authorization sentence conflicts with implemented lineage; and an adopted immutable vocabulary-3 bootstrap can never enter the explicit vocabulary-5 upgrade path. The bounded second candidate was not a finding: after exact Project binding is restored, same-actor exact persisted response-loss replay remains read-only history under the approved C8 semantic identity and does not re-authorize mutation or effect.",
        "reviewed_state_id": "git-sha1:75947b383b5b1c1548e27dc3434dbfe6ffc137a6",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-EP02A-A1-001",
            "severity": "HIGH",
            "summary": "Schema-v4 lifecycle state digests are recomputed with the schema-v5 execution projection, so legitimate terminal v4 lifecycle state and application-authorized v4 manual backups fail read, migration or verification as corrupt.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Preserve the exact historical v4 digest algorithm and durable digest-version provenance across migration; select the schema-correct reader/digest for lifecycle validation and backup verification, and add populated v4 lifecycle/manual-backup migration, doctor and verification regressions.",
            "closure_evidence": "Migration 0005 now persists digest-version provenance; lifecycle decoding, validation, current backup writing, standalone verification, confirmed restore publication validation and interrupted-restore recovery all select the historical version-1 or current version-2 projection. Populated v4 migration, backup, direct restore and after-publish recovery regressions pass. Fresh independent A2 closed this finding at git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02A-A1-002",
            "severity": "MEDIUM",
            "summary": "Claim and takeover idempotency matchers omit the exact Project ID, allowing a drifted Project binding to replay another semantic tuple's persisted success.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Bind replay matching to the persisted Task/Project identity in both preflight and concurrent transaction paths and add claim/takeover Project-ID drift regressions.",
            "closure_evidence": "Claim and takeover replay matchers now bind the persisted Project ID in preflight and transaction-conflict recovery; exact semantic replay remains stable while Project drift is a typed conflict. Fresh independent A2 closed this finding at git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02A-A1-003",
            "severity": "MEDIUM",
            "summary": "Lease renewal accumulates duration from the prior expiry, allowing repeated early renewals to bank unbounded future lease time instead of enforcing trusted now plus a bounded duration.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Compute renewal expiry only from trusted now plus the bounded duration and reject a renewal that would not move expiry forward; add repeated-early-renewal boundary tests.",
            "closure_evidence": "Renewal now derives expiry only from trusted now plus the bounded duration, rejects non-forward renewal, and repeated early renewal cannot bank future lease time; lease/takeover boundaries pass. Fresh independent A2 closed this finding at git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02A-A1-004",
            "severity": "MEDIUM",
            "summary": "The durable-transition recovery claim is evidenced only for claim and same-connection readback; renewal and takeover lack staged failpoint, close, reopen and unchanged-state matrices.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Inject failure after every claim, renewal and takeover durable stage, close and reopen the real SQLite runtime, and compare Domain, requests, decisions, audit, sequences and attempts to the pre-operation state.",
            "closure_evidence": "Renewal and takeover now have staged failpoint, close, reopen and unchanged-state matrices covering Domain state, requests, decisions, audit, sequences and attempts; the frozen-Node persistence suite passes. Fresh independent A2 closed this finding at git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02A-A1-005",
            "severity": "MEDIUM",
            "summary": "Malformed execution and capability-upgrade envelopes call trusted actor/time/owner or operation-identity ingress before complete command parsing succeeds.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Return INVALID_INPUT immediately after parse failure and before any trusted ingress call for claim, inspect, renew, takeover and capability upgrade; add counting/throwing ingress negatives with null operation identities.",
            "closure_evidence": "Claim, inspect, renew, takeover and capability-upgrade entry points now return INVALID_INPUT before any trusted identity/time/owner/operation provider or persistence call; counting and throwing ingress negatives prove zero calls and writes. Fresh independent A2 closed this finding at git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02A-A1-006",
            "severity": "LOW",
            "summary": "The authorization contract says native schema-v5 bootstrap creates a vocabulary-4 epoch although implementation and persistence contracts create no epoch until upgrade.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Correct the authoritative sentence to vocabulary-4 bootstrap/origin grants and preserve capability upgrade as the first epoch creator.",
            "closure_evidence": "The authorization contract now truthfully states that native schema-v5 bootstrap creates vocabulary-4 bootstrap/origin grants and no epoch until explicit capability upgrade; documentation and owner checks pass. Fresh independent A2 closed this finding at git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e.",
            "closure_state_id": null
          },
          {
            "id": "F-EP02A-A1-007",
            "severity": "HIGH",
            "summary": "A migrated schema-v3 runtime can adopt into a valid vocabulary-4 current epoch but can never explicitly upgrade because eligibility incorrectly requires the immutable bootstrap itself to be vocabulary 4.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Derive upgrade eligibility from the validated current identity and latest vocabulary lineage, require an adopted bootstrap-3 runtime to have a valid vocabulary-4 epoch, and add v3-to-v5-adopt-upgrade-restart/repeat regressions preserving all legacy rows.",
            "closure_evidence": "Upgrade eligibility now follows the validated current identity and latest vocabulary lineage, admits only a valid adopted bootstrap-3 vocabulary-4 epoch, and preserves immutable bootstrap plus every legacy grant across adopt-upgrade-restart-repeat. Fresh independent A2 closed this finding at git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "/root/ep02a_a2",
        "independence": "Third fresh independent read-only A2 rerun by the non-implementer reviewer. No file, Git, ExecPlan, coordinator, permission, network, test-artifact, or external-state mutation was performed.",
        "scope": "Non-fail-fast review of all seven A1 closure roots at the exact new state, including both prior A2 residuals, every application-state digest consumer in backup.ts, writer and standalone-verifier provenance selection, direct restore, interrupted-publication recovery, retained restore authorization, hidden-provenance failure behavior, public BackupManifest/API compatibility, and regression stability of the other six A1 repairs.",
        "reviewed_at": "2026-08-30 20:39:48+08:00",
        "evidence": "Read-only trace independently confirmed git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e, base c5c584e7570420a2d627f3c08296e74cc4c58235, approval digest DF60CD8EE144D5D064E7B1FD892A8CC2305D23E6F95928C47B4D908DE14960C4, and empty errors, warnings, outside_scope, overlap and pre_existing_dirty. F-EP02A-A1-001 and both localized A2 residuals are closed: decoder-issued lifecycle objects retain digest version 1 or 2 internally; absent provenance fails CORRUPT_ROW; lifecycle validation carries the closed version; current writer, standalone verifier, direct restore, confirmed publication validation and interrupted-publication recovery all select it. BackupManifest v2 and package-root exports remain unchanged. Real v4-to-v5 backup, verification, direct restore and afterPublish recovery regressions pass. The other six A1 roots remain closed; final targeted, persistence and offline full evidence is green.",
        "reviewed_state_id": "git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e",
        "parent_disposition": "complete",
        "closes": [
          "F-EP02A-A1-001",
          "F-EP02A-A1-002",
          "F-EP02A-A1-003",
          "F-EP02A-A1-004",
          "F-EP02A-A1-005",
          "F-EP02A-A1-006",
          "F-EP02A-A1-007"
        ],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-EP02A-A0-001", "F-EP02A-A0-002"],
        "disposition": "superseded",
        "reason": "Fresh independent A0 required a minimal approval-contract revision: V1 now binds material state, and its activation criterion distinguishes exact activation readiness from expected completion-pending gates."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "superseded",
        "reason": "Post-activation lifecycle preflight exposed the harness-normalized singular proposal path as missing from task scope; the successful A0 was archived before the minimal ownership-only approval revision."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": ["F-EP02A-A0-003"],
        "disposition": "superseded",
        "reason": "Fresh independent A0 required V1 to distinguish initial proposal activation from deterministic active-plan implementation resumption after a valid approval revision."
      },
      {
        "audit": "A2",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-EP02A-A2-001"],
        "disposition": "reopened",
        "reason": "Fresh independent A2 at git-sha1:ef56af48fcfbf59260d6e9d954d05949e08ebd20 found that migrated version-1 lifecycle authorization decoded and validated historically but current-v5 backup creation and standalone verification recomputed version 2, causing a bounded BACKUP_CONFLICT residual. The residual was repaired and required a fresh A2."
      },
      {
        "audit": "A2",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-EP02A-A2-002"],
        "disposition": "reopened",
        "reason": "Fresh independent A2 at git-sha1:514ed34668a8478464a8ffaecebb8352741f07f2 accepted the prior repair but found that validatePublishedBackupAuthorization still recomputed the current projection, blocking confirmed restore and recovery of a valid schema-v5 digest-version-1 backup. The residual was repaired and required a fresh A2."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V8",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-08-30 20:43:31+08:00",
        "evidence": "A frozen-Node full route reached 301/302 when the pre-existing artifact-concurrency disappearance/identity route surfaced a raw Windows ENOENT race; no material path changed. The isolated exact route then passed 4/4 and the subsequent complete rerun passed 302/302, so only that complete rerun is accepted.",
        "state_id": null
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-08-30 18:21:54+08:00",
        "summary": "Closed A0 findings F-EP02A-A0-001 and F-EP02A-A0-002 by binding base-specific V1 evidence to material state and making its activation trace criterion binary without treating expected completion-pending gates as activation failures.",
        "previous_approval_sha256": "12B8E624984EC0EC6A42BF55B392B76441FE92BC3DDD0B515A0C0B3DEC8F24F1"
      },
      {
        "at": "2026-08-30 18:25:07+08:00",
        "summary": "Added the harness-normalized singular proposal lifecycle path to task ownership while retaining the repository's actual plural proposal path; no product file, permission, or deliverable changed.",
        "previous_approval_sha256": "507A29A60D85A7C7AD534B0A353B86584AFB76AC822A5F0C124FC906C14F93D5"
      },
      {
        "at": "2026-08-30 18:27:48+08:00",
        "summary": "Closed F-EP02A-A0-003 by making V1 lifecycle-aware for both initial proposal activation and fresh-A0 implementation resumption after a valid active-plan approval revision.",
        "previous_approval_sha256": "BC7FEA8865F5B504F68CF975C261F8C3F1AA54978C5F268809BF00E3FDB768C1"
      }
    ],
    "final_summary": "EP-02A closes the narrow durable execution-claim foundation at material state git-sha1:51962aa90b89b65d9cd0be5b753ecb52050dce9e: additive schema v5, explicit confirmation-bound Phase 2 capability upgrade, atomic application-owned claim, ordered attempts and per-Task fences, bounded lease renewal, expiry observation, effect-free safe takeover, strict stale-write rejection, bounded observability and historical schema/authorization readability. All eleven binary validations pass; fresh independent A2 closes every A1 finding after two preserved bounded residual repairs and reports no current finding. The 47-path terminal inventory is wholly task-owned, and ports, adapters, effects, intent/receipt, dispatcher, scheduler, completion gates, public Phase 2 CLI, MCP, workspace, Git integration, release and deployment remain explicitly unimplemented for later plans."
  }
}
~~~

## Context

Start-time read-only evidence established a clean integration worktree, master and local origin/master both at c5c584e7570420a2d627f3c08296e74cc4c58235, coordinator schema 2/generation 256 with no reservation or pending operation, a unique EP-01D terminal commit, completion-ready exact-head plans for every later required Phase 1 repair, and pushed/pruned/gated coordinator receipts for the full predecessor sequence. The current task was then created by the coordinator at that exact base with its artifact manifest and required gates frozen. No network read, fetch, external repository, user runtime or cleanup was used.
