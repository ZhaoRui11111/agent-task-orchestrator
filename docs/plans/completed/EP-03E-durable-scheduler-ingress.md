# ExecPlan：交付 durable scheduler ingress

本计划从 EP-03D 的唯一终态开始，只交付 fresh、注入式的调度端口、应用与 scheduled-dispatch ingress；既有通用授权管理面会采用全局 vocabulary v7，但任何 scheduler 操作路由、默认产品组合或具体平台组合都属于尚未批准的后续工作。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-04 17:41:35+08:00",
    "updated_at": "2026-09-04 23:45:00+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "user request requiring fresh serial EP-03E implementation after completed EP-03D",
        "at": "2026-09-04 17:41:35+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "user request requiring terminal commit, FF-only integration, and applicable ordinary origin/master push",
        "at": "2026-09-04 17:41:35+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "From the unique completed EP-03D terminal, deliver one fresh-only library-level scheduler boundary: implement exact ato.scheduler/v1, one typed scheduler application owner whose register/remove mutations use durable intent-observation-verified-receipt-finalization while inspect uses a separate read-only decision/query-observation path, and scheduled dispatcher ingress whose durable observation, current-config authorization, tuple uniqueness, canonical-run attachment, duplicate handling, missed-trigger tolerance, and worker-death recovery reuse the existing reconcile-first dispatcher. Replace the sole fresh schema-version-1 baseline and application-state digest in place, add one contiguous finite scheduler authorization stage that the existing generic ato.api/v1 and CLI authorization-management lifecycle may inspect, upgrade, issue, list, and revoke, exercise the injected port only with a test-only no-effect Fake, and keep every scheduler operation route, concrete scheduler adapter, default product runtime composition, Codex composition, real operating-system scheduler effect, daemon behavior, and platform support outside EP-03E pending a separately approved successor.",
    "non_goals": [
      "Do not add a scheduler operation command or construct/invoke the scheduler application, port, trigger ingress, Codex backend, workspace, completion, integration, or cleanup adapter through the default product runtime, ato.api/v1, or CLI. Their existing generic authorization-management routes may manage the global vocabulary-v7 scheduler action labels and grants but confer no scheduler operation route, adapter selection, or effect authority.",
      "Do not select or implement a Windows Task Scheduler, cron, launchd, cloud, or other concrete scheduler adapter; register, query, execute, enable, disable, or remove a real scheduler resource; invoke a real scheduled dispatcher target; or claim scheduler/platform support.",
      "Do not add a daemon, service manager, background worker, in-memory authoritative queue, polling loop, arbitrary cron parser, calendar/timezone engine, MCP surface, plugin, release, or deployment.",
      "Do not let schedule cadence authorize Task mutation, select Task eligibility, directly launch Task content, own execution exactly-once semantics, or bypass dispatch.run and the existing reconciliation/claim/fence owners.",
      "Do not retain a prior scheduler contract major, schema prefix reader, automatic database upgrade, dual-write path, or compatibility shim; this unreleased development baseline is replaced fresh-only.",
      "Do not access D:\\quant, another external Project, credentials, network services, package registries, or any superseded task worktree.",
      "Do not create a pull request, release, deployment, force operation, or coordinator cleanup."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "The predecessor is docs/plans/completed/EP-03D-codex-execution-backend.md at its unique terminal commit e2b5da560577ec91590531d64249eefef6da3a4e, which is this task's initial material base. This plan assigns no scheduler or sequencing obligation to EP-03F or another successor.",
        "source": "docs/plans/README.md and exec_plan.py terminal-resolve evidence"
      },
      {
        "id": "C2",
        "statement": "The scheduler is an at-least-once wake-up adapter only. Task eligibility, authorization, durable claims, reconciliation, execution effects, completion, and exactly-once correctness remain with their existing owners.",
        "source": "docs/reference/scheduler-contract.md, docs/adr/ADR-007-dispatcher-and-scheduler-lifecycle.md, and docs/reference/reliability-protocol.md"
      },
      {
        "id": "C3",
        "statement": "The authoritative scheduled tuple is exactly schedule_id, schedule config revision, and intended scheduled_for instant. The first allowed schema-valid current-config observation owns one canonical run; every later allowed duplicate attaches to that run without restart, while denied, stale-config, and malformed observations create no tuple or run.",
        "source": "docs/reference/scheduler-contract.md"
      },
      {
        "id": "C4",
        "statement": "Implement one sole current ato.scheduler/v1 with exact register, inspect, remove, and dispatch_trigger shapes. Outbound register/remove effects require final explicit authorization and persisted intent before backend access; inspect is observation only; all adapter calls occur outside writer transactions and are independently parsed and verified.",
        "source": "docs/reference/adapter-contracts.md and docs/reference/reliability-protocol.md"
      },
      {
        "id": "C5",
        "statement": "Add only scheduler.register, scheduler.inspect, and scheduler.remove as a contiguous vocabulary-version-7 stage. register and remove require fresh named high-risk confirmation; inbound scheduled delivery independently evaluates existing dispatch.run and grants no scheduler operation, execution, filesystem, command, or network authority.",
        "source": "docs/reference/authorization-contract.md and the repository's finite one-step capability-upgrade model"
      },
      {
        "id": "C6",
        "statement": "Replace the sole fresh schema-version-1 baseline in place with complete schedule configuration/registration, scheduler operation, sanitized delivery observation, scheduled tuple, and canonical attachment records; update the combined decoder, digest, backup, restore, doctor, and corruption matrices with no historical reader or automatic noncurrent migration.",
        "source": "docs/reference/persistence-contract.md and docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C7",
        "statement": "Caller idempotency, external trigger ID, adapter-claimed deduplication, command paths, Task bodies, Project paths, raw XML/output/errors, environment, and credentials cannot become audit or display content. Persist only bounded opaque identities, digests, exact revisions/times, closed dispositions, and verified receipt facts.",
        "source": "docs/security/privacy-and-logging.md, docs/reference/observability-contract.md, and docs/security/threat-model.md"
      },
      {
        "id": "C8",
        "statement": "No concrete scheduler backend is selected. The application receives only an injected ato.scheduler/v1 port, and tests use an unexported no-effect Fake; request or repository content cannot select an adapter, command, platform registration, credential, principal, working directory, environment, or shell. Fake evidence cannot become an adapter or platform-support claim.",
        "source": "docs/reference/adapter-contracts.md, docs/reference/validation-policy.md, docs/security/threat-model.md, and docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C9",
        "statement": "Missed delivery changes no durable Task, lease, intent, receipt, or run state. Clock/config mismatch is recorded and deferred rather than guessed, and every accepted scheduled run follows the existing reconcile-before-seal ordering and durable run-owner heartbeat/takeover rules.",
        "source": "docs/reference/scheduler-contract.md and docs/reference/reliability-protocol.md"
      },
      {
        "id": "C10",
        "statement": "The package may export only the pure scheduler contract and typed injected application surface. The test Fake remains unexported, no production adapter exists, and any concrete adapter or default product construction requires a separately approved successor.",
        "source": "ARCHITECTURE.md, docs/reference/contract-ownership.md, and docs/reference/versioning-compatibility-contract.md"
      }
    ],
    "authorization": {
      "allowed": [
        "Modify only declared repository paths in the fresh ep-03e worktree and use repository-owned disposable fixtures with an unexported deterministic no-effect scheduler Fake.",
        "Use already-installed local tools and cached dependencies for implementation checks and offline validation.",
        "Move this plan through proposal, active, and completed after independent audits; create one terminal result commit; invoke the pathless manifest-bound artifact prune; record exact-head gates; perform FF-only local integration; and use the repository standing grant for ordinary origin/master push."
      ],
      "requires_reapproval": [
        "Any concrete scheduler adapter selection or implementation, or any real scheduler register/query/run/enable/disable/remove operation and operating-system or service-side persistent effect.",
        "Any network download, package installation, registry metadata lookup, or network-backed dependency advisory query.",
        "Any public/default product or CLI scheduler operation route or scheduler/Codex/Phase-3 adapter composition beyond the existing generic vocabulary-v7 authorization-management lifecycle; any new credential or destination authority, daemon/service, MCP, external Project, release, or deployment scope.",
        "Any new dependency, scheduler contract major, authorization action beyond the three exact scheduler operations, schema version change, or path outside the declared task scope."
      ],
      "prohibited": [
        "Read or disclose credentials, invoke a real scheduled target, mutate D:\\quant or another external Project, or use caller/repository content as a command, task path, principal, credential, environment, or authorization source.",
        "Represent Fake tests, local executable discovery, fixtures, design text, or an unverified compatibility row as real scheduler E2E, an implemented concrete adapter, or platform support.",
        "Create a compatibility shim, dual current scheduler major, second authorization/persistence/dispatcher owner, public CLI route, PR, release, deployment, force/reset/rebase/stash operation, or coordinator cleanup."
      ],
      "persistence": {
        "required": true,
        "action": "Persist one terminal task-result commit containing the completed plan and task-owned implementation, then use the repository Git-flow contract for current-head artifact pruning, exact-head gates, FF-only local integration, and the standing-authorized ordinary origin/master push.",
        "source": "user request, AGENTS.md, docs/plans/README.md, and docs/reference/local-agent-git-flow.md"
      }
    },
    "scope": {
      "task_paths": [
        { "path": "AGENTS.md", "kind": "file" },
        { "path": "ARCHITECTURE.md", "kind": "file" },
        { "path": "CHANGELOG.md", "kind": "file" },
        { "path": "README.md", "kind": "file" },
        { "path": "package.json", "kind": "file" },
        { "path": "migrations/0001-current-baseline.sql", "kind": "file" },
        { "path": "src/application-policy.ts", "kind": "file" },
        { "path": "src/application-service.ts", "kind": "file" },
        { "path": "src/authorization.ts", "kind": "file" },
        { "path": "src/dispatcher-application.ts", "kind": "file" },
        { "path": "src/dispatcher.ts", "kind": "file" },
        { "path": "src/index.ts", "kind": "file" },
        { "path": "src/scheduler-application.ts", "kind": "file" },
        { "path": "src/scheduler-port.ts", "kind": "file" },
        { "path": "src/persistence", "kind": "directory" },
        { "path": "scripts/lint.mjs", "kind": "file" },
        { "path": "scripts/package-smoke.mjs", "kind": "file" },
        { "path": "scripts/repo-utils.mjs", "kind": "file" },
        { "path": "scripts/scheduler-contract-lib.mjs", "kind": "file" },
        { "path": "scripts/scheduler-contract.mjs", "kind": "file" },
        { "path": "test", "kind": "directory" },
        { "path": "docs/README.md", "kind": "file" },
        { "path": "docs/adr/README.md", "kind": "file" },
        { "path": "docs/adr/ADR-007-dispatcher-and-scheduler-lifecycle.md", "kind": "file" },
        { "path": "docs/compatibility/v0.1.md", "kind": "file" },
        { "path": "docs/feasibility/scheduler-local-contract.json", "kind": "file" },
        { "path": "docs/feasibility/scheduler-local-contract.md", "kind": "file" },
        { "path": "docs/reference/adapter-contracts.md", "kind": "file" },
        { "path": "docs/reference/authorization-contract.md", "kind": "file" },
        { "path": "docs/reference/contract-ownership.md", "kind": "file" },
        { "path": "docs/reference/completion-workspace-contract.md", "kind": "file" },
        { "path": "docs/reference/cli-contract.md", "kind": "file" },
        { "path": "docs/reference/observability-contract.md", "kind": "file" },
        { "path": "docs/reference/persistence-contract.md", "kind": "file" },
        { "path": "docs/reference/reliability-protocol.md", "kind": "file" },
        { "path": "docs/reference/scheduler-contract.md", "kind": "file" },
        { "path": "docs/reference/toolchain-contract.md", "kind": "file" },
        { "path": "docs/reference/validation-policy.md", "kind": "file" },
        { "path": "docs/reference/versioning-compatibility-contract.md", "kind": "file" },
        { "path": "docs/security/privacy-and-logging.md", "kind": "file" },
        { "path": "docs/security/threat-model.md", "kind": "file" },
        { "path": "docs/plans/proposals/EP-03E-durable-scheduler-ingress.md", "kind": "file" },
        { "path": "docs/plans/proposal/EP-03E-durable-scheduler-ingress.md", "kind": "file" },
        { "path": "docs/plans/active/EP-03E-durable-scheduler-ingress.md", "kind": "file" },
        { "path": "docs/plans/completed/EP-03E-durable-scheduler-ingress.md", "kind": "file" },
        { "path": "docs/plans/evidence/EP-03E", "kind": "directory" }
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "The unique EP-03D predecessor, exact ato.scheduler/v1 contract, vocabulary-7 authority, package/default-product boundary, and no-real-scheduler-effect rule are frozen and independently approved.",
        "validation_ids": ["V1", "V2", "V3"]
      },
      {
        "id": "M2",
        "outcome": "The fresh schema baseline, application digest, and typed injected scheduler owner close register/remove intent, effect, observation, verification, finalization, idempotency, ambiguity, and restart behavior while the separate inspect decision/query path remains read-only and no concrete backend or default route exists.",
        "validation_ids": ["V4", "V5", "V6"]
      },
      {
        "id": "M3",
        "outcome": "Scheduled dispatcher ingress durably records every delivery and creates or reuses exactly one canonical reconcile-first run for each current allowed tuple across duplicates, races, stale config, denial, malformed input, missed delivery, and clock changes.",
        "validation_ids": ["V7", "V8"]
      },
      {
        "id": "M4",
        "outcome": "Run-owner death, response loss, stale fences, corruption, redaction, and recovery retain complete durable evidence and cannot restart terminal runs, duplicate effects, invent completion, or leak untrusted content.",
        "validation_ids": ["V9", "V10"]
      },
      {
        "id": "M5",
        "outcome": "Application/package architecture, focused and complete tests, offline toolchain, dependency shape, documentation, and explicit not-run support evidence agree on the delivered library-only boundary.",
        "validation_ids": ["V11", "V12", "V13", "V14"]
      },
      {
        "id": "M6",
        "outcome": "Fresh independent A1 and any required A2 accept the exact stable candidate, and the plan reaches completion readiness before the separately ordered result-commit/prune/gate/integration/push lifecycle.",
        "validation_ids": ["V15"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "Predecessor and chain identity",
        "criterion": "terminal-resolve uniquely returns e2b5da560577ec91590531d64249eefef6da3a4e for completed EP-03D, current task base equals that commit, and chain-check accepts the final EP-03D/EP-03E pair."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Exact ato.scheduler/v1 port",
        "criterion": "Hostile-shape tests accept only exact register, inspect, remove, and dispatch_trigger requests/results for ato.scheduler/v1; reject unknown/missing/accessor/proxy/cross-operation fields, invalid revisions/times/identities/code combinations and incompatible versions before backend dispatch; and preserve the closed adapter error taxonomy."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Finite scheduler authorization stage",
        "criterion": "Fresh bootstrap remains vocabulary 1; one confirmed contiguous upgrade advances 6 to 7 exactly once and grants only scheduler.register, scheduler.inspect, and scheduler.remove in addition to v6; renewal reproduces the exact v7 set; register/remove require their own fresh named confirmation; scheduled delivery still uses dispatch.run; and stale, revoked, expired, missing, wrong-scope, content-derived, wildcard, or skipped upgrades write no effect-capable state."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Fresh scheduler persistence closure",
        "criterion": "Fresh-only schema-version-1 migration, exact canonical checksum, combined typed decoder, application-state digest version 3, backup/restore/doctor/restart and corruption tests cover every scheduler config/registration/operation/delivery/tuple/attachment record; noncurrent or old-shaped databases refuse before mutation and no historical reader, prefix migration, automatic upgrade, orphan, mutable identity, substituted digest, or partial record is accepted."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Scheduler operation reliability",
        "criterion": "For register/remove, typed application tests prove prepare authorization and idempotency, final point-of-use authorization, intent-before-effect, adapter calls outside writer transactions, independent observation/receipt verification, exact registration/config revision CAS, replay, competing writers, every durable failpoint, response loss, retryable/no-effect proof, ambiguity, restart reconciliation, and stale receipt/config refusal. Separately, inspect obtains a fresh scheduler.inspect read decision, calls the injected port outside a writer transaction, independently validates the observation, and persists only bounded read evidence with no mutation intent, effect idempotency key, final mutation decision, or registration-state mutation."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Injected port and no-effect Fake boundary",
        "criterion": "A test-only unexported Fake exercises exact register/inspect/remove application calls, deterministic idempotency, exact request/result parsing, configurable success/refusal/ambiguity, and call ordering without filesystem, process, clock, network, scheduler, SQL, or other external effects. Source/build/packed inventories contain no concrete scheduler adapter, executable invocation, task definition, platform registration grammar, or exported Fake; externalE2E=not_run and supportClaim=false remain explicit."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Scheduled trigger atomicity and deduplication",
        "criterion": "Sequential and competing deliveries prove every delivery receives its own sanitized observation; the exact schedule/config/scheduled_for tuple has one durable row and one canonical run; only the first allowed current-config observation is canonical; every later allowed duplicate references that run without restart; repeated external trigger IDs remain separate observations; denied observations are unattached and cannot block a later allowed canonical delivery; and Manual triggers remain distinct."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Stale, malformed, missed, and clock/config behavior",
        "criterion": "Tests prove malformed and stale-config deliveries persist only a bounded closed observation and create no tuple/run/effect; disabled/lost/missed deliveries mutate nothing; delayed current delivery remains eligible; timezone/clock/config mismatch is recorded/deferred rather than normalized or guessed; and the next scheduled or Manual run performs full reconciliation without replaying missed wall-clock intervals."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Dispatcher worker death and restart recovery",
        "criterion": "Existing and scheduled-run tests cover death before/after canonical tuple commit, reconciliation, membership seal, candidate effect, member finalization, and summary publication; takeover uses a higher owner revision, fences the old worker, recovers durable pending members without reselection, and publishes a terminal summary only after exact completeness."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "Security, privacy, and redaction",
        "criterion": "Authorization and sentinel tests prove Task/Project content, raw trigger/dedup/idempotency text, adapter payload/output/error values, environment, paths, credentials, SQL, and stacks are absent from durable audit/events/default results and feasibility evidence; unknown persisted enums or lineage become typed corruption; no scheduler fact authorizes execution or Task completion."
      },
      {
        "id": "V11",
        "type": "automated",
        "target": "Application and package architecture",
        "criterion": "Static/source/build/packed tests prove the pure scheduler port imports no infrastructure, the application owner calls only an injected port and owns SQLite coordination, the Fake is test-only and unexported, no concrete scheduler adapter exists, and the default product/runtime/dispatcher factory/ato.api/v1/CLI cannot construct or invoke a scheduler operation or select scheduler or Codex/Phase-3 composition. The existing generic ato.api/v1 and CLI authorization-management lifecycle alone recognizes, upgrades, issues, lists, and revokes the exact global vocabulary-v7 action set without creating a scheduler route."
      },
      {
        "id": "V12",
        "type": "automated",
        "target": "Impact-selected regression suite",
        "criterion": "All scheduler port/application/Fake/trigger, dispatcher, authorization, persistence, backup/restore/doctor, concurrency, crash/restart, redaction, product-boundary, package, and adjacent execution/workspace tests pass with zero fail, skip, or todo and add no task-artifact member."
      },
      {
        "id": "V13",
        "type": "automated",
        "target": "Full offline toolchain and dependency parity",
        "criterion": "At the exact candidate material state the unmodified pnpm verify:offline route exits zero through lint, strict typecheck, build, the repository test runner, docs:check, dependency:check, package:smoke, SQLite spike, Codex spike, and the new scheduler probe; exact dependency/source/build/packed-installed inventories match and the scheduler probe reports adapterImplemented=false, externalE2E=not_run, and supportClaim=false. The unmodified post-result-prune umbrella rerun remains a separate exact-head Git-flow gate."
      },
      {
        "id": "V14",
        "type": "manual",
        "target": "Documentation and capability truth",
        "criterion": "docs:check, git diff --check, and manual authority/capability review find one owner per rule, exact links, no stale planned-as-current text, and exact current wording for 50 actions/vocabulary v7 plus the library-only scheduler ingress. They distinguish generic public authorization management of scheduler labels/grants from the absence of any public/default scheduler operation route, real scheduled task, daemon, Codex composition, MCP, external Project, release/deployment, or platform-support claim, and retain an explicit unverified compatibility row with real E2E not run. The authoritative staged inventory remains a separate post-completion-readiness, pre-result-commit gate."
      },
      {
        "id": "V15",
        "type": "manual",
        "target": "Independent audit and terminal readiness",
        "criterion": "Fresh independent A1 has no unresolved finding; every confirmed in-scope HIGH/MEDIUM repair has fresh closure-safe A2; all other validations are terminal at one exact material state; and exec_plan.py trace reports no error, outside-scope path, overlap, pre-existing-dirty mismatch, or blocker other than the V15/M6/final-summary fields that this terminal edit closes before result persistence. No warning is allowed except W_PREFLIGHT_A2_CONVERGENCE when it is caused solely by preserved finding-bearing A2 history, the parent records a current convergence assessment under the unchanged implementation envelope, and the current closure-safe A2 has no finding."
      }
    ],
    "risks": [
      { "id": "R1", "risk": "Generalizing the Manual trigger record can accidentally change Manual idempotency, denial, run identity, or current CLI behavior." },
      { "id": "R2", "risk": "A partial scheduler operation or lost response can leave external registration state ambiguous and tempt unsafe replay." },
      { "id": "R3", "risk": "Concurrent duplicate deliveries can create multiple tuples/runs or suppress required observation and reconciliation evidence." },
      { "id": "R4", "risk": "A no-effect Fake or abstract port test can be mistaken for a concrete scheduler adapter or real registration interoperability." },
      { "id": "R5", "risk": "Adding vocabulary version 7 can accidentally grant scheduler authority through a skipped upgrade, old epoch, or unrelated action." },
      { "id": "R6", "risk": "Trigger IDs, task names, target commands, XML, output, paths, or credentials can escape through persistence, audit, tests, or diagnostics." },
      { "id": "R7", "risk": "A library-level scheduler owner, scheduled ingress, or generic public vocabulary-v7 authorization label may be misdescribed as a scheduler operation route, concrete adapter, default product composition, daemon, availability guarantee, or supported platform integration." }
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Use one exact ato.scheduler/v1 pure port with closed register/inspect/remove and inbound dispatch_trigger shapes; no v0/legacy reader or platform-specific field enters the port.",
        "rationale": "One current version and hostile-shape validation keep adapter evolution explicit and prevent platform behavior from leaking into the application owner."
      },
      {
        "id": "D2",
        "statement": "Implement register/remove through the dedicated typed application owner and the repository's prepare, act, observe, verify, finalize, and reconcile protocol. Implement inspect as a distinct fresh read authorization/query, out-of-transaction adapter observation, independent verification, and bounded durable read-evidence path with no mutation intent, effect idempotency, final mutation decision, or registration-state write.",
        "rationale": "Mutating effects need durable recovery, while the adapter contract explicitly keeps inspect in the read envelope; neither path may let the adapter authorize itself or write SQLite."
      },
      {
        "id": "D3",
        "statement": "Add exactly one capability stage 7 containing scheduler.register, scheduler.inspect, and scheduler.remove; require named confirmation for register/remove and keep dispatch.run separate for inbound delivery. The existing generic ato.api/v1 and CLI authorization-management lifecycle consumes this global current action set, but no scheduler operation command or default scheduler construction is added.",
        "rationale": "Scheduler lifecycle effects and dispatcher execution are different resources and must not inherit authority from each other."
      },
      {
        "id": "D4",
        "statement": "Extend the existing dispatcher trigger owner rather than create a second dispatcher. Persist one observation per delivery, one unique scheduled tuple, and an attachment to the existing canonical run.",
        "rationale": "This preserves reconcile-first ordering, run takeover, sealed membership, and summary completeness while making at-least-once delivery explicit."
      },
      {
        "id": "D5",
        "statement": "Use authorization-first disposition precedence for schema-valid delivery: denial records authorization_denied without revealing config state; an allowed delivery then resolves current versus stale config and canonical versus duplicate attachment. Malformed input records only a generic sanitized malformed observation.",
        "rationale": "This satisfies durable delivery evidence without persisting unsafe input or turning config existence into an unauthorized oracle."
      },
      {
        "id": "D6",
        "statement": "Do not select or implement a concrete scheduler adapter. Exercise the injected ato.scheduler/v1 boundary only with an unexported no-effect Fake supporting deterministic success, refusal, ambiguity, and call-order observations.",
        "rationale": "The current repository and user request authorize the abstract scheduler boundary but do not select a platform adapter; Fake evidence can validate application mechanics without inventing interoperability."
      },
      {
        "id": "D7",
        "statement": "Treat schedule expression, timezone, dispatcher target, external registration identity, and nullable next-known trigger time as bounded exact contract data; EP-03E does not parse cadence, compute triggers, normalize timezones, replay catch-up intervals, or define platform-specific calendar semantics.",
        "rationale": "The adapter contract carries these fields while the scheduler contract requires mismatch to defer rather than guess, and no concrete platform semantics are approved."
      },
      {
        "id": "D8",
        "statement": "Advance the current fresh-only application-state digest to version 3 and replace schema-version-1 bytes/checksums/tests in place; retain no prior-baseline reader or automatic migration.",
        "rationale": "Scheduler facts become authoritative state while the repository still has no released database compatibility promise."
      },
      {
        "id": "D9",
        "statement": "Export only the pure port and typed injected scheduler application surface; keep the Fake unexported and every concrete adapter and default product/CLI scheduler operation route absent pending a separately approved successor. Preserve only the existing generic public authorization-management behavior for the global vocabulary-v7 labels and grants.",
        "rationale": "Implementation evidence must not silently create trusted configuration, credentials, destination authority, or a supported product route."
      }
    ],
    "milestone_recovery": [
      { "id": "M1", "recovery": "If A0 finds an ownership, authorization, persistence, platform, or successor-allocation conflict, retain the report, revise only the proposal contract, and obtain a fresh independent A0 before activation." },
      { "id": "M2", "recovery": "For register/remove, a failure before adapter access leaves only denied/prepared evidence and a failure after possible access remains ambiguous until exact inspection proves state. Inspect creates no mutation intent and a failed/invalid observation cannot mutate the registration projection or masquerade as a successful read." },
      { "id": "M3", "recovery": "Transaction rollback removes no external fact; restart rereads observation/tuple/run rows, unique constraints choose one canonical winner, and duplicates attach without replaying or restarting the run." },
      { "id": "M4", "recovery": "Keep actual partial state and diagnostic evidence; use higher-revision takeover and existing durable reconciliation only, never reset, delete, blind replay, or infer terminal success." },
      { "id": "M5", "recovery": "Any changed material invalidates bound validation. Repair within scope, rerun every impacted route plus the full offline gate, and preserve blocked/not-run external evidence truthfully." },
      { "id": "M6", "recovery": "Confirmed HIGH/MEDIUM findings require repair plus fresh A2. Do not complete, commit, prune, gate, integrate, or push until trace reports completion readiness." }
    ],
    "validation_bindings": [
      { "id": "V1", "state_binding": "approval" },
      { "id": "V2", "state_binding": "material" },
      { "id": "V3", "state_binding": "material" },
      { "id": "V4", "state_binding": "material" },
      { "id": "V5", "state_binding": "material" },
      { "id": "V6", "state_binding": "material" },
      { "id": "V7", "state_binding": "material" },
      { "id": "V8", "state_binding": "material" },
      { "id": "V9", "state_binding": "material" },
      { "id": "V10", "state_binding": "material" },
      { "id": "V11", "state_binding": "material" },
      { "id": "V12", "state_binding": "material" },
      { "id": "V13", "state_binding": "material" },
      { "id": "V14", "state_binding": "material" },
      { "id": "V15", "state_binding": "material" }
    ],
    "risk_controls": [
      { "id": "R1", "mitigation": "Preserve Manual command/result behavior and add exact regression and source/build/packed parity tests.", "recovery": "Revert only the unaccepted local generalization and redesign the shared record without rewriting historical evidence." },
      { "id": "R2", "mitigation": "Persist semantic intent first, use exact idempotency and independent inspect, and classify unprovable effects as ambiguous.", "recovery": "Retain the intent and observation, block new mutation, and require a later authoritative inspect or user resolution." },
      { "id": "R3", "mitigation": "Use one database uniqueness constraint and a single transaction for tuple, canonical run, observation attachment, decision, and audit.", "recovery": "Restart from the unique durable winner; any inconsistent attachment is corruption and blocks dispatcher work." },
      { "id": "R4", "mitigation": "Keep all concrete adapter files and process/filesystem effects absent, keep the Fake test-only, and make the scheduler probe report adapterImplemented=false, externalE2E=not_run, and supportClaim=false.", "recovery": "Correct any concrete-adapter implication before activation/completion and require a separate approved successor plus real E2E before an interoperability claim." },
      { "id": "R5", "mitigation": "Extend exact action arrays, epoch hashes, schema checks, combined decoder, sequential-upgrade and atomic-failpoint tests together.", "recovery": "Refuse the inconsistent runtime as corrupt/noncurrent; do not auto-repair grants or epochs." },
      { "id": "R6", "mitigation": "Hash caller identities before persistence, allowlist closed fields, drop raw driver output/errors, and run sentinel redaction scans across state/results/evidence.", "recovery": "Treat any leak as a blocking security finding; remove the unsafe projection and rerun affected persistence/package/docs gates." },
      { "id": "R7", "mitigation": "Keep concrete adapters and default construction absent, compatibility status unverified, and explicit capability exclusions in all current-state docs.", "recovery": "Correct claims before completion and rerun documentation, architecture, package, and scheduler-contract gates." }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "e2b5da560577ec91590531d64249eefef6da3a4e",
      "current_material_base": "e2b5da560577ec91590531d64249eefef6da3a4e",
      "base_transitions": []
    },
    "milestone_progress": [
      {
        "id": "M1",
        "status": "complete",
        "updated_at": "2026-09-04 23:43:53+08:00"
      },
      {
        "id": "M2",
        "status": "complete",
        "updated_at": "2026-09-04 23:10:59+08:00"
      },
      {
        "id": "M3",
        "status": "complete",
        "updated_at": "2026-09-04 23:10:59+08:00"
      },
      {
        "id": "M4",
        "status": "complete",
        "updated_at": "2026-09-04 23:10:59+08:00"
      },
      {
        "id": "M5",
        "status": "complete",
        "updated_at": "2026-09-04 23:30:17+08:00"
      },
      {
        "id": "M6",
        "status": "complete",
        "updated_at": "2026-09-04 23:45:00+08:00"
      }
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "exec_plan.py terminal-resolve and chain-check after fresh revision-4 A0",
        "evidence": "terminal-resolve uniquely returned e2b5da560577ec91590531d64249eefef6da3a4e for completed EP-03D, and chain-check accepted that same terminal as EP-03E approval/current material base. Fresh independent A0 reproduced the 23,964-byte approval contract at SHA-256 A61700E861FB92AEDAE901F8B34A02640D3705403ADE9D27B6CB3FC170BAAE10 with reviewed material base e2b5da560577ec91590531d64249eefef6da3a4e.",
        "state_id": "approval-sha256:A61700E861FB92AEDAE901F8B34A02640D3705403ADE9D27B6CB3FC170BAAE10"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "scheduler port contract tests, hostile-result regressions, full direct test-runner observation, and independent A2 review",
        "evidence": "Exact ato.scheduler/v1 register, inspect, remove, and dispatch-trigger request/result grammars passed, including unknown, missing, accessor, Proxy, cross-operation, revision, identity, code-combination, and closed-error cases. The full direct runner reached and passed every scheduler port test; fresh A2 independently confirmed the request-bound external identity and trap-safe boundary at this exact state.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "authorization, application-service, atomicity, and scheduler boundary tests plus independent A2 review",
        "evidence": "Fresh vocabulary remains staged and finite; the contiguous scheduler stage reaches exact vocabulary 7, renewal preserves the exact action set, register/remove use fresh named confirmation, inspect remains separate, and scheduled ingress uses dispatch.run. Strict-earlier mutation, revoke, expiry, stale scope, equal-time causal replay, and skipped-upgrade regressions passed without effect-capable partial state.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "fresh migration, combined decoder/digest, corruption, backup/restore/doctor, restart, and SQLite feasibility tests",
        "evidence": "The sole fresh schema-version-1 baseline and application-state digest version 3 cover scheduler configuration, registration, operation, delivery, tuple, and attachment state. Exact reopen, backup, doctor, restore, restart, lifecycle, digest, receipt, authorization-history, and recomputed-corruption cases passed; the SQLite feasibility probe passed schema 1 with zero surviving generation members.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "scheduler application reliability, failpoint, concurrency, authorization, identity, and restart tests",
        "evidence": "Register/remove tests passed Prepare and fresh Act authorization, intent-before-effect, out-of-transaction injected calls, independent observation and receipt verification, exact revision CAS, replay, competing writers, all durable failpoints, response loss, bounded refusal, ambiguity, restart reconciliation, Project-root revalidation, and stale receipt/config refusal. Inspect passed its separate fresh read decision/query/observation path with no mutation lifecycle or registration projection change.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "test-only Fake suite, package/source boundary scans, lint, and scheduler feasibility probe",
        "evidence": "The unexported test Fake passed deterministic register/inspect/remove application and ordering cases without external effects. Source and package-boundary tests plus the scheduler probe find no concrete scheduler adapter, platform grammar, executable invocation, default route, or exported Fake; the probe reports adapterImplemented=false, externalE2E=not_run, and supportClaim=false.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "scheduled dispatcher ingress sequential, duplicate, denial, source/target, and competing-delivery tests",
        "evidence": "Every delivery retains its own sanitized observation; the exact schedule/config/scheduled-for tuple produces one canonical row and run, while later allowed duplicates attach without restart. Repeated external trigger IDs remain separate observations, denied deliveries stay unattached, and a later allowed observation can become canonical.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "scheduled ingress malformed, stale-config, Project-root, delayed, and reconciliation tests",
        "evidence": "Malformed input, source/target mismatch, stale configuration, Project disablement/revision drift, and physical-root replacement persist only bounded rejection evidence and create no tuple or run. Delayed current delivery remains eligible, while missed/disabled deliveries do not replay wall-clock intervals and later scheduled or Manual work still enters reconcile-first execution.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "dispatcher ownership/takeover, crash/restart, response-loss, fencing, completeness, and scheduled-run tests",
        "evidence": "Existing and scheduled runs passed death/restart coverage across canonical tuple commit, reconciliation, membership sealing, claims, member effects/finalization, and summary publication. Higher-revision takeover fences stale workers, preserves immutable membership, resumes durable pending members without reselection, and publishes only complete terminal summaries.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "hostile-input, authorization, corruption, redaction, audit/event, and support-boundary tests plus independent review",
        "evidence": "Sentinel and hostile-shape tests keep Task/Project content, raw trigger/idempotency values, adapter payload/output/error, environment, paths, credentials, SQL, and stacks out of durable/default evidence. Unknown enums and forged lineage fail as typed corruption; scheduler state creates neither execution authority nor Task completion.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "strict typecheck/build, architecture and package-boundary tests, source/build/packed-installed parity, lint, and package smoke",
        "evidence": "Static and runtime checks preserve the pure scheduler port, the application-owned SQLite coordination and injected-only backend call, and the unexported test Fake. The default product, dispatcher factory, ato.api/v1, and CLI expose only generic vocabulary-v7 authorization management and cannot construct a scheduler operation. The successful package smoke verified a 240-file inventory, consumer types, root exports, persistence, source/build/installed console parity, and uninstall; no concrete scheduler adapter or Codex/Phase-3 scheduler composition is reachable.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "id": "V12",
        "status": "passed",
        "method": "unmodified repository test runner within the successful full pnpm verify:offline route",
        "evidence": "The complete discovered serial suite passed 691/691 with fail=0, cancelled=0, skipped=0, and todo=0. It covered scheduler port/application/Fake/trigger, dispatcher, authorization, persistence, backup/restore/doctor, concurrency, every durable crash/restart boundary, redaction, product and package boundaries, Codex execution, and adjacent Phase 3/workspace paths. Artifact hygiene passed with baselineEntries=193, terminalEntries=193, and no task-artifact member added or replaced.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "id": "V13",
        "status": "passed",
        "method": "unmodified pnpm verify:offline after exact offline frozen dependency hydration from the matching local store",
        "evidence": "The full command exited zero end to end: lint passed 319 files/60 source files; strict TypeScript noEmit and build passed; tests passed 691/691; docs passed 163 Markdown files/268 links/22 fragments/zero forbidden; dependency shape pinned @openai/codex-sdk 0.153.2 and TypeScript 5.9.3; package smoke passed 240 files and all consumer/export/persistence/console/uninstall checks; SQLite 3.53.3/schema 1 passed with zero surviving generation members; Codex package preflight passed with externalE2E=not_run/supportClaim=false; scheduler probe passed ato.scheduler/v1 with adapterImplemented=false, externalE2E=not_run, and supportClaim=false. No registry download occurred.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "id": "V14",
        "status": "passed",
        "method": "docs:check, git diff --check, current trace, feasibility probes, and manual authority/capability review",
        "evidence": "docs:check passed 163 Markdown files, 268 local links, 22 fragments, and zero forbidden references; git diff --check exited zero with informational line-ending notices only. Trace reports the exact task-owned candidate with no scope/overlap/pre-existing-dirty issue. Manual and independent review retain exact 50-action vocabulary 7 and library-only scheduler wording while real scheduler tasks, concrete/default routes, daemon, MCP, Codex composition, release/deployment, external E2E, and platform support remain unclaimed.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "id": "V15",
        "status": "passed",
        "method": "fresh independent A1, six independent A2 attempts with final closure-safe no-finding review, fresh revision-4 A0, and parent terminal convergence assessment",
        "evidence": "Fresh A1 reported F-A1-EP03E-001 through F-A1-EP03E-010; every confirmed in-scope HIGH/MEDIUM finding was repaired and the current fresh independent A2 attempt 6 at git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7 has findings=[] and exactly closes all ten. Parent convergence assessment: the preserved finding-bearing A2 attempts identified bounded adjacent residuals in the same already-approved scheduler application, dispatcher ingress, authorization-time reconstruction, persistence decoder, and trap-safe port envelopes; each repair retained the same owners, intent/effect/recovery strategy, task scope, authorization, schema-version-1 replacement, library-only boundary, and support exclusions. Approval revision 4 changed only this terminal predicate and no material path. The fresh pre-terminal trace is ok=true with errors=[], outside_scope=[], overlap=[], pre_existing_dirty=[], exact material state git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7, all V1-V14 terminal/current, and only V15, M6, and final_summary pending. Its sole warning is W_PREFLIGHT_A2_CONVERGENCE, caused only by the preserved reopened A2 history and explicitly permitted by the fresh A0-approved V15 contract; no current finding or other warning is hidden.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "Codex /root/ep03d_a0 — fresh independent EP-03E revision-4 A0",
        "independence": "Reviewer did not draft or revise the revision-4 approval contract and did not implement or repair EP-03E. Conclusions were rebuilt from the complete current contract, repository authorities, Tier-2 persistence lens, current lifecycle evidence, one fresh trace, and an independent canonical digest calculation. Earlier audit records were treated only as preserved lifecycle facts, not reused conclusions. No file, Git/index, coordinator state, dependency, artifact, network, credential, scheduler, or external state was modified.",
        "scope": "Complete EP-03E revision-4 ExecPlan: goal and non-goals; C1-C10; implementation and persistence authorization; task, external, and pre-existing ownership scope; M1-M6; V1-V15; R1-R7; D1-D9; recovery, state binding, audit attempts, and contract revisions. Authorities reviewed include repository AGENTS.md and ARCHITECTURE.md; PLAN-SCHEMA.md, A0-AUDIT.md, and PERSISTENCE-AUDIT.md; plans lifecycle, scheduler ADR/contract, adapter, authorization, reliability, persistence, versioning, privacy, observability, threat-model, validation, toolchain, contract-ownership, CLI, completion/workspace, and local Git-flow contracts. Persistence was reviewed as Tier 2.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-04 23:42:12+08:00",
        "approval_sha256": "A61700E861FB92AEDAE901F8B34A02640D3705403ADE9D27B6CB3FC170BAAE10",
        "reviewed_material_base": "e2b5da560577ec91590531d64249eefef6da3a4e",
        "evidence": "no_findings. Duplicate-key-rejecting sorted-key compact UTF-8 canonicalization independently reproduced approval_contract_bytes=23964 and approval_contract_sha256=A61700E861FB92AEDAE901F8B34A02640D3705403ADE9D27B6CB3FC170BAAE10. Exactly one current exec_plan.py trace returned ok=true; errors=[], outside_scope=[], overlap=[], pre_existing_dirty=[]; approval/current material base, HEAD, actual HEAD, and evaluated revision all equal e2b5da560577ec91590531d64249eefef6da3a4e; current material state is git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7. Proposal-stage blockers were plan_not_active, milestones_incomplete, validation_not_terminal, and final_summary_missing; none is waived or hidden by revision 4. The pre-acceptance trace also reported W_PREFLIGHT_A0_CONVERGENCE and W_PREFLIGHT_A2_CONVERGENCE. Helper source and regression tests prove the A0 warning is emitted only while a0_ready is false and is suppressed after this no-finding A0 receives parent_disposition=complete; revision 4 does not waive it. The A2 warning is the immutable-history advisory addressed by V15: preserved reopened A2 attempts cause it, while current closure-safe A2 is complete at git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7, has findings=[], and exactly closes F-A1-EP03E-001 through F-A1-EP03E-010. V15 still rejects every error, scope/overlap/dirty mismatch, nonterminal blocker, and every warning other than this source-proven historical advisory. Semantic comparison found revision 4 limited to that lifecycle predicate; goal, scope, authorization, implementation strategy, material state, V1-V14, persistence guarantees, risk controls, and support exclusions remain unchanged. The contract remains binary, source-backed, executable, non-circular, and preserves the injected-only library boundary with no concrete adapter, default scheduler route, network/secret/real-scheduler authority, or support claim.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "Codex /root/ep03d_a0 — fresh independent A1 attempt 1",
        "independence": "Fresh independent read-only implementation audit. The reviewer did not draft, implement, or repair EP-03E and did not reuse an A0 conclusion as the A1 conclusion. No file, Git/index, coordinator, dependency, network, credential, scheduler, or external state was modified.",
        "scope": "Complete EP-03E material inventory relative to the approved base, including scheduler port/application/dispatcher ingress, authorization vocabulary, schema, repository writers/readers/combined decoder/digest, backup/restore/doctor implications, package exports/scripts/tests, feasibility evidence, and authoritative contract documentation.",
        "reviewed_at": "2026-09-04 20:13:56+08:00",
        "reviewed_state_id": "git-sha1:f1b691377bff40c4cafdff5cf68ea0015b91270d",
        "evidence": "Fresh trace was clean at the reviewed state; 25 focused scheduler tests and the targeted vocabulary-v7 test passed. Direct reproductions proved stale confirmation could allow Act and a hostile Proxy result trap could escape raw adapter data. Full report: docs/plans/evidence/EP-03E/a1-attempt-1.md.",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-A1-EP03E-001",
            "severity": "HIGH",
            "summary": "Stale Prepare confirmation authorized the final point-of-use Act effect.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Obtain a fresh named confirmation immediately before Act; false or throw durably finalizes no-effect denial and never calls the backend.",
            "closure_evidence": "Register/remove false-at-Act and throw-at-Act tests now prove zero backend calls, durable failed finalization, and idempotent authorization-denied replay.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03E-002",
            "severity": "MEDIUM",
            "summary": "Remove Act denial attempted an invalid active-to-active registration update and rolled back terminal evidence.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Keep the active registration unchanged while committing the denied Act, failed intent, no-effect finalization, and event.",
            "closure_evidence": "The remove denial path performs no registration update, records the unchanged resulting revision, and restart/replay tests return durable AUTHORIZATION_DENIED.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03E-003",
            "severity": "MEDIUM",
            "summary": "Hostile backend result traps escaped the closed port boundary.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Decode every untrusted result envelope through trap-safe exact descriptor parsing and map any throw/accessor/invalid shape to bounded integrity failure.",
            "closure_evidence": "Direct port and application-level Proxy/accessor regressions now return integrity_failure, persist bounded ambiguity after possible effect, and exclude raw sentinel data.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03E-004",
            "severity": "HIGH",
            "summary": "Scheduled delivery did not revalidate the configuration's current Project binding.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Revalidate current Project identity, enabled state, and exact resource/config revisions inside the accepting transaction.",
            "closure_evidence": "Disable, resource-revision drift, config-revision drift, and preflight race tests record stale disposition and create no tuple/run; the unchanged exact Project case succeeds.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03E-005",
            "severity": "HIGH",
            "summary": "Scheduler-source identity and Manual execution-adapter identity were conflated and dispatcher target was unbound.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Configure scheduler ingress with its own source adapter and receiving target while preserving the existing Manual execution adapter and requiring exact durable source/target matches.",
            "closure_evidence": "Source/target mismatch tests reject without a run, delivery rows bind both identities, and a scheduled run proceeds through reconcile/seal/claim with manual-local member execution identity.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03E-006",
            "severity": "HIGH",
            "summary": "Restart selected the latest observation by opaque identifier order instead of observation number.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Order and select mutation observations by their contiguous observationNumber sequence.",
            "closure_evidence": "Readers and operation views use observation number; reverse-lexical IDs plus crash/restart and repeated-ambiguity recovery tests reach the proving observation and finalize.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03E-007",
            "severity": "HIGH",
            "summary": "Inspect/remove receipts could substitute the bound external registration identity.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Persist the request-bound external registration identity, reuse it for calls, and reject any present-state substitution without changing the projection identity.",
            "closure_evidence": "Direct inspect/remove and reconciliation substitution tests now produce bounded integrity/ambiguity, retain the original identity, and later exact inspection can safely finalize.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03E-008",
            "severity": "HIGH",
            "summary": "The combined decoder did not validate Act authorization semantics.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Validate Act actor, action, scope, grant/revision/usability, result/reason, policy, and temporal binding against the origin request and lifecycle.",
            "closure_evidence": "Act-only corruption cases for every semantic field now fail closed as CORRUPT_ROW while valid denied and allowed lifecycle rows decode.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03E-009",
            "severity": "MEDIUM",
            "summary": "The combined decoder accepted impossible registration and observation lifecycle combinations.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Bind each active/terminal intent state to exact registration status/revision/last-intent lineage and reapply operation-specific receipt semantics after digest verification.",
            "closure_evidence": "Decoder checks now cover partial projections, pending remove before Act, last-intent lineage, contiguous repeated ambiguity, verified/finalized binding, and recomputed-digest impossible receipt combinations; corruption tests pass.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03E-010",
            "severity": "LOW",
            "summary": "The authoritative high-risk enumeration omitted scheduler.register and scheduler.remove.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Add both scheduler mutation actions to the exhaustive high-risk list while retaining separate inspect and inbound dispatch.run semantics.",
            "closure_evidence": "The authorization contract now names scheduler.register and scheduler.remove in its exhaustive list; documentation and link checks pass. Parent elects to include this changed LOW finding in the same fresh A2 closure set.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "Codex /root/ep03d_a0_2 — fresh independent EP-03E A2 attempt 6",
        "independence": "The reviewer did not draft or repair EP-03E. Prior reports were used only to identify closure predicates; conclusions were rebuilt from the frozen plan, authoritative contracts, current implementation, tests, and a fresh trace. Candidate material, Git/index, coordinator, credentials, real scheduler, and external state remained unchanged.",
        "scope": "Full closure review of F-A1-EP03E-001 through F-A1-EP03E-010 and F-A2-EP03E-001 through F-A2-EP03E-011, emphasizing equal-time grant replay, atomic creation batches, issuer/source provenance, sole evaluateAuthorization ownership, request-bound external identity, physical Project-root binding, allowed-effect-failed semantics, SQL/decoder lifecycle, and package/library-only boundaries.",
        "reviewed_at": "2026-09-04 22:56:03+08:00",
        "reviewed_state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7",
        "evidence": "Fresh trace was exact and clean apart from the historical convergence advisory; 135 focused tests passed with no failures, skips, or todos; lint, documentation checks, scheduler boundary probe, and git diff --check passed. Independent static review confirmed atomic creation-request grouping, recursive issuer/source provenance, focused equal-time witnesses, evaluateAuthorization as the sole final evaluator, strict-earlier mutation refusal, request-bound external identity, physical Project-root binding, closed failed/no-effect and lifecycle semantics, and library-only package boundaries. The exact formerly failing A-to-Prepare-to-lexically-earlier-B reproduction now succeeds and remains readable while strict-earlier mutation fails closed. The unavailable locked Codex SDK prevented typecheck and the unmodified full offline gate; those remain validation work, not audit findings.",
        "parent_disposition": "complete",
        "closes": [
          "F-A1-EP03E-001",
          "F-A1-EP03E-002",
          "F-A1-EP03E-003",
          "F-A1-EP03E-004",
          "F-A1-EP03E-005",
          "F-A1-EP03E-006",
          "F-A1-EP03E-007",
          "F-A1-EP03E-008",
          "F-A1-EP03E-009",
          "F-A1-EP03E-010"
        ],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A2",
        "attempt": 1,
        "report_status": "failed",
        "finding_ids": [],
        "disposition": "superseded",
        "reason": "Parent interrupted this read-only attempt before report because the concurrently completed full test suite found an unintended new public export. The candidate was repaired and rebound before another A2; no conclusion from this attempt was reused."
      },
      {
        "audit": "A2",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [
          "F-A2-EP03E-001",
          "F-A2-EP03E-002",
          "F-A2-EP03E-003",
          "F-A2-EP03E-004"
        ],
        "disposition": "reopened",
        "reason": "Fresh independent A2 closed the original A1 set and confirmed the package-export repair, but found four same-strategy residuals in Act Project freshness, ambiguous external-ID binding, denied-decision semantics, and missing-Act ambiguous decoding. Parent accepted the report and reopened repair. Full report: docs/plans/evidence/EP-03E/a2-attempt-2.md."
      },
      {
        "audit": "A2",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": [
          "F-A2-EP03E-005",
          "F-A2-EP03E-006",
          "F-A2-EP03E-007",
          "F-A2-EP03E-008"
        ],
        "disposition": "reopened",
        "reason": "Fresh independent A2 at git-sha1:4f3c6a90d803f52b9e68229d3ac815317ff79561 confirmed the earlier direct repairs but found four adjacent same-envelope residuals in physical Project-root binding, durable ambiguous external-ID reconstruction, historical grantless-denial causality, and ambiguous-to-failed lifecycle forgery. Parent accepted the report and reopened narrow repair. Full report: docs/plans/evidence/EP-03E/a2-attempt-3.md."
      },
      {
        "audit": "A2",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": [
          "F-A2-EP03E-009",
          "F-A2-EP03E-010"
        ],
        "disposition": "reopened",
        "reason": "Fresh independent A2 at git-sha1:b6a86542ff6de3de032fdcad58d2ab7b66c4c1e5 closed all exact prior predicates but found two adjacent same-envelope residuals: null erasure of request-bound inspect/remove external identity, and timestamp-only grant-history reconstruction that cannot distinguish equal-instant causal order and rejects a later authorization mutation whose trusted clock trails synthesized scheduler phase time. Parent accepted the report and reopened a strict identity plus existing-owner time-boundary repair. Full report: docs/plans/evidence/EP-03E/a2-attempt-4.md."
      },
      {
        "audit": "A2",
        "attempt": 5,
        "report_status": "complete",
        "finding_ids": [
          "F-A2-EP03E-011"
        ],
        "disposition": "reopened",
        "reason": "Fresh independent A2 at git-sha1:f3575ee428e65d31522449092fff56ead7527c46 closed the request-bound identity repair and all earlier predicates except the full equal-timestamp closure of F-A2-EP03E-010. It reproduced a legitimate same-instant per-grant causal boundary that the four global grant snapshots cannot replay. Parent accepted the report and reopened only per-grant historical-boundary reconstruction under the existing evaluateAuthorization owner. Full report: docs/plans/evidence/EP-03E/a2-attempt-5.md."
      },
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-EP03E-001",
          "F-A0-EP03E-002",
          "F-A0-EP03E-003",
          "F-A0-EP03E-004"
        ],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 at approval SHA-256 3E34F969F637163954D3FE9BEFF79E9837C58EFE2A54E9F7B84644F8E0F07D7F and reviewed base e2b5da560577ec91590531d64249eefef6da3a4e found four MEDIUM approval gaps. The parent confirmed all four: no source selected Windows Task Scheduler or its XML/next-trigger semantics; read-only inspect was conflated with the register/remove mutation protocol; the proposal invented scheduler/serial-push obligations for EP-03F; and V13 reused an EP-03D-specific raw-test fallback contrary to the fresh task's authoritative runner. Revision 1 removes the concrete adapter, separates inspect, removes adjacent-successor commitments, and requires the unmodified repository runner. The full report is preserved in docs/plans/evidence/EP-03E/a0-attempt-1.md; fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-EP03E-005"
        ],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 at approval SHA-256 34698F84205E9E9888E86218A04FBF173876BB8C6977112C4861E2D0416BA824 and reviewed base e2b5da560577ec91590531d64249eefef6da3a4e confirmed attempt-1 findings 001-004 closed but found one MEDIUM contract gap. The parent confirmed that the global vocabulary-v7 action set necessarily changes the existing generic ato.api/v1 and CLI authorization-management lifecycle even though it adds no scheduler operation route. Revision 2 makes that narrow public effect explicit, adds the authoritative CLI/completion-workspace/ADR documents to scope, and requires exact 50-action/v7 plus library-only wording. The full report is preserved in docs/plans/evidence/EP-03E/a0-attempt-2.md; fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-EP03E-006"
        ],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 at approval SHA-256 FF1E60890EAECFF4D6996FA51937F422B4867855A242084F5C2F6FA459DACB25 and reviewed base e2b5da560577ec91590531d64249eefef6da3a4e confirmed findings 001-005 closed but found one MEDIUM authoritative-document scope gap. The parent confirmed that AGENTS.md would otherwise retain false vocabulary-v6, digest-v2, and no-scheduler-ingress current-state statements. Revision 3 adds only AGENTS.md to task scope so V14 can truthfully update v7/digest-v3/library-only ingress while retaining every concrete/default/real-effect/support exclusion. A parent same-class repository scan found the other current-state scheduler/vocabulary/digest owners already inside the declared scope. The full report is preserved in docs/plans/evidence/EP-03E/a0-attempt-3.md; fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 reproduced the exact 23706-byte revision-3 approval contract at SHA-256 761096EA9D5E7AC7347B0B8B9B5B68AF4F48C44AB0FDCB44F75E739202858981 and base e2b5da560577ec91590531d64249eefef6da3a4e, independently closed F-A0-EP03E-001 through F-A0-EP03E-006, and found no current HIGH/MEDIUM issue. It was accepted for activation, then became stale only when terminal trace proved V15's unconditional no-warning clause impossible without deleting truthful finding-bearing A2 history. Revision 4 narrows that clause to the sole reviewed nonblocking W_PREFLIGHT_A2_CONVERGENCE case and requires fresh A0. Full report: docs/plans/evidence/EP-03E/a0-attempt-4.md."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V13",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-04 23:10:59+08:00",
        "evidence": "The unmodified pnpm verify:offline entry attempted dependency verification before running scripts because the worktree lacks the locked @openai/codex-sdk and platform package contents. Registry reads were denied by the sandbox and the process was immediately terminated; no network escalation was attempted and this is not a passed offline gate. The pre-existing ignored partial node_modules tree was retained unchanged.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      },
      {
        "validation_id": "V12",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-04 23:10:59+08:00",
        "evidence": "The direct authoritative test runner completed all 665 tests: 661 passed and four Codex-adjacent files failed only while importing the absent locked @openai/codex-sdk package. All reached scheduler, authorization, persistence, dispatcher, security, product, Phase 3, SQLite, and workspace cases passed with zero skip or todo. The result remains non-passing until the locked dependency is installed and the complete runner exits zero.",
        "state_id": "git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7"
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-09-04 17:56:23+08:00",
        "summary": "After fresh A0 attempt 1, narrowed EP-03E to the pure scheduler port, typed durable application/ingress owners, and an unexported no-effect Fake with no selected platform adapter; separated scheduler.inspect from register/remove mutation lifecycle; removed unsupported scheduler and push sequencing assignments to EP-03F; and restored the unmodified repository test runner as mandatory pre-terminal evidence.",
        "previous_approval_sha256": "3E34F969F637163954D3FE9BEFF79E9837C58EFE2A54E9F7B84644F8E0F07D7F"
      },
      {
        "at": "2026-09-04 18:13:16+08:00",
        "summary": "After fresh A0 attempt 2, explicitly distinguished the existing generic ato.api/v1 and CLI authorization-management adoption of global vocabulary v7 from the still-absent scheduler operation routes and default/concrete adapter composition; added the authoritative CLI, completion-workspace, and scheduler ADR documents to scope; and required their 50-action/v7 and library-only capability wording to remain exact.",
        "previous_approval_sha256": "34698F84205E9E9888E86218A04FBF173876BB8C6977112C4861E2D0416BA824"
      },
      {
        "at": "2026-09-04 18:19:25+08:00",
        "summary": "After fresh A0 attempt 3, added AGENTS.md as the sole missing authoritative current-state path so vocabulary v7, application-state digest v3, and the library-only scheduler ingress can be described truthfully while every concrete adapter, scheduler operation route, real scheduled task, daemon, real E2E, and support claim remains absent.",
        "previous_approval_sha256": "FF1E60890EAECFF4D6996FA51937F422B4867855A242084F5C2F6FA459DACB25"
      },
      {
        "at": "2026-09-04 23:30:17+08:00",
        "summary": "After all material validations and closure-safe A2 were current, terminal trace proved V15's unconditional no-warning predicate impossible because the helper permanently reports W_PREFLIGHT_A2_CONVERGENCE from preserved truthful finding-bearing A2 history. Revision 4 changes only V15 to permit that one history-only advisory when the parent records convergence under the unchanged implementation envelope and current closure-safe A2 has no finding; no goal, scope, authorization, implementation, material state, other validation, or support claim changes.",
        "previous_approval_sha256": "761096EA9D5E7AC7347B0B8B9B5B68AF4F48C44AB0FDCB44F75E739202858981"
      }
    ],
    "final_summary": "EP-03E closes only the approved fresh library-level durable scheduler ingress at exact material state git-sha1:13f374618c23523591c1c1794de094a69c2ff4d7: exact ato.scheduler/v1, one injected scheduler application owner with durable register/remove and separate read-only inspect, exact scheduled-delivery tuple attachment to the existing reconcile-first dispatcher, global authorization vocabulary v7 with 50 actions, and the replaced fresh schema-version-1/application-digest-v3 baseline. The unmodified offline route passes lint, strict typecheck, build, 691/691 tests with zero fail/skip/todo, documentation, dependency shape, a 240-file package smoke, SQLite, Codex boundary, and scheduler feasibility checks; adapterImplemented=false, externalE2E=not_run, and supportClaim=false remain truthful. Fresh revision-4 A0 is ready_for_activation with no finding; A1's ten confirmed findings and all preserved adjacent A2 residuals are closed by final fresh A2 with findings=[]. No concrete scheduler adapter, scheduler operation CLI/API/default composition, real scheduled task or effect, daemon, MCP, Codex composition, release, deployment, external E2E, network audit, or platform-support claim is delivered. The result commit, standing-authorized pathless artifact prune, exact-head gates, FF-only integration, and applicable ordinary push remain subsequent coordinator actions; cleanup remains separately unauthorized."
  }
}
```

## 执行说明

当前仓库没有单独的 EP-03E/EP-03F 规格文件；本计划只采用现行 scheduler、adapter、authorization、persistence 与 reliability 契约可以直接证明的最小库级范围，不替任何后续任务命名或分配 scheduler 组合职责。A0 若确认这些权威材料不足以支持其中任一边界，本计划保持 proposal 并停止实现。
