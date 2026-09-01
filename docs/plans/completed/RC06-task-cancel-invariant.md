# ExecPlan：统一 task.cancel 取消原因不变量

RC06 把取消原因从“新命令严格、历史读取仅非空”的双重规则收敛为一个 Domain-owned 当前不变量。没有历史运行时数据需要迁移、修复或保留。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-01 09:44:25+08:00",
    "updated_at": "2026-09-01 10:49:26+08:00",
    "authorization": {
      "implementation": {"authorized": true, "by": "current user directive requiring strict serial completion of RC06, RC07 and RC08", "at": "2026-09-01 09:44:25+08:00"},
      "persistence": {"authorized": true, "by": "current user directive plus repository standing grants for commit, pathless prune, FF-only integration and ordinary push", "at": "2026-09-01 09:44:25+08:00"}
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Establish one current task.cancel cancellation-reason invariant owned by the Domain Core: a well-formed NFC string containing no Unicode Cc or Cf code point and encoding to 1 through 4096 UTF-8 bytes; require that exact predicate for CLI and typed Application ingress, both Domain cancellation transitions, Domain snapshot decoding and persistence restart readback; preserve accepted bytes and redaction; reject every nonconforming persisted value as typed corrupt current state; and remove live compatibility branches, current-contract statements and the historical-noncanonical readback fixture without migration or repair behavior.",
    "non_goals": [
      "Do not migrate, normalize, rewrite, repair, retain or add a reader for a nonconforming cancellation reason; no historical data requires preservation.",
      "Do not change Task states or transitions, cancellation propagation, verified interruption, authorization scope, append-only audit semantics, public output/error mapping, schema SQL/checksum, backup/restore formats, API/port majors, capability vocabulary or digest version.",
      "Do not rewrite completed plans, historical audit evidence, prior changelog facts or Git history.",
      "Do not implement Phase 3 behavior, scheduler, MCP, Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend, daemon, release, deployment or support claims.",
      "Do not delete or clean any existing worktree, branch, node_modules, dist, .pnpm-store, .local, external Codex worktree or user/runtime data."
    ],
    "constraints": [
      {"id": "C1", "statement": "RC05 terminal commit 9b96269021c7363e2bb467c536df11ba0d8714d0 is the unique pushed predecessor; master and origin/master matched it, coordinator state had no reservation or pending operation, and RC06 started from that exact base.", "source": "current user directive; fresh terminal-resolve, scope, Git and harness-git-flow traces"},
      {"id": "C2", "statement": "The sole predicate accepts only a JavaScript string with no unpaired surrogate, exact NFC form, no Unicode General Category Cc/Cf code point, and UTF-8 byte length 1..4096 inclusive. Validation never normalizes; accepted bytes remain exact.", "source": "current user directive; Domain and CLI contracts"},
      {"id": "C3", "statement": "The Domain Core is C2's semantic and implementation owner. CLI and typed Application consume that owner before runtime selection or trusted-ingress/state access; transitionTask and createDomainSnapshot consume it too. No second reason-specific validator or compatibility predicate remains.", "source": "AGENTS.md single-owner rule; ARCHITECTURE.md; current source"},
      {"id": "C4", "statement": "Persistence reconstructs Tasks through createDomainSnapshot. Any stored cancellation_reason violating C2 is current-state corruption and blocks normal open/readback before writable mutation; it is not returned, normalized, skipped or rewritten. Schema-version-1 SQL bytes/checksum stay unchanged.", "source": "persistence contract; repository decoder; validation policy"},
      {"id": "C5", "statement": "Both cancel and interruption_verified facts use C2 while their acceptedTaskRevision, verification, dependent waiting, execution disposition, terminal immutability and reliability semantics remain exact.", "source": "domain contract; reliability protocol"},
      {"id": "C6", "statement": "Remove the strict-new-command/historical-nonempty distinction only from live source, authoritative current contracts and active tests. Completed plans, evidence and prior changelog entries remain immutable historical records.", "source": "current user directive; repository governance"},
      {"id": "C7", "statement": "The Application facade retains isCanonicalCancellationReason as a direct re-export of the Domain owner; the package-root Domain surface exposes the same identity. Application input may depend inward on this pure Domain predicate; other RC05 module edges and sole transaction owner stay unchanged.", "source": "current Application/package architecture; completed RC05"},
      {"id": "C8", "statement": "Cancellation reasons remain sensitive and absent from public results, fixed errors, authorization decisions, audit details and logs; only conforming values have trusted internal Domain/persistence readback.", "source": "CLI and privacy contracts"},
      {"id": "C9", "statement": "Use only task/rc06-task-cancel-invariant and its coordinator worktree. Fresh independent A0 precedes activation; fresh independent A1 follows stable validation; required A2 is independent. Then one result commit, pathless prune, twelve exact-head gates, ready, FF-only integration and ordinary non-force push. Cleanup, reset, rebase, stash, clean and force are prohibited.", "source": "current user directive; harness skills; local-agent-git-flow"},
      {"id": "C10", "statement": "This is Tier-2 durable-state invariant convergence limited to writer/reader closure, pre-mutation refusal, restart readback and typed corruption; it adds no migration, publication, topology, repair or compatibility guarantee.", "source": "harness-exec-plan persistence lens"}
    ],
    "authorization": {
      "allowed": [
        "Create/update this schema-v3 plan and evidence; edit declared paths; move the predicate to Domain; route ingress, transitions and snapshot/readback through it; remove live historical compatibility wording/fixtures; add bounded regressions and update current architecture/contracts/changelog.",
        "Run impact-selected Domain, Application, persistence, authorization, CLI, security, package, SQLite, documentation and complete offline validation using only validation-owned disposable .task-artifacts.",
        "Use independent read-only A0/A1/required A2; create one task-owned result commit; invoke standing-authorized pathless prune; record twelve exact-head gates; mark ready; FF-only integrate; and use standing-authorized ordinary origin/master push."
      ],
      "requires_reapproval": [
        "Any change to C2, Task transition/cancellation behavior, public output/error meaning, authorization, schema/migration/checksum, backup/restore, vocabulary/digest, API/port major or audit semantics.",
        "Any migration, legacy reader, normalization, repair tool, data-retention promise, new dependency/module, unrelated public capability or out-of-scope file.",
        "Any network/secret action beyond standing push, PR, non-FF integration, release, deployment, destructive cleanup or user/runtime-data mutation."
      ],
      "prohibited": [
        "Delete, clean, adopt or impersonate any existing branch, worktree, generated store, external Codex worktree, runtime, backup or user data.",
        "Rewrite completed plans, evidence, prior changelog history or Git history to hide the former rule.",
        "Implement Phase 3 or any explicitly unimplemented product/integration capability."
      ],
      "persistence": {
        "required": true,
        "action": "one terminal RC06 result commit followed by coordinator pathless prune, twelve exact-head gates, ready, FF-only integration and standing-authorized ordinary origin/master push",
        "source": "current user directive; AGENTS.md; local-agent-git-flow"
      }
    },
    "scope": {
      "task_paths": [
        {"path": "ARCHITECTURE.md", "kind": "file"},
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "docs/plans/proposal/RC06-task-cancel-invariant.md", "kind": "file"},
        {"path": "docs/plans/active/RC06-task-cancel-invariant.md", "kind": "file"},
        {"path": "docs/plans/completed/RC06-task-cancel-invariant.md", "kind": "file"},
        {"path": "docs/plans/evidence/RC06", "kind": "directory"},
        {"path": "docs/reference/authorization-contract.md", "kind": "file"},
        {"path": "docs/reference/cli-contract.md", "kind": "file"},
        {"path": "docs/reference/domain-contract.md", "kind": "file"},
        {"path": "docs/reference/persistence-contract.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "src/application-input.ts", "kind": "file"},
        {"path": "src/domain.ts", "kind": "file"},
        {"path": "test/application-service.test.mjs", "kind": "file"},
        {"path": "test/domain-architecture.test.mjs", "kind": "file"},
        {"path": "test/domain-unit.test.mjs", "kind": "file"},
        {"path": "test/persistence-repository.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {"id": "M1", "outcome": "Freeze exact predicate, owner, reader/writer closure, no-history boundary, predecessor, scope, authorization and binary evidence.", "validation_ids": ["V1", "V2"]},
      {"id": "M2", "outcome": "One Domain predicate governs current ingress, ordinary/verified cancellation and snapshot parsing with no compatibility implementation.", "validation_ids": ["V2", "V3"]},
      {"id": "M3", "outcome": "Persistence restarts exact conforming bytes and rejects every nonconforming stored reason as typed corruption before mutation.", "validation_ids": ["V4", "V5"]},
      {"id": "M4", "outcome": "Current contracts, architecture, package surface and tests state one rule while historical evidence, redaction and authorization remain exact.", "validation_ids": ["V5", "V6"]},
      {"id": "M5", "outcome": "Stable material passes focused/full gates, independent A1/required A2, exact inventory and completion-ready checks before terminal persistence.", "validation_ids": ["V7", "V8"]}
    ],
    "validations": [
      {"id": "V1", "type": "manual", "target": "RC05 continuity and activation readiness", "criterion": "RC05 terminal-resolve/scope pass at 9b96269021c7363e2bb467c536df11ba0d8714d0; RC05-to-RC06 chain-check passes; current trace has errors=[], warnings=[], outside_scope=[]; fresh independent A0 reproduces approval digest/base and returns ready_for_activation with no unresolved finding."},
      {"id": "V2", "type": "automated", "target": "Single Domain implementation owner", "criterion": "Static/export checks find exactly one reason-specific predicate body in src/domain.ts; package-root and Application exports are the same function; direct Domain tests accept exact 1/4096-byte values and reject empty, 4097-byte, Cc, Cf, non-NFC and unpaired-surrogate values in transition and snapshot paths."},
      {"id": "V3", "type": "automated", "target": "CLI/Application pre-effect parity", "criterion": "CLI security and direct Application tests prove the same matrix, exact accepted bytes, safe invalid codes before runtime/ingress/state access, and zero request/decision/audit/Domain/registry/grant/persistence mutation."},
      {"id": "V4", "type": "automated", "target": "Persistence readback/corruption refusal", "criterion": "Tests persist exact 4096-byte NFC facts and reopen byte-identically, then inject representative invalid stored classes and prove typed STATE_CORRUPT before writable mutation with original evidence retained and no normalize/rewrite/skip/fallback."},
      {"id": "V5", "type": "automated", "target": "Cancellation, authorization, atomicity, reliability and redaction regression", "criterion": "Domain state-machine, Application atomicity, authorization, execution cancellation, CLI E2E and persistence suites preserve transitions, propagation, verified interruption, CAS/fencing, append-only audit and redaction; schema checksum and backup/restore stay unchanged."},
      {"id": "V6", "type": "manual", "target": "Current-contract and historical-evidence separation", "criterion": "Docs check passes; live source/current contracts/active tests contain no historical noncanonical-read rule. Completed plans/evidence, prior changelog facts and Git history have no diff and are excluded from that live-zero assertion."},
      {"id": "V7", "type": "automated", "target": "Complete repository regression", "criterion": "Pinned typecheck/build, full tests, test:persistence, package smoke, SQLite feasibility and pnpm verify:offline exit zero with no dependency drift, support expansion, omitted applicable route or surviving validation-owned artifact."},
      {"id": "V8", "type": "manual", "target": "Stable review, inventory and terminal workflow", "criterion": "Independent A1/required A2 complete; diff checks pass; staged inventory contains only declared regular paths; final pre-commit trace has errors=[], warnings=[], outside_scope=[], state_bound=true, closure_required=false and no derived blocker before the exact-head Git-flow transitions."}
    ],
    "risks": [
      {"id": "R1", "risk": "Moving the predicate may create duplicate logic, export drift or a module cycle."},
      {"id": "R2", "risk": "Strictness may reach ordinary cancel but miss interruption_verified or snapshot parsing."},
      {"id": "R3", "risk": "A bad SQLite value may be returned/changed or reach writable open instead of typed corruption."},
      {"id": "R4", "risk": "Removing live compatibility may accidentally rewrite history or weaken audit/redaction."},
      {"id": "R5", "risk": "Focused success may miss execution, backup, package or full-suite regressions."},
      {"id": "R6", "risk": "Ignored validation residue may outlive review or stale exact-head evidence."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {"id": "D1", "statement": "Move isCanonicalCancellationReason to src/domain.ts and directly re-export/consume it from the existing Application path.", "rationale": "Cancellation reason is Domain state and needs one semantic implementation owner."},
      {"id": "D2", "statement": "Use that predicate in snapshot parsing and both cancellation payload branches; let existing persistence reconstruction enforce readback.", "rationale": "This closes writer/reader parity without a second validator or schema change."},
      {"id": "D3", "statement": "Replace historical-noncanonical readback coverage with typed-corruption negatives while retaining exact valid restart/redaction coverage.", "rationale": "No historical data exists and current invalid state must fail closed."},
      {"id": "D4", "statement": "Edit only current contracts/new changelog evidence; leave completed artifacts and prior changelog bullets unchanged.", "rationale": "Current truth converges without falsifying history."},
      {"id": "D5", "statement": "Complete one reviewed result commit, pathless prune, twelve gates, ready, FF-only integration and ordinary push; never cleanup.", "rationale": "This is the authorized serial Git-flow."}
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep proposal status and obtain fresh A0 after any approval correction."},
      {"id": "M2", "recovery": "Remove duplicate/cyclic logic and route all consumers to the Domain owner; do not keep a fallback."},
      {"id": "M3", "recovery": "Preserve corrupt fixture evidence, repair only the existing decoder path and never migrate or adopt the value."},
      {"id": "M4", "recovery": "Restore accidental historical edits and correct only current/new material."},
      {"id": "M5", "recovery": "A failed gate remains reserved/editable; repair, revalidate and refresh review/receipts without reset, rebase, stash, clean or force."}
    ],
    "validation_bindings": [
      {"id": "V1", "state_binding": "approval"},
      {"id": "V2", "state_binding": "material"},
      {"id": "V3", "state_binding": "material"},
      {"id": "V4", "state_binding": "material"},
      {"id": "V5", "state_binding": "material"},
      {"id": "V6", "state_binding": "material"},
      {"id": "V7", "state_binding": "material"},
      {"id": "V8", "state_binding": "material"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Assert exact function identity/export ownership and run static architecture plus strict compile.", "recovery": "Remove duplicate body or outward cycle and keep one Domain owner."},
      {"id": "R2", "mitigation": "Table-drive transition and snapshot tests across ordinary and verified cancellation.", "recovery": "Reject the inconsistent path before mutation and rerun the state-machine route."},
      {"id": "R3", "mitigation": "Inject raw invalid TEXT only in isolated fixtures and require refusal before writable reopen.", "recovery": "Retain evidence; fix current decoding only; never mutate the fixture."},
      {"id": "R4", "mitigation": "Verify completed-plan/evidence blobs have no diff and audit/redaction suites pass.", "recovery": "Restore historical bytes and correct new current wording."},
      {"id": "R5", "mitigation": "Run focused routes, stable A1, then package/SQLite/full offline at one state.", "recovery": "Keep active, repair the owner and reacquire stale material evidence."},
      {"id": "R6", "mitigation": "Use creator-owned generations and coordinator pathless prune after commit.", "recovery": "Record failed diagnostics while reserved; never manually delete registered or unrelated trees."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "9b96269021c7363e2bb467c536df11ba0d8714d0",
      "current_material_base": "9b96269021c7363e2bb467c536df11ba0d8714d0",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-09-01 10:07:57+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-09-01 10:19:06+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-09-01 10:19:06+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-09-01 10:19:06+08:00"},
      {"id": "M5", "status": "complete", "updated_at": "2026-09-01 10:49:26+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "RC05 terminal-resolve and terminal scope, RC05-to-RC06 chain-check, current RC06 trace, fresh independent read-only A0, independent canonical approval digest calculation and separate parent disposition.",
        "evidence": "RC05 terminal-resolve returned unique commit 9b96269021c7363e2bb467c536df11ba0d8714d0; terminal scope reported completion_ready=true and no blocker; chain-check bound RC06 to that exact base. RC06 trace returned errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], state_bound=true and state git-sha1:1cc6559a898f374ef860caaaea35191f4b616d0f. Fresh independent /root/rc06_a0 inspected the complete proposal, current contracts, implementation and Tier-2 closure, reproduced 12486 canonical approval bytes and SHA-256 BBBB342ABB3BDB0AFFC1344D375C87E1D67A0F86C581282C2E50A529796DD910, bound reviewed base 9b96269021c7363e2bb467c536df11ba0d8714d0, and returned ready_for_activation with findings=[]. The parent independently accepted the report without contract revision.",
        "state_id": "approval-sha256:BBBB342ABB3BDB0AFFC1344D375C87E1D67A0F86C581282C2E50A529796DD910"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Inspect the complete live source for reason-specific predicate bodies, run strict TypeScript, and run Domain unit plus package/Application export-identity architecture tests.",
        "evidence": "Exactly one forbidden-category constant, well-formed-string helper and isCanonicalCancellationReason implementation exist, all in src/domain.ts. application-input imports and directly re-exports that binding; the package root wildcard-exports Domain and the architecture test proves strict function identity with the Application facade. TypeScript noEmit exits 0. Domain tests prove exact 1-byte and 4,096-byte acceptance, then reject empty, 4,097-byte, Cc, Cf, non-NFC and unpaired-surrogate values through the predicate, complete snapshot, cancel and interruption_verified paths while retaining unchanged caller snapshots. The post-A1 focused Domain/export route passes 22/22.",
        "state_id": "git-sha1:6ab888669f1d227ca93cb57141a83b6d25eec323"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Run the direct Application cancellation matrix, CLI security parser matrix, exact-boundary persistence/restart test and CLI end-to-end regression.",
        "evidence": "Direct Application input rejects all six invalid classes with INVALID_INPUT, null operation identities and zero trusted-ingress/store access. CLI security proves the same shared Unicode/UTF-8 matrix before runtime selection. The exact 4,096-byte NFC value is accepted, stored byte-exactly, absent from request/decision/audit JSON and survives close/reopen. The complete source CLI Phase 1 route and redaction/security route pass.",
        "state_id": "git-sha1:6ab888669f1d227ca93cb57141a83b6d25eec323"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Run isolated raw-SQLite corruption fixtures through current open/readback and inspect the retained row after refusal.",
        "evidence": "Five independent current-schema fixtures inject empty, 4,097-byte, Cc, Cf and non-NFC cancellation_reason values. Every normal open rejects with typed CORRUPT_ROW, whose fixed public mapping is STATE_CORRUPT, before returning a store. Each fixture then reopens read-only through raw SQLite and proves the exact original invalid text remains present, with no normalization, rewrite, skip, fallback or schema/checksum change. The conforming 4,096-byte fixture reopens byte-identically.",
        "state_id": "git-sha1:6ab888669f1d227ca93cb57141a83b6d25eec323"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Run focused Domain/Application/persistence tests followed by the broader CLI, authorization, atomicity, state-machine, reliable-loop, backup/restore and schema regression set.",
        "evidence": "The focused group passes 72/72, and the broader group passes 191/191 with zero fail/cancel/skip/todo. Evidence covers cross-Project cancellation atomicity, append-only authorization/audit, randomized Domain invariants, every reliable start/resume/retry/cancel checkpoint, verified cancellation forgery refusal, redaction, backup/restore, and the immutable current schema/checksum. Both runs report artifact baseline 0-to-0 with successful reclaim.",
        "state_id": "git-sha1:6ab888669f1d227ca93cb57141a83b6d25eec323"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Run docs validation and manually search live source, current contracts and active tests while excluding immutable completed plans/evidence and prior changelog facts.",
        "evidence": "Docs check passes 109 Markdown files, 252 repository-local links, 22 fragments and forbidden=0. Current Domain, authorization, persistence, CLI, toolchain and architecture contracts state one Domain-owned predicate and typed current-state corruption with no normalization, migration, repair or compatibility reader. Live source and active tests contain no historical noncanonical-read behavior. The only historical compatibility text found is preserved in immutable completed-plan evidence; completed artifacts and prior changelog bullets have no diff.",
        "state_id": "git-sha1:6ab888669f1d227ca93cb57141a83b6d25eec323"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Seed the worktree-local offline pnpm store from validated regular cache files, run the frozen install, then invoke pnpm verify:offline through absolute Node 24.19.0 and pnpm 11.19.0.",
        "evidence": "The accepted post-A1-delta full route passes lint 221/43, strict TypeScript noEmit, build, 427/427 tests with zero fail/cancel/skip/todo and artifact baseline 0-to-0, docs 109/252/22/0, dependency policy with zero production dependencies and TypeScript 5.9.3, package smoke with 172 packed files plus consumer types/export/persistence/source-built-installed console parity/uninstall, and Windows 10.0.22631 x64 Node 24.19.0 SQLite 3.53.3 feasibility with survivingGenerationMembers=0. Codex remains boundaryStatus=passed, evidenceMode=blocked, externalE2E=not_run and supportClaim=false. The retained task-local .pnpm-store contains 133 copied regular files and zero reparse member; no node_modules, dist or store was deleted.",
        "state_id": "git-sha1:6ab888669f1d227ca93cb57141a83b6d25eec323"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Independently audit the stable candidate, close the sole LOW by permitted parent delta review, inspect the complete diff, verify exact regular-file staging and run the terminal schema-v3 trace.",
        "evidence": "Fresh independent A1 reviewed git-sha1:ea7cb15f3277e65f1204c03e1566d231d3b28341 and reported only F-RC06-A1-001 LOW. The parent independently confirmed and closed that mechanical test-only delta at git-sha1:6ab888669f1d227ca93cb57141a83b6d25eec323; closure_required=false, so no A2 is required. The complete diff and diff --check pass. Pre-terminal staging contained exactly the 13 declared changed material files plus this declared plan, all regular and non-reparse; the lifecycle move replaces only the active plan path with its declared completed path. The final pre-commit trace executed immediately after this transition returns errors=[], warnings=[], outside_scope=[], state_bound=true, closure_required=false, completion_ready=true and no blocker.",
        "state_id": "git-sha1:6ab888669f1d227ca93cb57141a83b6d25eec323"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/rc06_a0",
        "independence": "Fresh independent read-only A0 reviewer; did not author the RC06 proposal, make substantive design decisions, implement or repair RC06, grant authority, or mutate files, Git/index/refs/worktrees, coordinator/runtime state, fixtures, network, secrets, permissions, or external state. No mutation-capable test was run.",
        "scope": "Complete schema-v3 RC06 proposal and execution contract; AGENTS.md, ARCHITECTURE.md, PLAN-SCHEMA.md, A0-AUDIT.md and Tier-2 persistence lens; current Domain, authorization, persistence, CLI, reliability, toolchain, validation and local Git-flow contracts; cancellation-related implementation, exports, module boundaries and tests; exact scope, authorization, recovery and reviewed Git base.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-01 10:07:05+08:00",
        "approval_sha256": "BBBB342ABB3BDB0AFFC1344D375C87E1D67A0F86C581282C2E50A529796DD910",
        "reviewed_material_base": "9b96269021c7363e2bb467c536df11ba0d8714d0",
        "evidence": "Exactly one current exec_plan.py trace returned ok=true, errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], state_bound=true, reviewed base and HEAD 9b96269021c7363e2bb467c536df11ba0d8714d0, state git-sha1:1cc6559a898f374ef860caaaea35191f4b616d0f and next_action=run_a0. Independent canonicalization reproduced 12486 bytes and the stored digest. Read-only source/Git inspection confirmed complete Tier-2 reader/writer closure, feasible Domain ownership and Application re-export, existing index wildcard package exposure, no missing task path, no schema/checksum change, no compatibility reader or unapproved external action.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/rc06_a1",
        "independence": "Fresh independent read-only A1 reviewer who did not participate in A0, planning, implementation, repair, validation execution, authorization or Git-flow; made no filesystem, Git/index/ref/worktree, coordinator, runtime, network, secret, permission or external-state mutation and ran no test/build/package command.",
        "scope": "Complete 14-path RC06 material candidate against base 9b96269021c7363e2bb467c536df11ba0d8714d0; active plan and validation evidence; authoritative architecture, Domain, authorization, persistence, CLI, reliability and toolchain contracts; one-predicate ownership/export identity; CLI/Application ingress, both cancellation transitions, snapshot reconstruction, persistence typed-corruption/no-rewrite, redaction, schema and non-goal boundaries.",
        "reviewed_at": "2026-09-01 10:39:38+08:00",
        "evidence": "The reviewer ran exactly one read-only trace with ok=true, errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], state_bound=true and exact reviewed state git-sha1:ea7cb15f3277e65f1204c03e1566d231d3b28341; independently reproduced 12,486 canonical approval bytes and SHA-256 BBBB342ABB3BDB0AFFC1344D375C87E1D67A0F86C581282C2E50A529796DD910. It confirmed one implementation body in Domain, direct Application re-export/package identity, complete ingress/transition/snapshot/readback closure, read-only preflight corruption refusal, public STATE_CORRUPT mapping, retained invalid fixture text, and no schema/authorization/redaction/reliability/history/out-of-scope change. Its sole LOW finding was the missing exact one-byte direct Domain assertion required by V2.",
        "reviewed_state_id": "git-sha1:ea7cb15f3277e65f1204c03e1566d231d3b28341",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-RC06-A1-001",
            "severity": "LOW",
            "summary": "V2 lacked its required exact one-byte direct Domain acceptance assertion.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "parent_delta_review",
            "resolution": "Added only a one-byte minimum constant, exact TextEncoder byte-length assertion and direct Domain predicate acceptance assertion beside the existing 4,096-byte boundary in test/domain-unit.test.mjs; approval, execution contract, production code, scope and authority are unchanged.",
            "closure_evidence": "The parent independently reproduced the V2 criterion and missing line, applied the three-line mechanical test-only delta, and inspected the exact resulting diff. The post-repair static owner check still finds one predicate body; the focused Domain/export route passes 22/22 with artifact baseline 0-to-0; the complete pinned Node 24.19.0 verify:offline route passes 427/427, docs, dependency, 172-file package, SQLite and truthful blocked Codex gates at the same post-repair material state.",
            "closure_state_id": "git-sha1:6ab888669f1d227ca93cb57141a83b6d25eec323"
          }
        ]
      }
    },
    "audit_attempts": [],
    "validation_attempts": [
      {
        "validation_id": "V7",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-01 10:23:00+08:00",
        "evidence": "The first full route passed lint, typecheck, build, 427/427 tests, docs and dependency policy, then package smoke stopped before packing because the linked task worktree lacked its required local .pnpm-store. The failure changed no material file. A validated copy of only 133 regular cache files from the existing store, excluding all thirteen projects symlinks, plus an offline frozen install established the documented prerequisite; the complete route then passed under absolute Node 24.19.0.",
        "state_id": null
      },
      {
        "validation_id": "V7",
        "attempt": 2,
        "classification": "superseded",
        "at": "2026-09-01 10:39:38+08:00",
        "evidence": "The first accepted pinned-runtime full route passed at git-sha1:ea7cb15f3277e65f1204c03e1566d231d3b28341 but became stale when confirmed A1 LOW F-RC06-A1-001 added the exact one-byte direct Domain boundary assertion. The focused route and complete full route were rerun successfully at the parent-delta closure state recorded above.",
        "state_id": "git-sha1:ea7cb15f3277e65f1204c03e1566d231d3b28341"
      }
    ],
    "contract_revisions": [],
    "final_summary": "RC06 converges task.cancel cancellation reasons on one Domain-owned, well-formed NFC/no-Cc-or-Cf/1..4096-UTF-8-byte predicate across ingress, both cancellation transitions, snapshot decoding and persistence restart. Exact accepted bytes and redaction remain intact; malformed current stored values fail closed as typed corruption without mutation, normalization, repair, migration or schema change. Focused and complete offline validation pass at git-sha1:6ab888669f1d227ca93cb57141a83b6d25eec323, and fresh independent A1's sole LOW was closed by the permitted mechanical parent delta review with no A2 required."
  }
}
```

## Context

The earlier repair intentionally preserved noncanonical historical readback. RC06 is a new clean-slate decision that retires only that live compatibility rule while preserving its completed evidence. RC07 cannot start until RC06 is completed, integrated and pushed.
