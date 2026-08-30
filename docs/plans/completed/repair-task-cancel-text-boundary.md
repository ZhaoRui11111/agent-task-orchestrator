# ExecPlan：收敛 task.cancel 的 UTF-8 输入边界

本计划只修复 `task.cancel` 取消原因在公开 CLI 与 typed Application
service 之间的验证分裂。它不改变 Domain 状态机、已持久化快照的兼容
解码、schema、备份/恢复拓扑或任何 EP-02 能力。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-30 15:25:41+08:00",
    "updated_at": "2026-08-30 16:06:16+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user directive to execute the converged repairs serially through one goal",
        "at": "2026-08-30 15:45:56+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "current user execution directive plus the repository standing task-commit, manifest-prune, FF-only integration, and ordinary origin/master push grants",
        "at": "2026-08-30 15:45:56+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Make the ato.api/v1 task.cancel cancellation-reason contract exact and shared at both public CLI parsing and typed Application command ingress: a well-formed NFC string with no Unicode Cc/Cf code point and an encoded UTF-8 length from 1 through 4096 bytes is accepted, every value outside that predicate is rejected before runtime selection at CLI ingress and before trusted identity allocation or state access at direct Application ingress, valid multibyte boundary values persist and survive restart exactly, invalid values produce no request, decision, audit, Domain, registry, grant, or persistence mutation, output remains redacted, and existing persisted snapshot decoding remains backward compatible.",
    "non_goals": [
      "Do not change Task states, cancellation propagation, authorization scope selection, Domain cancellation eligibility, revision semantics, error-code/public-output tables, or redaction policy.",
      "Do not retroactively normalize, rewrite, reject, migrate, or claim canonicality for already persisted cancellation reasons; the repair applies to newly submitted CLI and Application task.cancel commands.",
      "Do not change Task body, identifier, path, timestamp, grant, or any other input bound, and do not add a second general validation framework.",
      "Do not change schema, migrations, SQLite transaction ownership, backup/restore/doctor behavior, runtime topology, filesystem helpers, artifact policy, or completed historical plans.",
      "Do not implement dispatcher, execution, completion, workspace, scheduler, adapter, MCP, EP-02, network, secret, PR, release, deployment, or cleanup behavior, and do not add or update dependencies."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "docs/reference/cli-contract.md remains the sole public owner of ato.api/v1 command grammar and the 1..4096 UTF-8 byte cancellation-reason bound; the Application parser independently enforces the same predicate so non-CLI callers cannot bypass or reinterpret it.",
        "source": "AGENTS.md; docs/reference/cli-contract.md Typed bounds; src/cli-api.ts; src/application.ts"
      },
      {
        "id": "C2",
        "statement": "Cancellation-reason length is encoded UTF-8 bytes, not JavaScript UTF-16 code units. Well-formedness, Unicode Cc/Cf rejection, and exact NFC equality are part of the same predicate at both ingresses.",
        "source": "docs/reference/cli-contract.md; observed cli-api safeToken/bytes implementation and application nonempty(record.reason, 256) mismatch"
      },
      {
        "id": "C3",
        "statement": "Malformed direct Application commands fail before trusted actor/time/ID providers and before any Application state read or durable write. A rejected reason returns the existing INVALID_INPUT shape with null public operation identities and creates no persisted denial record.",
        "source": "docs/reference/authorization-contract.md Application decision sequence; src/application.ts execute/parseCommand"
      },
      {
        "id": "C4",
        "statement": "This is a Tier-2 durable-state ingress repair because an accepted cancellation reason becomes non-rebuildable Domain state. The applicable transition lens is limited to one Application writer, the CLI/Application ingress closure, pre-mutation rejection, exact persisted readback/restart, and failure propagation; schema, lock, publication, topology, and recovery protocols are unchanged.",
        "source": "harness-exec-plan persistence audit; docs/reference/persistence-contract.md; src/application.ts; src/domain.ts"
      },
      {
        "id": "C5",
        "statement": "The Domain snapshot decoder retains its current historical compatibility rule. The new canonical predicate is a command-ingress guarantee, not a new database invariant and not authority to rewrite or reject existing rows.",
        "source": "docs/reference/domain-contract.md; docs/reference/persistence-contract.md writer and reader closure; src/domain.ts parseCancellation"
      },
      {
        "id": "C6",
        "statement": "The valid 4096-byte reason remains sensitive content: CLI success and failure envelopes, audit details, authorization records, and logs never serialize it, while persisted Domain readback may expose it only through existing trusted internal test/owner surfaces.",
        "source": "docs/reference/cli-contract.md Machine-readable output; docs/security/privacy-and-logging.md"
      },
      {
        "id": "C7",
        "statement": "Fresh independent A0 is required before activation, fresh independent A1 after the stable material diff, and every confirmed in-scope HIGH or MEDIUM repair requires fresh independent A2. The implementer cannot act as reviewer.",
        "source": "docs/plans/README.md; harness-exec-plan audit contract"
      },
      {
        "id": "C8",
        "statement": "The task uses only its coordinator-owned branch/worktree, task-owned plan/evidence/implementation paths, a terminal completed-plan commit, explicit manifest prune, exact-head gates, FF-only local integration, and the standing-authorized ordinary origin/master push. Cleanup remains unauthorized.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md; current user serial Goal directive"
      }
    ],
    "authorization": {
      "allowed": [
        "Read repository material and modify only declared task-owned paths in the coordinator-owned repair-task-cancel-text-boundary worktree.",
        "Create one cancellation-reason predicate owned by the Application input boundary and consumed by CLI parsing; reorder direct Application validation so malformed commands stop before trusted ingress or state access; preserve every unrelated input and Domain rule.",
        "Add CLI parser, direct Application, persisted restart-readback, redaction, malformed-input no-write, and existing-regression tests; run local restricted-network validation and package smoke routes.",
        "Create and move this task-owned ExecPlan through proposal, active, and completed states; use fresh sequential read-only independent A0/A1 and any required A2 reviewer without repository or external mutation by reviewers.",
        "Create task-owned commits, invoke pathless manifest-bound prune after the terminal result commit, record exact-head gates, perform coordinator FF-only local integration, and invoke the repository standing-authorized ordinary origin/master push after all prerequisites remain exact."
      ],
      "requires_reapproval": [
        "Any change to the 1..4096 UTF-8 byte public bound, Unicode predicate, error/public-output behavior, backward-compatible snapshot decoding, goal, non-goals, task-path envelope, external paths, persistence/schema guarantees, authorization, validation criteria, or required gate set.",
        "Any repair that changes Domain state semantics, persisted schema/data, another command family, another repository, or introduces a dependency, network access other than the standing ordinary push, secret/account use, PR, release, deployment, cleanup, force, reset, rebase, or stash."
      ],
      "prohibited": [
        "Rewrite existing cancellation facts, migrations, completed plans, historical evidence, external Projects, runtime/user data, dependencies, secrets, accounts, or coordinator state outside harness-git-flow commands.",
        "Use broad cleanup, reset, rebase, stash, force push, PR creation, release, deployment, schema repair, compatibility fallback, silent normalization, truncation, replacement-character decoding, or content reflection in output/audit.",
        "Treat an approved plan, valid CLI parse, ready Task, successful test, commit, or persisted grant as authorization for an adjacent filesystem, Git, network, or product action."
      ],
      "persistence": {
        "required": true,
        "action": "task-owned proposal/active/completed plan, evidence, implementation, test, and contract commits culminating in one terminal result commit, followed by manifest-bound prune, exact-head gate receipts, coordinator FF-only local integration, and the standing-authorized ordinary origin/master push",
        "source": "Current user serial Goal directive; AGENTS.md; docs/reference/local-agent-git-flow.md"
      }
    },
    "scope": {
      "task_paths": [
        {"path": "docs/plans/proposal/repair-task-cancel-text-boundary.md", "kind": "file"},
        {"path": "docs/plans/active/repair-task-cancel-text-boundary.md", "kind": "file"},
        {"path": "docs/plans/completed/repair-task-cancel-text-boundary.md", "kind": "file"},
        {"path": "docs/plans/evidence/repair-task-cancel-text-boundary", "kind": "directory"},
        {"path": "docs/reference/authorization-contract.md", "kind": "file"},
        {"path": "docs/reference/cli-contract.md", "kind": "file"},
        {"path": "src/application.ts", "kind": "file"},
        {"path": "src/cli-api.ts", "kind": "file"},
        {"path": "test/application-service.test.mjs", "kind": "file"},
        {"path": "test/cli-e2e.test.mjs", "kind": "file"},
        {"path": "test/cli-security.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "One independently reviewed approval/execution contract freezes the exact shared cancellation-reason predicate, pre-mutation behavior, backward-compatibility boundary, authorization, recovery, and validation surface.",
        "validation_ids": ["V1"]
      },
      {
        "id": "M2",
        "outcome": "CLI and typed Application command parsing consume one exact 1..4096 UTF-8 byte cancellation-reason predicate, and malformed direct commands stop before trusted ingress or state access without changing Domain snapshot compatibility.",
        "validation_ids": ["V2", "V3", "V4"]
      },
      {
        "id": "M3",
        "outcome": "Automated public CLI, direct Application, persistence readback/restart, legacy-reader compatibility, no-write, and redaction evidence proves valid multibyte boundaries, every invalid new-command class, and exact unchanged readback of one historically persistable new-invalid reason while existing unrelated behavior remains green.",
        "validation_ids": ["V2", "V3", "V4", "V5", "V6", "V7", "V8"]
      },
      {
        "id": "M4",
        "outcome": "Fresh independent implementation review, any required closure review, completed-plan state, terminal trace, manifest prune, and exact-head gates accept one clean material state ready for FF-only integration and ordinary push.",
        "validation_ids": ["V9", "V10"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "manual",
        "target": "Approval, scope, authorization, Tier-2 ingress guarantees, recovery, and activation readiness",
        "criterion": "Fresh independent A0 reports complete and ready_for_activation against the exact approval digest and reviewed material base, parent disposition is complete, and there are zero unresolved findings, schema errors, scope errors, or unapproved guarantees."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Direct Application cancellation-reason predicate, pre-ingress no-effect boundary, and historical persisted-reader compatibility",
        "criterion": "Targeted Application tests exit 0 and prove an NFC multibyte reason of exactly 4096 encoded UTF-8 bytes is accepted, persisted exactly, and survives close/reopen; empty, 4097-byte, Cc, Cf, non-NFC, and unpaired-surrogate values each return INVALID_INPUT with null operation identities before any trusted ingress callback, state read, request, decision, audit, Domain, registry, grant, or persistence mutation. The same route seeds one schema-v4 historical cancellation fact whose nonempty reason was accepted by the prior Application ingress but is invalid under the new predicate, closes and reopens it through the unchanged persistence/Application reader, asserts byte-for-byte unchanged readback without normalization or mutation, then submits the identical reason as a new command and proves INVALID_INPUT with the same complete no-effect boundary."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Public CLI parser byte, Unicode, and pre-runtime boundary",
        "criterion": "Targeted CLI parser/security tests exit 0 and accept cancellation reasons at 1 and exactly 4096 UTF-8 bytes, including a value whose UTF-16 length exceeds 256, while rejecting empty, 4097-byte, Cc, Cf, non-NFC, and unpaired-surrogate values as CLI_INVALID_INPUT before runtime selection; identifiers, bodies, paths, revisions, timestamps, and other command bounds remain unchanged."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "End-to-end CLI/Application/persistence parity and sensitive-content redaction",
        "criterion": "The source CLI end-to-end workflow cancels a Task with an exact 4096-byte NFC multibyte reason, exits 0, persists the exact reason visible only through trusted internal owner readback after restart, and neither human/JSON stdout nor stderr, decisions, nor audit details contain the reason."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Cancellation authorization, propagation, atomicity, and existing Domain behavior",
        "criterion": "All application-service, application-atomicity, CLI contract/security/E2E, and Domain tests exit 0 with no failure, skip, or todo; cross-Project cancellation, policy narrowing, stale revisions, terminal immutability, and injected transaction failure remain unchanged."
      },
      {
        "id": "V6",
        "type": "manual",
        "target": "Public/application contract ownership, compatibility, and capability truthfulness",
        "criterion": "The authoritative CLI and authorization contracts state one exact command-ingress predicate and its pre-mutation/no-write boundary, explicitly preserve historical snapshot compatibility, keep Domain and persistence ownership distinct, and introduce no implemented EP-02 or platform-support claim; repository Markdown links and fragments all resolve."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Static type, source-boundary, repository hygiene, and diff closure",
        "criterion": "Strict typecheck, build, lint, git diff --check, task-scope inventory, and exact staged inventory all exit 0 with no generated, forbidden, reparse, secret, out-of-scope, or whitespace member."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Complete restricted-network repository regression and package boundary",
        "criterion": "pnpm verify:offline exits 0 end to end at one material state, including every Node test, docs fragment check, dependency policy, package smoke, real Windows SQLite feasibility, Codex blocked-support boundary, zero download/repair, and no surviving .task-artifacts member."
      },
      {
        "id": "V9",
        "type": "manual",
        "target": "Fresh independent stable-diff implementation and closure review",
        "criterion": "Fresh independent A1 reports complete against the exact current material state and parent disposition is complete; every confirmed in-scope HIGH/MEDIUM finding is repaired, revalidated, and closed by a fresh independent A2, while eligible LOW handling satisfies the schema and no unresolved review blocker remains."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "Terminal ExecPlan, artifact, commit, and coordinator readiness",
        "criterion": "At the terminal candidate, the plan is at its declared completed lifecycle path with every milestone, validation, audit, state binding, and final-summary field coherent and current; the exact staged inventory contains only declared task-owned regular files, diff checks pass, one clean task-owned commit is eligible for manifest prune and exact-head coordinator gates, and .task-artifacts is absent."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "A byte/code-unit off-by-one can still reject contract-valid multibyte reasons or accept a 4097-byte value."},
      {"id": "R2", "risk": "Tightening the new-command predicate at a snapshot reader would turn legacy persisted data into corruption and break restart compatibility."},
      {"id": "R3", "risk": "CLI and Application can drift again if they retain parallel reason validators or constants."},
      {"id": "R4", "risk": "A malformed direct command can consume trusted identities or touch durable state if validation order remains coupled to operation identity allocation."},
      {"id": "R5", "risk": "Large sensitive boundary values can leak through output, audit, assertion, or diagnostic evidence."},
      {"id": "R6", "risk": "ExecPlan movement, base change, or review repair can stale approval/material evidence or move a path outside the frozen task envelope."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "The typed Application input owner exposes one internal cancellation-reason predicate implementing well-formed NFC, Cc/Cf rejection, and 1..4096 TextEncoder UTF-8 bytes; CLI reason validation calls that exact predicate rather than retaining a second reason-specific rule.",
        "rationale": "Application is the last trusted product command boundary and CLI already depends on it; one predicate closes both the 256-code-unit mismatch and direct-call bypass without a new module or dependency."
      },
      {
        "id": "D2",
        "statement": "Application execute parses and rejects an invalid command before calling any trusted ingress provider, then allocates operation identity only for a structurally and semantically valid command.",
        "rationale": "This makes malformed direct input observably pre-mutation and prevents trusted identity side effects from being confused with an accepted/denied operation."
      },
      {
        "id": "D3",
        "statement": "The Domain cancellation and snapshot decoders remain unchanged; the predicate is applied only to new task.cancel command ingress.",
        "rationale": "The current database has no canonical-reason schema invariant, so reader tightening or rewrite would be an unauthorized compatibility and persistence change."
      },
      {
        "id": "D4",
        "statement": "Boundary tests use encoded-byte constructions: NFC U+00E9 repeated 2048 times for exactly 4096 bytes, one additional ASCII byte for 4097, and explicit Cc/Cf/non-NFC/unpaired-surrogate cases.",
        "rationale": "Concrete multibyte vectors distinguish UTF-8 bytes from UTF-16 length and make the original mismatch deterministic."
      },
      {
        "id": "D5",
        "statement": "Implementation, audit, plan-state movement, terminal commit, manifest prune, gate, integration, and push steps remain serial within the current Goal.",
        "rationale": "The user explicitly requested Goal-based serial execution and predecessor terminal publication before the next repair."
      }
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep the plan in proposal and make no implementation edit until trace is coherent and fresh independent A0 is ready with complete parent disposition."},
      {"id": "M2", "recovery": "If predicate sharing or validation order changes another input/output contract, stop at the active plan, preserve the exact failing diff, and revise the approval contract before continuing."},
      {"id": "M3", "recovery": "On any boundary, restart, atomicity, or redaction failure, preserve the failing command/state evidence, change no persisted fixture outside task-owned tests, repair only within scope, and rerun every affected validation at the new material state."},
      {"id": "M4", "recovery": "Do not complete, commit terminal state, prune, integrate, or push while trace, independent review, current-state validation, artifact receipt, staged inventory, or reservation freshness is incomplete; retain the task worktree for correction."}
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
      {"id": "R1", "mitigation": "Use TextEncoder byte length in the sole predicate and assert 1, 4096 multibyte, and 4097 vectors at both ingresses.", "recovery": "Reject the candidate implementation and keep the plan active until both direct and end-to-end boundary tests pass at one material state."},
      {"id": "R2", "mitigation": "Do not edit Domain parseCancellation, persistence schema, migrations, or reader rules; prove exact restart readback both for a newly accepted boundary value and for one schema-v4 historical reason accepted by the prior Application ingress but rejected for new commands, with no normalization or rewrite.", "recovery": "If the historical fixture or any existing fixture becomes unreadable or changes on reopen, stop, restore the unchanged reader behavior within task scope, and rerun the complete application/persistence suite."},
      {"id": "R3", "mitigation": "Make CLI import the Application-owned predicate and test source/runtime parity.", "recovery": "If review finds a second reason-specific validator or bound, consolidate it before A1 closure without widening to another command family."},
      {"id": "R4", "mitigation": "Return on parseCommand failure before operationIdentity and instrument an ingress whose callbacks fail the test if invoked.", "recovery": "Keep the rejected-command state snapshot and repair ordering before any authorization or persistence validation is accepted."},
      {"id": "R5", "mitigation": "Use redaction assertions against stdout/stderr/decision/audit and avoid embedding the full boundary value in plan evidence.", "recovery": "Treat any reflection as an input-security failure, remove the reflection at its existing output owner, and rerun CLI/security/package routes."},
      {"id": "R6", "mitigation": "Use exec_plan trace/state for every state-bound write, move only between the three declared lifecycle paths, assess any base transition, and refresh material validation/review after every diff-changing repair.", "recovery": "Stop at the last coherent plan state; do not reuse stale validation or review, and require fresh A0 if approval changes or base impact is uncertain."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "9ad68caa2160fc8679e15cf9304ef75b784bfc60",
      "current_material_base": "9ad68caa2160fc8679e15cf9304ef75b784bfc60",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-08-30 15:45:56+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-08-30 15:56:41+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-08-30 15:56:41+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-08-30 16:06:16+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Obtain a fresh independent A0 after repairing the first review's historical-reader validation gap, and bind readiness to the exact revised canonical approval bytes, digest, and material base.",
        "evidence": "Fresh independent A0 attempt 2 at 2026-08-30 15:45:03+08:00 independently recomputed 15543 canonical approval bytes and SHA-256 1783F981D260BC49D00273833C17A39CA4482F13D4CD02088518B53695233EB3 at reviewed base 9ad68caa2160fc8679e15cf9304ef75b784bfc60; trace had empty errors, warnings, outside_scope, overlap, and pre_existing_dirty; F-A0-01 was materially closed, findings were empty, and readiness was ready_for_activation.",
        "state_id": "approval-sha256:1783F981D260BC49D00273833C17A39CA4482F13D4CD02088518B53695233EB3"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Run the public targeted Application/CLI wrapper with exact UTF-8 constructions, a persistence reopen, a schema-v4 historical-row seed, an inaccessible-store proxy, and instrumented trusted ingress.",
        "evidence": "The targeted route passed 31/31. U+00E9 repeated 2048 times encoded to exactly 4096 bytes, exceeded the former 256-code-unit bound, was accepted and survived close/reopen exactly. Empty, 4097-byte, Cc, Cf, non-NFC, and unpaired-surrogate reasons each returned INVALID_INPUT with null identities and zero ingress or store access. A prior-ingress-valid non-NFC reason was written into a valid schema-v4 cancelled Task, reopened byte-for-byte unchanged, and an identical new command was rejected with zero ingress and an exactly unchanged combined state.",
        "state_id": "git-sha1:136e54b3b8111e107d717b41ada402aeb47bc3c7"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Run CLI parser/security tests for 1-byte, exact 4096-byte multibyte, 4097-byte, Cc, Cf, non-NFC, and unpaired-surrogate cancellation reasons, including an absent runtime-root probe.",
        "evidence": "The parser accepted one byte and exact 4096 UTF-8 bytes, preserving the exact reason, and rejected every invalid class as CLI_INVALID_INPUT. The spawned 4097-byte command exited 2, reflected no reason, and left the selected trusted runtime root absent, proving rejection before runtime selection or creation.",
        "state_id": "git-sha1:136e54b3b8111e107d717b41ada402aeb47bc3c7"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Run the source CLI end-to-end workflow with exact 4096-byte cancellation reasons in JSON and human modes, then reopen through the trusted internal owner before continuing backup/restore.",
        "evidence": "The source CLI workflow passed. Both output modes exited 0 without reflecting the reason and stderr remained empty. Trusted owner readback after restart returned the exact 4096-byte value for both cancelled Tasks, while request, decision, and audit serialization contained none of it; the subsequent backup, restore, restart, status, and doctor path stayed green.",
        "state_id": "git-sha1:136e54b3b8111e107d717b41ada402aeb47bc3c7"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Run application-service, application-atomicity, CLI contract/security/E2E, and all Domain architecture/unit/property-state-machine tests together through the public wrapper.",
        "evidence": "All 140 affected regression tests passed with fail=0, skipped=0, and todo=0. Cross-Project cancellation, revoked/expired scope, disabled policy, substituted roots, stale revisions, terminal immutability, failpoint rollback, randomized Domain invariants, and exact public envelopes remained unchanged; artifact hygiene finished absent-to-absent.",
        "state_id": "git-sha1:136e54b3b8111e107d717b41ada402aeb47bc3c7"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Run the repository documentation checker and manually compare CLI, Application, Domain, and persistence ownership statements against the implemented boundary.",
        "evidence": "docs:check passed 72 Markdown files, 241 exact-case local links, 21 fragments, and forbidden=0. The CLI contract owns the exact public predicate; authorization documents pre-ingress rejection and unchanged historical reading; no schema, Domain decoder, persistence-owner, EP-02, platform-support, or runtime capability claim changed.",
        "state_id": "git-sha1:136e54b3b8111e107d717b41ada402aeb47bc3c7"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Run strict typecheck, declaration build, repository lint, git diff --check, exact trace scope closure, and external artifact-root observation.",
        "evidence": "TypeScript 5.9.3 typecheck and build exited 0; lint passed 148 files and 20 source files; git diff --check exited 0 apart from informational checkout line-ending notices. Trace reported errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[] with exactly seven material paths, and the fixed .task-artifacts root was absent.",
        "state_id": "git-sha1:136e54b3b8111e107d717b41ada402aeb47bc3c7"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Run pnpm verify:offline with the frozen bundled Node 24.19.0/pnpm 11.19.0 toolchain and task-local offline store.",
        "evidence": "The complete restricted-network gate exited 0: lint, typecheck, build, 282/282 Node tests, docs 72/241/21, zero production dependencies, package smoke with 83 files, Windows SQLite 3.53.3 feasibility with zero surviving generation members, and the truthful Codex externalE2E=not_run/supportClaim=false boundary all passed. No dependency download or repair occurred and .task-artifacts was absent.",
        "state_id": "git-sha1:136e54b3b8111e107d717b41ada402aeb47bc3c7"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Obtain a fresh independent read-only A1 over the complete stable task diff, direct Application/CLI/Domain/persistence adjacency, exact validation evidence, and current trace.",
        "evidence": "Fresh independent A1 at 2026-08-30 16:03:59+08:00 reported findings=[] at exact state git-sha1:136e54b3b8111e107d717b41ada402aeb47bc3c7. It confirmed the single Application-owned predicate, CLI pre-runtime use, direct pre-identity/pre-state rejection, unchanged Domain/persistence historical reader, exact schema-v4 noncanonical reopen, authorization/atomicity/redaction closure, internal-only export, and scope truthfulness. Its independent bounded route passed 31/31 from absent to absent; no A2 is required.",
        "state_id": "git-sha1:136e54b3b8111e107d717b41ada402aeb47bc3c7"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "Stage only the complete declared terminal candidate, inspect cached and worktree inventories, run cached diff checking, move the sole lifecycle plan from active to completed, and require an exact completion-ready trace before the terminal commit.",
        "evidence": "The pre-terminal staged inventory contained exactly eight declared task-owned regular files: one lifecycle plan addition and seven modified contract, source, and test files. git diff --cached --check exited 0; unstaged and untracked inventories were empty; ignored node_modules, .pnpm-store, dist, and generated runtime material were excluded; .task-artifacts was absent. After the sole plan path moved to completed and was restaged, the exact trace must retain errors=[], warnings=[], outside_scope=[], overlap=[], completion_ready=true at git-sha1:136e54b3b8111e107d717b41ada402aeb47bc3c7 before commit, manifest prune, exact-head gates, FF-only integration, and ordinary push.",
        "state_id": "git-sha1:136e54b3b8111e107d717b41ada402aeb47bc3c7"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/a0_artifact_concurrency",
        "independence": "Fresh, read-only review from current repository and skill authority; reviewer did not author the proposal or make its substantive decisions, made no repository, Git, coordinator, or external-state mutation, and granted no authority.",
        "scope": "Activation-readiness audit of the sole revised proposal, its complete approval and execution contract, current trace, repository and harness authority, relevant Application, CLI, Domain, and persistence source, and applicable tests.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-30 15:45:03+08:00",
        "approval_sha256": "1783F981D260BC49D00273833C17A39CA4482F13D4CD02088518B53695233EB3",
        "evidence": "The fresh trace exited 0 with errors=[], warnings=[], outside_scope=[], overlap=[], and pre_existing_dirty=[] at state git-sha1:4db428901553ee7351e2706d650bab254ab12486. Independent canonical serialization produced 15543 UTF-8 bytes and the exact approval digest. F-A0-01 is materially closed because V2 now requires a prior-ingress-valid/new-command-invalid schema-v4 fact, exact unchanged close/reopen through the historical reader, and no-effect rejection of the identical new command; M3 and R2 freeze the matching outcome and recovery. The reviewer found the plan coherent and implementable within declared scope without a production reader or schema change.",
        "parent_disposition": "complete",
        "reviewed_material_base": "9ad68caa2160fc8679e15cf9304ef75b784bfc60",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/a1_artifact_concurrency",
        "independence": "Fresh independent read-only A1; reviewer did not implement or repair this change, edited no repository file, changed no Git, index, ref, coordinator, or external state, granted no authority, and used only creator-cleaned bounded test fixtures.",
        "scope": "The active ExecPlan, all seven material paths, complete task diff, repository authority, recorded validation, and adjacent Application, CLI, package-export, Domain, schema-v4 persistence-reader, authorization, cancellation-propagation, atomicity, and redaction owners.",
        "reviewed_at": "2026-08-30 16:03:59+08:00",
        "evidence": "Trace exactly matched approval SHA256 1783F981D260BC49D00273833C17A39CA4482F13D4CD02088518B53695233EB3, base and HEAD 9ad68caa2160fc8679e15cf9304ef75b784bfc60, and state git-sha1:136e54b3b8111e107d717b41ada402aeb47bc3c7 with empty errors, warnings, outside_scope, overlap, and pre_existing_dirty. The reviewer verified exact Unicode and byte semantics, CLI pre-runtime rejection, Application pre-identity and pre-state rejection, unchanged historical decoding, schema-v4 exact reopen, redaction, authorization and atomicity, internal-only export, and all recorded evidence; its bounded public route passed 31/31 with .task-artifacts absent before and after.",
        "reviewed_state_id": "git-sha1:136e54b3b8111e107d717b41ada402aeb47bc3c7",
        "parent_disposition": "complete",
        "closes": [],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-A0-01"],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-08-30 15:37:46+08:00 bound approval digest 153860509A698ADAC84C1CD220EAB1C446952DE923C982066D31F6F27706454B and confirmed one MEDIUM contract gap: the plan promised backward-compatible historical cancellation-reason decoding but every binary restart criterion covered only a reason valid under the new predicate. The parent accepted F-A0-01 and added exact persisted close/reopen evidence for a prior-ingress-valid/new-command-invalid reason plus rejection of an identical new command without effects. Fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "activated",
        "reason": "Fresh independent A0 at 2026-08-30 15:45:03+08:00 bound canonical approval digest 1783F981D260BC49D00273833C17A39CA4482F13D4CD02088518B53695233EB3 and reviewed base 9ad68caa2160fc8679e15cf9304ef75b784bfc60, confirmed F-A0-01 materially closed, reported no finding, and found the revised repair contract ready_for_activation. The parent accepted the report and activated implementation."
      }
    ],
    "validation_attempts": [],
    "contract_revisions": [
      {
        "at": "2026-08-30 15:40:30+08:00",
        "summary": "After A0 finding F-A0-01, added binary schema-v4 historical-reader compatibility coverage for one prior-ingress-valid/new-command-invalid cancellation reason, including exact unchanged close/reopen readback and no-effect rejection of an identical new command, without changing reader or schema scope.",
        "previous_approval_sha256": "153860509A698ADAC84C1CD220EAB1C446952DE923C982066D31F6F27706454B"
      }
    ],
    "final_summary": "The task.cancel text boundary is converged: the Application owns one well-formed NFC, no-Cc/Cf, 1..4096 UTF-8 byte predicate consumed by CLI parsing; malformed direct commands stop before trusted ingress and state access; exact multibyte limits persist and remain redacted; historical noncanonical schema-v4 cancellation reasons still reopen byte-for-byte through the unchanged Domain/persistence reader; affected authorization, propagation, atomicity, full offline, and independent A1 evidence all pass without changing schema, Domain semantics, or EP-02 capability claims."
  }
}
```

## Context

At base `9ad68caa2160fc8679e15cf9304ef75b784bfc60`, the CLI contract and
`src/cli-api.ts` accept a cancellation reason only when it is well formed,
contains no `Cc`/`Cf` code point, is already NFC, and encodes to 1..4096 UTF-8
bytes. `src/application.ts` instead accepts only 1..256 JavaScript code units
and rejects only NUL. Consequently, a contract-valid CLI value can pass parsing,
open the runtime, and then fail as Application `INVALID_INPUT`, while a direct
Application caller can submit noncanonical or format/control content. The
repair makes this a new-command ingress invariant only; existing Domain snapshot
decoding remains deliberately unchanged.
