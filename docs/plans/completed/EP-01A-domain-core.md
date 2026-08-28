# ExecPlan：实现 EP-01A 纯 TypeScript Domain Core

本计划把已接受的 Project/Task 领域契约实现为确定性、无副作用的 TypeScript 核心，并以独立审查、状态机证据和完整离线回归约束其边界。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-28 21:40:02+08:00",
    "updated_at": "2026-08-29 00:58:41+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "User delegation for EP-01A in primary thread 01a04892-f0d5-7be2-b293-c5f7506db812",
        "at": "2026-08-28 21:40:02+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "User delegation authorizing one local terminal task commit after completion-ready gates",
        "at": "2026-08-28 21:40:02+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Implement and truthfully expose a deterministic, side-effect-free TypeScript Domain Core that enforces the complete authoritative Project/Task state, hierarchy, dependency, eligibility, waiting-continuation, terminal-immutability, revision, structured-error, and structured-event semantics; prove it with exhaustive, randomized state-machine, architecture, package, documentation, and full offline regression evidence; then create one terminal task commit and, after exact-head gates pass, complete coordinator ready and FF-only local integration.",
    "non_goals": [
      "Do not implement SQLite schema, migration, repository, audit persistence, backup, restore, or any other EP-01B persistence behavior.",
      "Do not implement claim, lease, fencing, idempotency, dispatcher, durable intent, publication, reconciliation, retry ownership, or crash recovery behavior assigned to EP-02 or later work.",
      "Do not implement Workspace, Completion, Codex, Scheduler, MCP, DQuant, CLI product commands, adapters, or external side effects.",
      "Do not change the frozen Node, pnpm, TypeScript, registry, install-script, or zero-production-dependency policy.",
      "Do not treat ExecPlan audits, maintainer Git-flow state, authorization, resources, adapters, or execution claims as runtime Task states or domain eligibility inputs.",
      "Do not push EP-01A, open a pull request, release, deploy, use network outside the exact authorized npmjs.org TypeScript 5.9.3 frozen install and separate production vulnerability audit, use secrets, mutate D:\\quant or another repository, or perform destructive cleanup."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "The exact six Task states, transition relation, terminal immutability, Project binding, hierarchy, dependency, eligibility, waiting, and Task revision semantics remain owned by docs/reference/domain-contract.md; implementation and tests consume that owner without creating a second normative contract.",
        "source": "AGENTS.md authority order; ARCHITECTURE.md ownership and dependency direction; docs/reference/domain-contract.md"
      },
      {
        "id": "C2",
        "statement": "Domain production code may depend only on TypeScript/JavaScript language and runtime primitives and must be deterministic and side-effect-free; the one caller-supplied immutable read snapshot and its opaque read-revision label, time, identity, authorization/reliability results required by transitions, and other external facts are explicit inputs, but Domain Core does not judge generic snapshot freshness or CAS conflicts.",
        "source": "ARCHITECTURE.md cross-module dependency constraints and current user EP-01A boundary"
      },
      {
        "id": "C3",
        "statement": "Project parent hierarchy and dependency DAG remain separate: parent is same-Project single-parent acyclic grouping only, while dependencies may cross Projects, reject self/duplicate/cycle edges, and only completed prerequisites satisfy execution dependency.",
        "source": "docs/reference/domain-contract.md parent hierarchy and dependency DAG"
      },
      {
        "id": "C4",
        "statement": "Ordinary domain eligibility is exactly ready state plus registered enabled Project plus all direct dependencies completed in one caller-supplied immutable read snapshot; the decision echoes that snapshot's opaque read-revision label without interpreting freshness, while parent, authorization, resources, adapters, and claims do not enter the predicate and waiting is never dispatcher-eligible.",
        "source": "docs/reference/domain-contract.md domain eligibility and waiting continuation; current user EP-01A boundary"
      },
      {
        "id": "C5",
        "statement": "Waiting resume and retry fail closed on incomplete metadata, waiting_task_revision not equal to the current Task revision supplied by the continuation command, stale or mismatched required-action receipt, disabled or missing Project, incomplete dependency, identity mismatch, non-retryable state, or early retry, while resume preserves every recorded non-null execution/workspace/backend-thread identity; no generic expected-revision or CAS rule is added.",
        "source": "docs/reference/domain-contract.md waiting taxonomy and waiting resume/retry eligibility"
      },
      {
        "id": "C6",
        "statement": "Every successful Task mutation increments that Task revision by exactly one, every rejected or no-op command leaves all caller and returned state unchanged, and a direct prerequisite cancellation moves only ready direct dependents to dependency_cancelled waiting in the same pure logical operation.",
        "source": "docs/reference/domain-contract.md dependency DAG and Task revision; current user EP-01A acceptance criteria"
      },
      {
        "id": "C7",
        "statement": "The public package surface remains narrow and truthful: implemented Domain Core behavior may be claimed, but persistence, dispatcher, adapter, scheduler, MCP, orchestration runtime, platform support, hosted CI, release, and Codex support remain unimplemented or unverified as applicable.",
        "source": "AGENTS.md capability truthfulness; docs/reference/toolchain-contract.md; docs/reference/validation-policy.md; current user EP-01A boundary"
      },
      {
        "id": "C8",
        "statement": "The implementation adds no production dependency and uses the exact current Node 24.19.0, pnpm 11.19.0, TypeScript 5.9.3 ESM/NodeNext toolchain and local validation entry points.",
        "source": "docs/reference/toolchain-contract.md and current user authorization"
      },
      {
        "id": "C9",
        "statement": "EP-01A begins exactly at the unique EP-00B terminal commit fdac1101e539a26957847a589d0a7c3a5dbc37c2, and strict predecessor/successor chain evidence must remain valid through the terminal EP-01A plan.",
        "source": "User coordinator handoff; docs/plans/README.md; harness-exec-plan terminal-resolve, historical scope, and chain-check evidence"
      },
      {
        "id": "C10",
        "statement": "All development occurs only in coordinator-owned task/ep-01a at D:\\agent-task-orchestrator\\.worktrees\\ep-01a; coordinator mutations use fresh trace and single-use CAS, reserve precedes final review, exact-head receipts use the ten frozen gates, and local integration is FF-only with no EP-01A push or cleanup.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md; user coordinator handoff"
      },
      {
        "id": "C11",
        "statement": "Fresh independent A0 is required before activation, fresh independent A1 is required for the stable task diff, and every confirmed in-scope HIGH or MEDIUM repair requires fresh independent A2; implementer self-review cannot substitute.",
        "source": "docs/plans/README.md; harness-exec-plan A0-AUDIT.md and IMPLEMENTATION-AUDIT.md; current user instruction"
      },
      {
        "id": "C12",
        "statement": "EP-01A changes no runtime persistence, artifact, cache, publication, resume, or concurrent-writer boundary; the ExecPlan persistence action is only the separately authorized terminal repository commit, so the persistence audit lens remains Tier 0 unless scope actually changes.",
        "source": "Current user EP-01A non-goals and harness-exec-plan PERSISTENCE-AUDIT.md"
      }
    ],
    "authorization": {
      "allowed": [
        "Read and edit only EP-01A task-owned paths in the canonical task worktree.",
        "Run local targeted and full offline validation without secrets; use https://registry.npmjs.org/ only to install the exact lockfile-bound TypeScript 5.9.3 into the task-local store and to run the separate production dependency vulnerability audit authorized by the user on 2026-08-29.",
        "Use independent read-only reviewers for A0, A1, and required A2 evidence.",
        "Reserve integration before the final review sequence using fresh coordinator trace/CAS.",
        "Stage only task-owned files and create one local terminal task commit after completion-ready evidence.",
        "Record the ten real exact-head gate results, transition EP-01A to ready, and perform FF-only local integration."
      ],
      "requires_reapproval": [
        "Any change to the goal, authoritative domain semantics, task path envelope, required gate set, validation criterion, toolchain/dependency policy, external path set, or terminal persistence action.",
        "Any implementation of persistence, concurrency, dispatcher, adapter, workspace, scheduler, MCP, CLI product command, external-effect, or additional runtime capability.",
        "Any network beyond the exact npmjs.org frozen dependency install and production vulnerability audit, or any secret, external account, another repository, D:\\quant, push, pull request, release, deployment, destructive cleanup, force, rebase, stash, reset, or clean action."
      ],
      "prohibited": [
        "Developing or editing files in the integration-only master checkout.",
        "Hand-writing coordinator state, adopting another branch/worktree, upgrading the v1 coordinator, adding an artifact manifest, or using pruning for this null-policy task.",
        "Claiming blocked or not-run validation as passed, weakening a binary criterion, or substituting targeted tests for the full offline gate.",
        "Using network outside the exact npmjs.org frozen dependency install and production vulnerability audit, or using secrets, external accounts, D:\\quant or another repository, EP-01A push, PR, release, deployment, destructive cleanup, force, rebase, stash, reset, or clean."
      ],
      "persistence": {
        "required": true,
        "action": "Create one local terminal task commit containing the completed EP-01A ExecPlan and exact task-owned implementation/evidence after completion-ready; then record exact-head gates, ready, and FF-only local integration without push.",
        "source": "Current user coordinator handoff and docs/plans/README.md terminal persistence rule"
      }
    },
    "scope": {
      "task_paths": [
        {
          "path": "AGENTS.md",
          "kind": "file"
        },
        {
          "path": "ARCHITECTURE.md",
          "kind": "file"
        },
        {
          "path": "CHANGELOG.md",
          "kind": "file"
        },
        {
          "path": "README.md",
          "kind": "file"
        },
        {
          "path": "docs/compatibility/v0.1.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/active/EP-01A-domain-core.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/completed/EP-01A-domain-core.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/evidence/EP-01A",
          "kind": "directory"
        },
        {
          "path": "docs/plans/proposal/EP-01A-domain-core.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/contract-ownership.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/domain-contract.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/toolchain-contract.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/validation-policy.md",
          "kind": "file"
        },
        {
          "path": "package.json",
          "kind": "file"
        },
        {
          "path": "scripts/codex-contract.mjs",
          "kind": "file"
        },
        {
          "path": "scripts/lint.mjs",
          "kind": "file"
        },
        {
          "path": "scripts/package-smoke.mjs",
          "kind": "file"
        },
        {
          "path": "src/domain.ts",
          "kind": "file"
        },
        {
          "path": "src/index.ts",
          "kind": "file"
        },
        {
          "path": "test/domain-architecture.test.mjs",
          "kind": "file"
        },
        {
          "path": "test/domain-property-state-machine.test.mjs",
          "kind": "file"
        },
        {
          "path": "test/domain-unit.test.mjs",
          "kind": "file"
        },
        {
          "path": "test/scaffold.test.mjs",
          "kind": "file"
        }
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "The unique schema-v3 plan has exact EP-00B predecessor evidence, fresh independent A0 activation evidence, frozen scope/authorization/gates, and a recoverable Domain Core design that preserves all owner boundaries.",
        "validation_ids": [
          "V1"
        ]
      },
      {
        "id": "M2",
        "outcome": "The public package exposes immutable Project/Task values, all six states, exact transition commands, structured deterministic errors/events, terminal facts, and exactly-once Task revision mutation semantics without I/O or infrastructure imports.",
        "validation_ids": [
          "V2",
          "V4",
          "V5"
        ]
      },
      {
        "id": "M3",
        "outcome": "Pure atomic operations enforce same-Project acyclic parent forests, cross-Project acyclic dependency DAGs, direct cancellation behavior, completed-only dependency satisfaction, and the exact ready-only eligibility predicate over one caller-supplied immutable read snapshot.",
        "validation_ids": [
          "V2",
          "V3",
          "V4"
        ]
      },
      {
        "id": "M4",
        "outcome": "Waiting metadata and explicit resume/retry decisions fail closed on every contract-owned freshness, action, Project, dependency, identity, retry, and time condition, while ordinary eligibility cannot wake waiting Tasks.",
        "validation_ids": [
          "V2",
          "V3"
        ]
      },
      {
        "id": "M5",
        "outcome": "Deterministic exhaustive and seeded randomized tests prove legal and illegal histories, graph and waiting invariants, boundary inputs, public exports, no-I/O dependency direction, and non-regression of the frozen package/toolchain/SQLite/Codex blocked boundary.",
        "validation_ids": [
          "V2",
          "V3",
          "V4",
          "V5",
          "V6",
          "V8",
          "V9",
          "V10"
        ]
      },
      {
        "id": "M6",
        "outcome": "Current documentation states only the implemented Domain Core capability and retained non-capabilities; stable-diff A1 and any required A2 close; all binary evidence binds the final material state; the task-owned terminal commit is ready for exact-head coordinator gates and FF-only local integration.",
        "validation_ids": [
          "V1",
          "V7",
          "V10"
        ]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "ExecPlan lifecycle, predecessor chain, scope, independent review, completion readiness, and terminal persistence",
        "criterion": "terminal-resolve identifies fdac1101e539a26957847a589d0a7c3a5dbc37c2 as the unique EP-00B terminal commit; historical scope at that exact commit has no completion blocker; strict chain-check accepts EP-01A as the immediate successor; current trace reports schema v3 with exact scope, no error/warning/outside-scope or stale evidence, fresh independent A0 and A1, required A2 closure-safe, every milestone and validation successful, a nonempty final summary, and no lifecycle-derived blocker before the one task commit."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Exact Domain Core state, mutation, hierarchy, dependency, eligibility, waiting, error, event, and boundary behavior",
        "criterion": "The dedicated domain unit command exits 0 and proves every legal transition edge succeeds, every other pair and same-state transition fails, terminal facts cannot mutate in place, successful Task mutations increment exactly once, rejected/no-op commands increment nothing, all specified parent/dependency/eligibility/waiting positive and negative cases pass, public structured inputs fail closed, and caller-owned inputs are never mutated."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Deterministic property and state-machine histories",
        "criterion": "The dedicated property/state-machine command exits 0 for documented fixed seeds and exhaustive transition pairs, exercises both accepted and rejected randomized command histories, continuously checks state membership, exact revisions, terminal immutability, waiting envelope/revision coherence, parent forest, dependency DAG, and dependency-cancellation invariants, and reports the seed and minimal command prefix on failure."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Public exports, module dependency direction, determinism, and no-I/O seam",
        "criterion": "The dedicated domain architecture command exits 0 and proves the exact root Domain Core export inventory, zero production dependency, domain source imports no application/persistence/dispatcher/ports/adapters/Codex/Git/CLI/MCP/scheduler/observability/maintainer module, import/evaluation performs no filesystem/process/network/time/random side effect, and repeated equal inputs produce deeply equal outputs without mutating inputs."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Strict TypeScript API and implementation correctness",
        "criterion": "pnpm typecheck exits 0 under the exact NodeNext strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, isolatedModules, and noEmit configuration with no diagnostic."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Repository/source inventory, frozen configuration, and whitespace hygiene",
        "criterion": "pnpm lint and git diff --check exit 0 against the complete candidate inventory, recognizing exactly the intended Domain Core source files and no forbidden, generated, sensitive, reparse, configuration-drift, vendor-coupled, or whitespace artifact."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Documentation links, authority uniqueness, and capability truthfulness",
        "criterion": "pnpm docs:check exits 0; every repository-relative link resolves with exact case; manual authority review finds no copied or conflicting domain rule; manual capability review confirms only the validated Domain Core is newly implemented while persistence, dispatcher, adapters, scheduler, MCP, orchestration runtime, platform support, hosted CI, and release remain unclaimed."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Frozen dependency and install policy",
        "criterion": "pnpm dependency:check exits 0 with zero production dependencies, exactly TypeScript 5.9.3 as the only development dependency, exact lockfile/registry/install-script policy, and no credential-shaped configuration; the result does not depend on the separately authorized online production vulnerability audit, whose evidence is supplemental."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Declared package distribution and consumer-visible Domain Core surface",
        "criterion": "pnpm package:smoke exits 0 offline after packing the exact expected dist inventory, installing it into a disposable consumer, importing and executing the public Domain Core/status surface, invoking the non-product ato status console, and uninstalling without surviving package artifacts."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "Complete offline repository regression including Domain Core, build, docs, dependency, package, SQLite, and Codex boundaries",
        "criterion": "A frozen worktree-local dependency install followed by pnpm verify:offline exits 0 and includes lint, typecheck, build, the complete Node test suite, docs, dependency shape, package smoke, real Windows SQLite feasibility, and the fail-closed Codex blocked/no-support boundary; targeted tests do not substitute for this result and no temporary artifact survives."
      }
    ],
    "risks": [
      {
        "id": "R1",
        "risk": "A convenient transition or mutation API could silently broaden or omit the authoritative state table, terminal facts, or exactly-once revision rules."
      },
      {
        "id": "R2",
        "risk": "Hierarchy and dependency graph checks could be non-atomic, conflate the two edge types, miss multi-hop cycles, or propagate cancellation beyond ready direct dependents."
      },
      {
        "id": "R3",
        "risk": "Eligibility or waiting continuation could accidentally consume parent, authorization, resource, clock, or stale identity facts and thereby wake ineligible work."
      },
      {
        "id": "R4",
        "risk": "Mutable caller objects, ambient time/randomness, I/O, or infrastructure imports could make domain results nondeterministic or violate inward dependency direction."
      },
      {
        "id": "R5",
        "risk": "Randomized tests could be irreproducible or exercise only happy paths, leaving illegal histories and invariant drift undetected."
      },
      {
        "id": "R6",
        "risk": "Replacing scaffold-only package assumptions could break lint, package inventory, Codex isolation, documentation truthfulness, or the full EP-00B feasibility gate."
      },
      {
        "id": "R7",
        "risk": "Plan, coordinator, staged inventory, exact-head gate, commit, or integration evidence could become stale or cross the task authorization boundary."
      }
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Implement one public src/domain.ts owner re-exported by src/index.ts, using readonly discriminated values and explicit pure operations that return structured success/error results plus structured events instead of performing I/O or throwing infrastructure exceptions.",
        "rationale": "One production domain owner keeps the finite state sets and invariant logic discoverable, prevents cross-module dependencies, and gives JavaScript and TypeScript consumers one narrow testable surface."
      },
      {
        "id": "D2",
        "statement": "Represent a DomainSnapshot as immutable Project/Task collections. Read predicates accept and echo a caller-supplied opaque read-revision label so all facts are explicitly bound to one snapshot; mutations return a new frozen snapshot, apply only domain-owned Task revision creation/increment rules, leave caller-owned input untouched, and neither interpret a global snapshot identity nor perform generic expected-revision/CAS validation.",
        "rationale": "This proves same-read-revision decisions and exactly-once Task mutation semantics without importing the reliability owner's generic revision-CAS behavior."
      },
      {
        "id": "D3",
        "statement": "Drive transitions by the authoritative domain event plus exact target state and event-specific explicit facts; validate every runtime input, and model external authorization/reliability/completion/interruption facts only as caller-supplied transition preconditions, never as owned eligibility judgments.",
        "rationale": "The shape supports exhaustive legal/illegal pair testing while preserving ownership boundaries around external decisions."
      },
      {
        "id": "D4",
        "statement": "Store parent separately from a sorted unique dependency list, evaluate proposed parent/dependency changes against the full supplied snapshot before returning any change, and update waiting_task_revision whenever an allowed mutation leaves a Task waiting.",
        "rationale": "Pure all-or-error snapshot transforms express atomic graph checks and waiting-envelope reacceptance without inventing storage transactions."
      },
      {
        "id": "D5",
        "statement": "On a transition to cancelled, require complete deterministic dependency_cancelled waiting metadata for each affected ready direct dependent and return all target/dependent changes in one success result; all other dependents remain unchanged.",
        "rationale": "The command can implement the contract's same-logical-command direct behavior without ambient policy, time, or whole-graph propagation."
      },
      {
        "id": "D6",
        "statement": "Use explicit integer instants and the exact current-Task-revision/action/identity facts required by the waiting continuation predicate; ordinary eligibility and continuation remain separate public functions and return deterministic reason sets for ineligible but structurally valid inputs, without a generic snapshot or mutation CAS precondition.",
        "rationale": "Explicit values make early retry, stale receipt, and identity mismatch testable without a clock or backend dependency."
      },
      {
        "id": "D7",
        "statement": "Keep runtime persistence semantics at Tier 0; use committed evidence files only for predecessor, validation, audit, and terminal-plan recovery, and do not introduce caches, artifacts, publication, or concurrent writers.",
        "rationale": "EP-01A is a pure in-memory domain library; repository evidence and the terminal task commit do not expand the product persistence boundary."
      }
    ],
    "milestone_recovery": [
      {
        "id": "M1",
        "recovery": "Keep the unique plan in proposal and make no product edit if predecessor, schema, scope, authorization, or independent A0 is not exact."
      },
      {
        "id": "M2",
        "recovery": "Revert only task-owned uncommitted Domain Core/status changes through explicit patches, preserving the proposal and evidence; do not use reset, stash, clean, or another worktree."
      },
      {
        "id": "M3",
        "recovery": "Stop at the last unit-tested pure snapshot transform, retain failing minimal graph input, and repair within the same owner without adding persistence or application behavior."
      },
      {
        "id": "M4",
        "recovery": "Retain the exact stale/mismatched continuation fixture and fail closed; revise approval first if closing the gap would change an owner contract, scope, or external-fact boundary."
      },
      {
        "id": "M5",
        "recovery": "Record the exact seed/command prefix or regression command, leave the task editable, and rerun all affected targeted evidence plus the full offline gate after repair."
      },
      {
        "id": "M6",
        "recovery": "Keep the plan active and task reserved if A1/A2, completion readiness, staged inventory, a real gate, commit, ready, or integration is not exact; use fresh trace/recovery only as coordinator policy directs."
      }
    ],
    "validation_bindings": [
      {
        "id": "V1",
        "state_binding": "material"
      },
      {
        "id": "V2",
        "state_binding": "material"
      },
      {
        "id": "V3",
        "state_binding": "material"
      },
      {
        "id": "V4",
        "state_binding": "material"
      },
      {
        "id": "V5",
        "state_binding": "material"
      },
      {
        "id": "V6",
        "state_binding": "material"
      },
      {
        "id": "V7",
        "state_binding": "material"
      },
      {
        "id": "V8",
        "state_binding": "material"
      },
      {
        "id": "V9",
        "state_binding": "material"
      },
      {
        "id": "V10",
        "state_binding": "material"
      }
    ],
    "risk_controls": [
      {
        "id": "R1",
        "mitigation": "Derive and export finite state/event constants once, validate exact event/from/to combinations at runtime, exhaust all 36 state pairs, and assert frozen terminal facts and exact revision deltas.",
        "recovery": "Treat any mismatch as a contract failure, keep the plan active, repair the single domain owner, and rerun unit, property, type, and full offline evidence."
      },
      {
        "id": "R2",
        "mitigation": "Use separate parent and dependency reachability checks over the proposed complete snapshot, reject before cloning a result, and test self, duplicate, cross-Project, multi-hop cycle, and direct-cancellation boundaries.",
        "recovery": "Preserve the minimal failing graph, reject the mutation, repair only the graph operation, and rerun exhaustive plus seeded graph histories."
      },
      {
        "id": "R3",
        "mitigation": "Expose separate ready eligibility and waiting continuation evaluators with exact inputs and reason codes; exhaust state/Project/dependency combinations and stale action/revision/identity/time negatives.",
        "recovery": "Leave the Task waiting or ineligible with no event/revision change, retain the failing fixture, and reopen approval if a missing fact belongs to another owner."
      },
      {
        "id": "R4",
        "mitigation": "Use immutable clones/frozen outputs, one explicit read snapshot with an opaque echoed revision label, explicit time/receipt values, no ambient APIs, and an architecture test that audits imports plus repeated equal-input behavior and caller-object preservation.",
        "recovery": "Remove the offending dependency or ambient read; do not add a port or adapter within EP-01A."
      },
      {
        "id": "R5",
        "mitigation": "Use dependency-free deterministic PRNG seeds, always include illegal commands, check invariants after every step, and report seed plus shortest executed prefix needed to reproduce a failure.",
        "recovery": "Freeze the failing seed/prefix as a targeted regression before repairing and rerun the full seed set."
      },
      {
        "id": "R6",
        "mitigation": "Update exact source/package inventories and current-capability prose in the same task, retain zero dependencies and blocked Codex claims, and run package smoke plus the entire offline gate.",
        "recovery": "Keep truthful partial capability wording, repair only task-owned package/tooling assumptions, and never weaken SQLite/Codex or dependency criteria."
      },
      {
        "id": "R7",
        "mitigation": "Use ExecPlan trace and Git-flow fresh trace/CAS independently, reserve before final review, bind all validation/A1/A2 and coordinator receipts to exact states, stage an explicit task-owned inventory, and integrate FF-only without push.",
        "recovery": "If material or master moves, stop; use allowed refresh only before a task commit, assess ExecPlan base impact separately, invalidate stale evidence, and otherwise retain active/reserved state for explicit resolution."
      }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "fdac1101e539a26957847a589d0a7c3a5dbc37c2",
      "current_material_base": "fdac1101e539a26957847a589d0a7c3a5dbc37c2",
      "base_transitions": []
    },
    "milestone_progress": [
      {
        "id": "M1",
        "status": "complete",
        "updated_at": "2026-08-28 23:05:08+08:00"
      },
      {
        "id": "M2",
        "status": "complete",
        "updated_at": "2026-08-29 00:45:57+08:00"
      },
      {
        "id": "M3",
        "status": "complete",
        "updated_at": "2026-08-28 23:05:08+08:00"
      },
      {
        "id": "M4",
        "status": "complete",
        "updated_at": "2026-08-28 23:05:08+08:00"
      },
      {
        "id": "M5",
        "status": "complete",
        "updated_at": "2026-08-29 00:45:57+08:00"
      },
      {
        "id": "M6",
        "status": "complete",
        "updated_at": "2026-08-29 00:55:47+08:00"
      }
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "From the canonical EP-01A worktree run exec_plan.py terminal-resolve for docs/plans/completed/EP-00B-toolchain-feasibility.md, historical scope at fdac1101e539a26957847a589d0a7c3a5dbc37c2, strict chain-check to this successor, and fresh trace before and after recording V1; require exact schema-v3 scope/state, current independent audits, all milestones and validations, final summary, and zero completion blocker before staging.",
        "evidence": "EP-01A/V1/current; primary Codex agent recorded at 2026-08-29 00:56:44+08:00. terminal-resolve exited 0 with unique candidate/terminal fdac1101e539a26957847a589d0a7c3a5dbc37c2 and no rejection; historical scope at that exact commit exited 0 with EP-00B status=completed, completion_ready=true, completion_blockers=[], errors=[], warnings=[], and outside_scope=[]; strict chain-check exited 0 and accepted EP-01A successor_material_base=fdac1101e539a26957847a589d0a7c3a5dbc37c2. The pre-record fresh trace exited 0 with errors=[], warnings=[], outside_scope=[], schema v3, exact approval digest 0F42BE3118A3B1F1A53EC3D578A66BE21BCAD9971278530586314BBFE01F339E, material state git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167, A0 ready, A1 complete, required A2 closure-safe, all six milestones complete, V2-V10 passed, final summary present, and validation_not_terminal as the sole derived blocker because V1 itself was pending. After this exact V1 result was recorded, fresh trace exited 0 with completion_ready=true, completion_blockers=[], errors=[], warnings=[], and outside_scope=[] before staging or the one task commit.",
        "state_id": "git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "From D:\\agent-task-orchestrator\\.worktrees\\ep-01a run C:\\Users\\Administrator\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe --test test/domain-unit.test.mjs against the complete repaired candidate after A1; inspect the exhaustive exact state/target/event matrix, mutation/event/revision assertions, hierarchy/dependency/eligibility/waiting fixtures, exceptional structured inputs, and caller-owned input preservation.",
        "evidence": "EP-01A/V2/current; primary Codex agent recorded at 2026-08-29 00:45:57+08:00 on Windows kernel 10.0.22631/x64/NTFS with bundled Node 24.19.0. The fresh dedicated command exited 0 with 13 passed, 0 failed, 0 skipped, and 0 todo. Every authoritative transition tuple succeeded; every other tuple, including wrong-event and same-state tuples, failed without revision change. Terminal, exactly-once revision, parent forest, dependency DAG/direct cancellation, completed-only eligibility, waiting continuation, queried-versus-unrelated missing-fact, invalid-accessor/Proxy/noncanonical-array, and immutability assertions passed. The complete offline gate also ran these tests successfully in the 38-test suite.",
        "state_id": "git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "From D:\\agent-task-orchestrator\\.worktrees\\ep-01a run C:\\Users\\Administrator\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe --test test/domain-property-state-machine.test.mjs; require the hard-coded independent transition and command oracles, four documented fixed seeds, 240 commands per history, a deterministic second replay, per-step graph/terminal/revision/waiting checks, and first-failure seed plus shortest executed command prefix reporting.",
        "evidence": "EP-01A/V3/current; primary Codex agent recorded at 2026-08-29 00:45:57+08:00 in the recorded Windows/Node environment. The fresh dedicated command exited 0 with 1 passed and no failure. Seeds 0x1a2b3c4d, 0x5eedc0de, 0x7f4a7c15, and 0xc001d00d exercised accepted and rejected create/body/parent/dependency/supersession/waiting/transition commands. Independent state, exact revision/event type/details/order, terminal, parent forest, dependency DAG, complete command-derived waiting-envelope coherence, and ready-direct-dependent-only cancellation oracles remained true after every accepted step, and rejected commands preserved the snapshot. The complete offline gate independently included the same property suite.",
        "state_id": "git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "From D:\\agent-task-orchestrator\\.worktrees\\ep-01a run C:\\Users\\Administrator\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe --test test/domain-architecture.test.mjs; inspect the exact src/index.ts root export inventory, package dependency shape, src/domain.ts imports and ambient API tokens, repeated equal-input results, frozen outputs, caller preservation, and top-level/nested/command/array/Proxy exceptional input boundaries.",
        "evidence": "EP-01A/V4/current; primary Codex agent recorded at 2026-08-29 00:45:57+08:00 in the recorded Windows/Node environment. The fresh dedicated command exited 0 with 6 passed, 0 failed, 0 skipped, and 0 todo. The exact public Domain Core export set matched, production dependencies remained zero, src/domain.ts had no import or forbidden infrastructure/ambient dependency, import/evaluation and equal calls were deterministic and side-effect free, results were deeply frozen, caller inputs stayed unchanged, and accessor/Proxy/noncanonical-array failures returned static structured DomainFailure values without dispatching caller collection methods, executing detectable getters, mutating the input, or exposing thrown content. The complete offline gate independently included the same architecture suite.",
        "state_id": "git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "From D:\\agent-task-orchestrator\\.worktrees\\ep-01a, after the user-authorized exact frozen install into .pnpm-store, prepend only the bundled Node and pnpm paths, verify pnpm exec tsc --version reports 5.9.3, and run pnpm typecheck using the repository's strict NodeNext tsconfig without dependency repair.",
        "evidence": "EP-01A/V5/current; primary Codex agent recorded at 2026-08-29 00:45:57+08:00 on Windows 10.0.22631 x64 with Node 24.19.0, pnpm 11.19.0, and TypeScript 5.9.3. The exact tsc -p tsconfig.json --noEmit command exited 0 with no diagnostic. The later network-disabled pnpm verify:offline repeated the same typecheck and the declaration-producing build, both exit 0.",
        "state_id": "git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "From D:\\agent-task-orchestrator\\.worktrees\\ep-01a prepend only C:\\Users\\Administrator\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin to the process PATH, set pnpm_config_verify_deps_before_run=false to prohibit automatic dependency repair, run the bundled pnpm 11.19.0 executable with pnpm lint, then run git diff --check against the complete candidate.",
        "evidence": "EP-01A/V6/current; primary Codex agent recorded at 2026-08-29 00:45:57+08:00 on the recorded Windows/Node environment. The full offline run's pnpm lint exited 0 with status=passed, files=85, and sourceFiles=3; it accepted exactly src/index.ts, src/domain.ts, and src/cli.ts as production source while checking the frozen package/configuration and complete candidate inventory. A fresh git diff --check exited 0 with no whitespace error; only normal LF-to-CRLF working-copy notices appeared. The exact 22-path candidate inventory had zero missing, extra, directory, symlink, or reparse member.",
        "state_id": "git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "From the canonical task worktree use the same repair-disabled bundled Node/pnpm environment as V6 to run pnpm docs:check, then manually review the complete changed capability/status, architecture, contract-owner, domain, toolchain, validation, compatibility, README, and changelog diff against repository authority.",
        "evidence": "EP-01A/V7/current; primary Codex agent recorded at 2026-08-29 00:45:57+08:00 in the recorded environment. The full offline run's pnpm docs:check exited 0 with status=passed, markdownFiles=52, localLinks=228, and forbidden=0. Manual review found one normative domain owner and no copied/conflicting rule. Current prose claims only the implemented pure in-memory Domain Core; application service, persistence, dispatcher, ports/adapters, scheduler, MCP, product CLI/orchestrator runtime, compatibility/support, hosted CI enforcement, release, and external integration remain explicitly unimplemented or unverified.",
        "state_id": "git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "From the canonical task worktree use the same repair-disabled bundled Node/pnpm environment as V6 to run pnpm dependency:check and inspect package.json, pnpm-lock.yaml, .npmrc, and the recorded narrow network authorization. Treat the separately authorized pnpm dependency:audit result as supplemental rather than a dependency of this material validation.",
        "evidence": "EP-01A/V8/current; primary Codex agent recorded at 2026-08-29 00:45:57+08:00 in the recorded environment. The full offline run's pnpm dependency:check exited 0 with status=passed, productionDependencies=0, and developmentDependencies=[typescript@5.9.3]. The frozen lockfile/configuration, scripts-disabled install policy, exact npmjs.org registry integrity, and credential-shaped configuration checks passed. Separately, under the user's resumed-task network authorization, pnpm dependency:audit exited 0 with No known vulnerabilities found; V8 does not depend on that online result.",
        "state_id": "git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "From the canonical task worktree, with the exact TypeScript 5.9.3 build already produced and pnpm offline mode forced, run pnpm package:smoke and require exact pack inventory, disposable-consumer install/import/execution, ato status console execution, uninstall, and owner-safe temporary cleanup.",
        "evidence": "EP-01A/V9/current; primary Codex agent recorded at 2026-08-29 00:45:57+08:00 in the recorded Windows/Node/pnpm environment. pnpm package:smoke exited 0 with status=passed, packageManager=pnpm@11.19.0, frozenInstall=typescript@5.9.3, packedFiles=15, export=passed, console=passed, and uninstall=passed. No package-smoke temporary consumer or package artifact survived.",
        "state_id": "git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "From D:\\agent-task-orchestrator\\.worktrees\\ep-01a run the authoritative pnpm install --frozen-lockfile --ignore-scripts --store-dir=.pnpm-store --registry=https://registry.npmjs.org/ under the user's narrow network authorization, then force pnpm/npm offline mode and run one complete pnpm verify:offline without substituting targeted checks.",
        "evidence": "EP-01A/V10/current; primary Codex agent recorded at 2026-08-29 00:45:57+08:00 on Windows 10.0.22631 x64/NTFS with Node 24.19.0, pnpm 11.19.0, and exact TypeScript 5.9.3. The explicit frozen install was already up to date and tsc --version returned 5.9.3. With network disabled, pnpm verify:offline exited 0: lint passed with files=85/sourceFiles=3; strict typecheck and build passed; the complete Node suite passed 38/38; docs passed with markdownFiles=52/localLinks=228/forbidden=0; dependency shape passed with zero production and exactly TypeScript 5.9.3; package smoke passed with 15 packed files and export/console/uninstall all passed; the real Windows SQLite matrix passed with survivingGenerationMembers=0; and Codex remained boundaryStatus=passed, externalE2E=not_run, supportClaim=false. After the plan moved to its completed path, a second complete network-disabled pnpm verify:offline exited 0 with the same 85/3 lint inventory, 38/38 tests, 52/228/0 docs result, 15-file package smoke, zero surviving SQLite generation members, and fail-closed Codex boundary. Targeted tests were not substituted, no repair or integration-root store was used, and no creator-owned temporary artifact survived.",
        "state_id": "git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/ep01a_a0, A0 attempt 4",
        "independence": "Fresh independent read-only A0 reviewer, separate from the proposal author and implementer. The review made no file, plan, Git, coordinator, network, secret, external-repository, D:\\quant, or external-state mutation.",
        "scope": "Complete current schema-v3 EP-01A approval contract and execution contract; applicable harness-exec-plan requirements and repository authorities; relevant package, lockfile, registry policy, Domain Core source/tests; authorization and persistence boundaries; EP-00B terminal/historical-scope/strict-chain evidence.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-29 00:53:47+08:00",
        "approval_sha256": "0F42BE3118A3B1F1A53EC3D578A66BE21BCAD9971278530586314BBFE01F339E",
        "reviewed_material_base": "fdac1101e539a26957847a589d0a7c3a5dbc37c2",
        "evidence": "Fresh exec_plan trace exited 0 with errors=[], warnings=[], outside_scope=[], overlap=[], HEAD/current/approval material base fdac1101e539a26957847a589d0a7c3a5dbc37c2, and material state git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167. Independent UTF-8 canonical JSON recomputation produced exactly 18693 bytes and SHA256 0F42BE3118A3B1F1A53EC3D578A66BE21BCAD9971278530586314BBFE01F339E. Fresh terminal-resolve identified fdac1101e539a26957847a589d0a7c3a5dbc37c2 as EP-00B's unique terminal commit; historical scope at that commit was completed and completion-ready with no errors, warnings, outside-scope paths, or blockers; strict chain-check accepted EP-01A with that exact successor base. F-A0-02 is closed: non_goals[5], authorization.allowed[1], requires_reapproval[2], and prohibited[3] consistently permit only the exact npmjs.org lockfile-bound TypeScript 5.9.3 frozen install and separate production vulnerability audit. V8 remains an offline dependency-shape gate independent of that supplemental online audit, and V10 runs the complete gate offline after the narrowly authorized install. Package/lock/.npmrc retain zero production dependencies, only exact TypeScript 5.9.3, the frozen Node 24.19.0/pnpm 11.19.0 toolchain, npmjs.org registry, and disabled install scripts. The exception introduces no product, runtime, dependency, or toolchain expansion and does not weaken prohibitions on other network use, secrets, accounts, push/PR/release/deploy, destructive Git actions, D:\\quant, or other repositories. The contract retains one immutable read snapshot with an opaque echoed label, domain-owned Task creation/+1 revisions, and only the waiting_task_revision/current command-supplied Task revision predicate; no global freshness, global revision mutation, generic revision/CAS judgment, or reliability ownership drift remains. Goal, non-goals, scope, milestones, recoveries, material bindings, and risk controls cover the required state, graph, eligibility, waiting, deterministic/property, architecture/no-I/O/public-export, documentation, package, and full-offline evidence. V1-V10 map one-to-one to the ten frozen gates. Product runtime persistence remains Tier 0; task evidence and the separately authorized terminal local commit do not expand that boundary. Final git status remained the same trace-reported task-owned inventory.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/ep01a_a1",
        "independence": "The reviewer did not implement or repair EP-01A. It performed a fresh read-only A1 over the complete task diff and made no file, Git, coordinator, permission, network, secret, external-repository, D:\\quant, or external-state mutation.",
        "scope": "Exact task material state git-sha1:651cfad60f3fe85602502bc36ac98b178634b398; full EP-01A implementation, tests, scripts, current-capability documentation, validation evidence, scope, authority, and frozen toolchain boundaries.",
        "reviewed_at": "2026-08-28 22:52:34+08:00",
        "evidence": "Fresh trace bound HEAD/material base fdac1101e539a26957847a589d0a7c3a5dbc37c2 with errors=[], warnings=[], outside_scope=[], and overlap=[]. Independent runtime repros showed a parent-cycle query returning eligible=true while canonical construction rejected the same bytes, and a throwing snapshot getter escaping createDomainSnapshot. Review of the exhaustive and seeded tests showed that legal from/to pairs skipped wrong-event tuples and randomized histories lacked an independent transition/direct-cancellation oracle and replay prefix. Node 24 targeted unit 12/12, property 1/1, architecture 4/4, lint, docs, dependency shape, Codex boundary, and diff check passed but do not close these gaps. Exact TypeScript 5.9.3 typecheck/build, package smoke, and verify:offline remain not run because the task-local offline store lacks the compiler.",
        "reviewed_state_id": "git-sha1:651cfad60f3fe85602502bc36ac98b178634b398",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-A1-01",
            "severity": "MEDIUM",
            "summary": "Eligibility and continuation queries skip parent/reference/DAG invariants and can return a positive decision for a structurally invalid snapshot.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Separate always-required structural graph validation from the intentionally allowed missing Project/direct-dependency decision facts, then add query regressions for parent and dependency cycles.",
            "closure_evidence": "Not closed at A1: repair the implementation, rerun the affected unit/property/architecture evidence, and obtain fresh independent A2 against the repaired material state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-02",
            "severity": "MEDIUM",
            "summary": "Throwing accessors or exceptional public input objects can escape parsers instead of returning a structured DomainFailure.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Reject accessor-backed exact-shape records and add one deterministic public exception boundary that normalizes remaining snapshot/command access failures without exposing thrown content.",
            "closure_evidence": "Not closed at A1: add snapshot, command, nested, and Proxy accessor regressions, rerun public-boundary evidence, and obtain fresh independent A2.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-03",
            "severity": "MEDIUM",
            "summary": "State-machine evidence does not exhaust wrong-event tuples or use independent transition and direct-cancellation oracles with a replayable failing prefix.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Exhaust every state/target/event tuple and strengthen fixed-seed histories with hard-coded relation, graph, revision, terminal, and direct-cancellation reference checks plus the shortest executed failure prefix.",
            "closure_evidence": "Not closed at A1: repair the tests, demonstrate the new negatives fail against the old behavior where applicable, rerun V2/V3/V4, and obtain fresh independent A2.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/ep01a_a2, A2 attempt 3",
        "independence": "Fresh read-only reviewer that did not implement or repair EP-01A. It created, edited, deleted, staged, committed, or switched no file or Git state and mutated no coordinator state, permission, network, cache, secret, external repository, D:\\quant, or external state.",
        "scope": "Exact repaired EP-01A material state; current active plan and authorization, A1 findings/dispositions, both prior A2 histories, validation evidence, complete current task material/diff, Domain Core implementation, and full unit/property/architecture evidence. The review reconfirmed F-A1-01/F-A2-01 and F-A1-02/F-A2-02 closure and freshly reviewed F-A1-03/F-A2-03/F-A2-04.",
        "reviewed_at": "2026-08-28 23:40:51+08:00",
        "evidence": "Fresh final trace exited 0 with errors=[], outside_scope=[], approval digest 5793A0A689A0E35F1A2DD4339C85CA4C3787E707E285F747B0D29F75CABFD98A, HEAD/base fdac1101e539a26957847a589d0a7c3a5dbc37c2, and exact state git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167. At review time W_PREFLIGHT_A2_CONVERGENCE was the sole advisory because the two honest histories were then reopened; independent review confirmed the same test-evidence root, stable strategy/envelope, and convergence from three residuals to one local self-reference and then direct closure without scope expansion. After this closure-safe report became current, those reports remain fully preserved below and are lifecycle-superseded rather than current reopen requests. Fresh read-only unit 13/13, property/state-machine 1/1, architecture 6/6, and git diff --check passed. Decision parsing now limits missing-fact reasons to the queried Task and rejects unrelated invalid references/graphs. Descriptor snapshots and canonical-array traversal reject accessor, extra, symbol, sparse, non-enumerable, callable, custom-prototype, and exceptional inputs without dispatching accepted caller methods, mutating caller values, leaking content, or escaping exceptions. The property suite uses hard-coded state/transition/event inventories; independent success, graph, revision, terminal, exact event type/detail/order, transition, cancellation, and complete waiting-envelope oracles; fixed seeds; deterministic replay; and first-failure prefixes. task.waiting_changed expectations now derive from command.waiting and independently compare the complete returned envelope plus exact revision. Exact TypeScript 5.9.3 typecheck/build, package smoke, and verify:offline remain blocked/not run and were not treated as passing.",
        "reviewed_state_id": "git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167",
        "parent_disposition": "complete",
        "closes": [
          "F-A1-01",
          "F-A1-02",
          "F-A1-03"
        ],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-01"
        ],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-08-28 21:54:31+08:00 confirmed one HIGH contract gap under digest A4AFFAA591F267D90F00F5509FF3DE18FE9FD0503B7EB37C2B2B20537CF3D042: C2/C4/C5 and D2 introduced a global snapshot revision plus generic expected-revision/CAS validation owned by the reliability protocol. The finding was confirmed in scope; the contract now retains one immutable read snapshot, domain-owned Task revision semantics, and only the waiting continuation revision equality required by the domain owner, so fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "The user explicitly authorized network access on 2026-08-29 after A0 attempt 2. The approval contract now permits only the exact npmjs.org TypeScript 5.9.3 frozen install and separate production vulnerability audit, while all product scope and other external-action prohibitions remain unchanged. Digest 5793A0A689A0E35F1A2DD4339C85CA4C3787E707E285F747B0D29F75CABFD98A is therefore historical and fresh independent A0 is required for the revised authorization contract."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-02"
        ],
        "disposition": "reopened",
        "reason": "Fresh independent A0 attempt 3 at 2026-08-29 00:48:06+08:00 confirmed one in-scope MEDIUM contract gap under digest CEDD4730190E091C91A901859A67A4D589A63CFAB6938AFEEB2D4F2F3DD33D86: non_goals[5] still prohibited all network while the revised authorization allowed exactly the npmjs.org frozen TypeScript 5.9.3 install and separate production audit. The non-goal now states the same narrow exception and preserves every other prohibition, so fresh A0 is required."
      },
      {
        "audit": "A2",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": [
          "F-A2-01",
          "F-A2-02",
          "F-A2-03"
        ],
        "disposition": "superseded",
        "reason": "Fresh independent A2 at 2026-08-28 23:16:05+08:00 bound git-sha1:b3427caf0175457914a6c9983a739196dc3cfcb0 and did not close F-A1-01, F-A1-02, or F-A1-03. It reproduced unrelated-Task missing Project/dependency references producing a positive decision, noncanonical arrays dispatching caller-supplied or inherited methods and mutating caller input before static failure, and a randomized event oracle that checked counts/revisions but not exact event types/details or complete direct-cancellation waiting metadata. All three residuals were confirmed in-scope MEDIUM findings requiring repair and a fresh repeat of A2; no A3 was introduced. The report is now superseded by the closure-safe current A2 attempt 3 at git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167; its findings and original state remain preserved here."
      },
      {
        "audit": "A2",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [
          "F-A2-04"
        ],
        "disposition": "superseded",
        "reason": "Fresh independent A2 attempt 2 at 2026-08-28 23:36:30+08:00 bound git-sha1:2c73652b0e1fbd149117c39f8412eca5acf05786 and independently closed the structural decision and canonical input-array residuals, but F-A1-03 remained open. The randomized task.waiting_changed oracle derived waitingReason and requiredAction from the implementation-produced changed Task and did not separately compare the full waiting update against command.waiting, so matching corruption in state and event details could self-confirm. This confirmed in-scope MEDIUM residual required the expected event and waiting outcome to derive only from the command followed by fresh repeat A2; no A3 was introduced. The report is now superseded by the closure-safe current A2 attempt 3 at git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167; its finding and original state remain preserved here."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V5",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-08-28 23:43:46+08:00",
        "evidence": "At exact state git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167, the canonical task worktree prepended only the bundled Node bin, set pnpm_config_verify_deps_before_run=false, and invoked bundled pnpm 11.19.0 typecheck. The script reached the exact tsc -p tsconfig.json --noEmit command and exited 1 because tsc is not installed in the EP-01A worktree. No repair, registry access, default/integration-root store, or compiler fallback occurred; TypeScript 5.9.3 diagnostics were not produced.",
        "state_id": "git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167"
      },
      {
        "validation_id": "V10",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-08-28 23:43:46+08:00",
        "evidence": "At the same exact state and repair-disabled bundled environment, pnpm verify:offline started without install or network, completed its pnpm lint phase with status=passed/files=85/sourceFiles=3, then exited 1 at pnpm typecheck because tsc is absent. Build, complete tests, docs, dependency, package smoke, SQLite, and Codex phases were therefore not reached by this full command and are not claimed through V10. The missing EP-01A-owned TypeScript 5.9.3 package/store seed is an environment failure, not a passing or deterministic product result.",
        "state_id": "git-sha1:bab3104795c6021ba0d46215d8d2d4fd479e4167"
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-08-28 21:55:49+08:00",
        "summary": "Close A0 attempt 1 by removing global snapshot-revision freshness and generic expected-revision/CAS behavior from Domain Core while retaining one immutable read snapshot with an opaque echoed revision label, Task creation/increment rules, and the exact waiting_task_revision/current supplied Task revision equality owned by the domain contract.",
        "previous_approval_sha256": "A4AFFAA591F267D90F00F5509FF3DE18FE9FD0503B7EB37C2B2B20537CF3D042"
      },
      {
        "at": "2026-08-29 00:42:00+08:00",
        "summary": "Record the user's resumed-task authorization for the exact npmjs.org TypeScript 5.9.3 frozen install and separate production vulnerability audit, while keeping all product scope, offline validation criteria, dependency policy, secrets, external accounts, push, and other external actions unchanged.",
        "previous_approval_sha256": "5793A0A689A0E35F1A2DD4339C85CA4C3787E707E285F747B0D29F75CABFD98A"
      },
      {
        "at": "2026-08-29 00:48:49+08:00",
        "summary": "Close F-A0-02 by making the network non-goal express the same exact npmjs.org frozen TypeScript 5.9.3 install and separate production-audit exception as the authorization block, without changing any product scope, dependency policy, validation outcome, or other prohibition.",
        "previous_approval_sha256": "CEDD4730190E091C91A901859A67A4D589A63CFAB6938AFEEB2D4F2F3DD33D86"
      }
    ],
    "final_summary": "EP-01A delivers the deterministic pure TypeScript Domain Core, exact state/graph/eligibility/waiting semantics, narrow public package surface, truthful capability documentation, exhaustive and fixed-seed tests, independently closed A0/A1/A2 review, and full frozen Windows toolchain evidence at one exact material state, ready for terminal commit and FF-only local integration without push."
  }
}
```

## Context

EP-00B supplied the exact frozen TypeScript/Node scaffold and terminal predecessor commit. EP-01A is the first product implementation slice, limited to an in-memory Domain Core; later plans remain responsible for persistence, reliability, application orchestration, adapters, and public interfaces.
