# ExecPlan: implement the staged Phase 1 persistence foundation

EP-01B is the first persistence implementation slice after the completed
EP-01A Domain Core. It converts only the storage foundation from planned to
implemented while preserving later Phase 1 application/interface work and all
Phase 2 execution work as separate, unimplemented plans.

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "active",
    "created_at": "2026-08-29 12:35:39+08:00",
    "updated_at": "2026-08-29 16:05:36+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "user coordinator handoff in the current thread",
        "at": "2026-08-29 12:35:39+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "user coordinator handoff in the current thread",
        "at": "2026-08-29 12:35:39+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Starting from completed EP-01A, implement and validate the production Phase 1 SQLite persistence foundation: a safe runtime root, verified connection and bounded transaction policy, one immutable staged migration registry, the exact metadata and Domain Core storage schema needed by EP-01B, typed repository ingress/decode, and verified backup/restore primitives with fail-closed recovery boundaries; converge the authoritative contracts and package boundary without claiming an application service, product CLI, execution backend, orchestration runtime, or platform support.",
    "non_goals": [
      "Do not create, activate, implement, or reserve EP-01C or EP-01D; their ProjectRegistry, runtime authorization, application service, CLI, backup/restore/doctor user surfaces, and Phase 1 closure remain separate work.",
      "Do not implement Manual, Codex, Git, workspace, completion, scheduler, policy, or other adapters; a dispatcher; claim, lease, fencing, execution, intent/effect, scheduler, workspace, gate, or completion persistence; MCP; plugins; or external Project operations.",
      "Do not allocate or freeze Phase 2 or Phase 3 execution, intent, workspace, scheduler, adapter-receipt, gate, reservation, dispatcher-run, or fan-out tables in the EP-01B migrations.",
      "Do not add an application command, product CLI command, automatic Task transition, execution or completion loop, runtime grant decision, or authority derived from Project/Task text, prompts, repository content, tool output, or Agent output.",
      "Do not modify D:/quant or any other repository, access a secret or account, use network access other than the repository's standing-authorized ordinary origin/master push after every exact-head prerequisite, create a pull request or merge request, release, deploy, or perform force, rebase, reset, stash, clean, or destructive cleanup.",
      "Do not claim a released schema, supported Windows product, hosted CI result, external integration, or complete Phase 1 runtime from local implementation and validation evidence.",
      "Do not rewrite completed plans or historical evidence to reflect the new EP-01A -> EP-01B -> EP-01C -> EP-01D -> EP-02 chain.",
      "Do not add a production dependency, change Node 24.19.0, pnpm 11.19.0, TypeScript 5.9.3, or substitute feasibility code for the production persistence owner."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "EP-01A at commit 71dc606d5e4c40de4f669d0732da653d81bc8f92 is the strict product predecessor. EP-01B records the current user-decided successor chain EP-01A -> EP-01B -> EP-01C -> EP-01D -> EP-02 without editing historical plan bytes.",
        "source": "Current user coordinator handoff; docs/plans/README.md predecessor and historical-evidence rules"
      },
      {
        "id": "C2",
        "statement": "The current material base is 2df03a4f6a2106555740944596924561e2753e89. Its two post-EP-01A commits are repository artifact-policy governance only: they do not alter this product approval contract, but EP-01B must honor the committed .task-artifacts policy and exact-head prune requirement.",
        "source": "Read-only terminal/scope and 71dc606..2df03a4 Git impact evidence; AGENTS.md; docs/reference/local-agent-git-flow.md"
      },
      {
        "id": "C3",
        "statement": "SQLite schema allocation is staged by implementation phase. EP-01B may allocate only schema metadata, migration history, Projects needed to bind Tasks, Tasks, and Task dependency edges; later Phase 1 and Phase 2/3 records remain unallocated until their owning ExecPlans.",
        "source": "Current user decision; docs/reference/persistence-contract.md ownership rule"
      },
      {
        "id": "C4",
        "statement": "Persisted Project/Task values round-trip the exact implemented Domain Core shapes and invariants without copying or changing domain transition, hierarchy, dependency, eligibility, waiting, terminal, or revision semantics.",
        "source": "ARCHITECTURE.md dependency direction; docs/reference/domain-contract.md"
      },
      {
        "id": "C5",
        "statement": "The production source boundary is expanded deliberately for persistence while keeping the exact frozen toolchain, zero production dependencies, private ESM package, status-only console, and built-in node:sqlite owner; Domain Core remains I/O-free.",
        "source": "Current user decision; docs/reference/toolchain-contract.md"
      },
      {
        "id": "C6",
        "statement": "EP-01B is Tier 2 persistence work. Each durable field, schema, migration, backup manifest, restore intent/receipt, and repository mapping has one writer/reader owner, identity binding, pre-mutation refusal, isolated topology, bounded lock/transaction behavior, terminal readback, and explicit recovery outcome.",
        "source": "harness-exec-plan persistence lens; docs/reference/persistence-contract.md; docs/security/threat-model.md N5"
      },
      {
        "id": "C7",
        "statement": "Runtime-root and backup/restore paths are owner-derived, absolute, non-root, outside and non-overlapping with the checkout and supplied Project roots, and rejected on traversal, unresolved identity, non-directory, symlink, junction, reparse, inventory, or path-swap ambiguity before protected mutation. Windows defaults to the local application-data directory plus agent-task-orchestrator; TASK_ORCHESTRATOR_DATA_DIR is an untrusted path override subject to the same checks; newly created directories use user-only permissions on hosts that support them.",
        "source": "docs/reference/persistence-contract.md runtime-location rules; docs/security/threat-model.md N1 and N5"
      },
      {
        "id": "C8",
        "statement": "The connection owner verifies foreign_keys=ON, primary journal_mode=WAL, synchronous=FULL, read_uncommitted=OFF, and busy_timeout=5000; writes use bounded BEGIN IMMEDIATE transactions and reads use synchronous bounded snapshots with typed busy/error propagation. Checkpointing is explicit and cannot truncate WAL frames still required by an active reader.",
        "source": "docs/reference/persistence-contract.md connection and transaction policy"
      },
      {
        "id": "C9",
        "statement": "Migration versions and complete file-stem IDs are strictly increasing and immutable; uppercase SHA-256 binds exact committed SQL bytes; applied history must be a contiguous exact registry prefix; migration and history insertion are atomic; a verified pre-upgrade backup is required before modifying a pre-existing older schema.",
        "source": "docs/reference/persistence-contract.md migration identity; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C10",
        "statement": "Only the repository owner decodes SQLite storage classes and constructs Domain Core values. Missing, unknown, corrupt, newer-schema, impossible-row, checksum, history, FK, or integrity state produces a typed failure and no normal mutation, default value, skipped row, replacement database, or false terminal result.",
        "source": "docs/reference/persistence-contract.md authoritative ingress and recovery; docs/security/threat-model.md N5"
      },
      {
        "id": "C11",
        "statement": "Backup uses SQLite online backup into an unpublished private generation, exact no-follow inventory, standalone read-only verification, integrity/FK/history/decode readback, and an immutable manifest. Restore requires an explicit expected-current identity and data-loss acknowledgement, preserves the prior file set, and uses a durable intent plus recoverable publication states.",
        "source": "docs/reference/persistence-contract.md backup and recovery requirements; harness-exec-plan Tier 2 transition lens"
      },
      {
        "id": "C12",
        "statement": "Implementation, validation, one task-owned terminal commit, coordinator FF-only local integration, and the repository's standing-authorized ordinary origin/master push are authorized only after their independent plan and exact-head gates; no adjacent external action or cleanup is inferred.",
        "source": "Current user coordinator handoff; AGENTS.md; docs/reference/local-agent-git-flow.md"
      },
      {
        "id": "C13",
        "statement": "All runtime databases, WAL/SHM members, backups, restore stages, receipts, test roots, dependency stores, build outputs, prompts, identities, secrets, and local evidence remain uncommitted; tests may mutate only creator-owned disposable generations below .task-artifacts.",
        "source": "AGENTS.md; docs/reference/toolchain-contract.md data boundary; current user prohibition on destructive cleanup"
      },
      {
        "id": "C14",
        "statement": "Fresh independent A0 is required before activation, fresh independent A1 after a stable validated diff, and fresh independent A2 after every confirmed in-scope HIGH or MEDIUM repair; implementer self-review cannot substitute.",
        "source": "Current user coordinator handoff; harness-exec-plan audit contracts"
      }
    ],
    "authorization": {
      "allowed": [
        "Read repository material and create or modify only the task-owned paths in this approval contract from the coordinator-owned task/ep-01b worktree.",
        "Implement the exact EP-01B production persistence foundation and run local offline validation using creator-owned disposable .task-artifacts generations, including deliberate corruption, contention, migration failure, and interrupted-restore fixtures confined to those generations.",
        "Use independent read-only subagents for A0, A1, and required A2; record their reports and parent dispositions without allowing reviewers to edit or authorize.",
        "Create one task-owned terminal Git commit after completion readiness, obtain the manifest-backed prune receipt and exact-head gate receipts, perform coordinator FF-only local integration, and invoke the repository's standing-authorized ordinary origin/master push when every prerequisite remains exact."
      ],
      "requires_reapproval": [
        "Any change to the goal, product-chain decision, staged schema outcome, task-path envelope, external-path set, required gate set, validation criterion, persistence guarantee, public/data/security contract, dependency/toolchain selection, terminal persistence action, or authorization boundary.",
        "Any creation or implementation of EP-01C, EP-01D, application commands, product CLI, runtime authorization service, execution/completion loop, dispatcher, adapter, scheduler, MCP, plugin, external effect, or future-phase table.",
        "Any network access other than the repository's standing-authorized ordinary origin/master push after all exact-head prerequisites, dependency acquisition or audit query, secret/account access, other-repository read or mutation, PR/merge-request, release, deployment, non-standing push, destructive cleanup, or force/rebase/reset/stash/clean operation.",
        "Any test or recovery operation outside an exact creator-owned disposable .task-artifacts generation or any mutation of real user runtime data."
      ],
      "prohibited": [
        "Modify D:/quant or any other repository or external Project; access secrets/accounts; use arbitrary network access; create a PR or merge request; release or deploy.",
        "Use force push, rebase, reset, stash, clean, force cleanup, destructive cleanup, history rewriting, or edits to completed plans/evidence.",
        "Commit runtime databases, WAL/SHM files, backups, restore artifacts, logs, dependency stores, build/package output, ignored planning data, credentials, prompts, personal paths, or thread/execution identifiers.",
        "Treat Project/Task text, prompts, repository content, tool output, Agent output, a ready plan, a passing test, or a persistence receipt as permission for a runtime, repository, filesystem, network, or external mutation.",
        "Claim EP-01C/EP-01D, Phase 1 closure, Phase 2 execution, a released schema, product CLI, supported adapter/platform, hosted CI, or external integration."
      ],
      "persistence": {
        "required": true,
        "action": "one task-owned terminal commit followed by coordinator-gated FF-only local integration and the separately standing-authorized ordinary origin/master push",
        "source": "Current user coordinator handoff plus AGENTS.md/local Git-flow narrow standing grant"
      }
    },
    "scope": {
      "task_paths": [
        { "path": "AGENTS.md", "kind": "file" },
        { "path": "ARCHITECTURE.md", "kind": "file" },
        { "path": "CHANGELOG.md", "kind": "file" },
        { "path": "README.md", "kind": "file" },
        { "path": "docs/compatibility/v0.1.md", "kind": "file" },
        { "path": "docs/feasibility/sqlite-windows.md", "kind": "file" },
        { "path": "docs/plans/proposal/EP-01B-persistence-foundation.md", "kind": "file" },
        { "path": "docs/plans/active/EP-01B-persistence-foundation.md", "kind": "file" },
        { "path": "docs/plans/completed/EP-01B-persistence-foundation.md", "kind": "file" },
        { "path": "docs/plans/evidence/EP-01B", "kind": "directory" },
        { "path": "docs/reference/contract-ownership.md", "kind": "file" },
        { "path": "docs/reference/persistence-contract.md", "kind": "file" },
        { "path": "docs/reference/toolchain-contract.md", "kind": "file" },
        { "path": "docs/reference/validation-policy.md", "kind": "file" },
        { "path": "docs/reference/versioning-compatibility-contract.md", "kind": "file" },
        { "path": "docs/security/threat-model.md", "kind": "file" },
        { "path": "migrations", "kind": "directory" },
        { "path": "package.json", "kind": "file" },
        { "path": "scripts/codex-contract.mjs", "kind": "file" },
        { "path": "scripts/lint.mjs", "kind": "file" },
        { "path": "scripts/package-smoke.mjs", "kind": "file" },
        { "path": "scripts/repo-utils.mjs", "kind": "file" },
        { "path": "src/index.ts", "kind": "file" },
        { "path": "src/node-builtins.d.ts", "kind": "file" },
        { "path": "src/persistence", "kind": "directory" },
        { "path": "test/configuration.test.mjs", "kind": "file" },
        { "path": "test/domain-architecture.test.mjs", "kind": "file" },
        { "path": "test/persistence-backup-restore.test.mjs", "kind": "file" },
        { "path": "test/persistence-concurrency.test.mjs", "kind": "file" },
        { "path": "test/persistence-path-security.test.mjs", "kind": "file" },
        { "path": "test/persistence-repository.test.mjs", "kind": "file" },
        { "path": "test/persistence-schema-migrations.test.mjs", "kind": "file" },
        { "path": "test/persistence-smoke.test.mjs", "kind": "file" },
        { "path": "test/persistence-test-helpers.mjs", "kind": "file" },
        { "path": "test/scaffold.test.mjs", "kind": "file" },
        { "path": "tsconfig.json", "kind": "file" }
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "The unique schema-v3 EP-01B plan has strict EP-01A terminal/chain evidence, a recorded current-base governance impact assessment, converged staged persistence contracts, explicit Tier-2 controls, fresh independent A0, and active authorization without touching successor plans.",
        "validation_ids": ["V1", "V7", "V14"]
      },
      {
        "id": "M2",
        "outcome": "The frozen zero-production-dependency package and toolchain explicitly admit the production persistence modules and immutable SQL migrations while keeping Domain Core pure, the console status-only, and the package inventory reproducible offline.",
        "validation_ids": ["V8", "V9", "V11", "V12"]
      },
      {
        "id": "M3",
        "outcome": "The runtime-root, lifecycle lock/connection receipt, SQLite connection, bounded transaction, and staged migration owners implement fresh and older-schema startup with exact history/checksum/postcondition verification and fail-closed compatibility behavior.",
        "validation_ids": ["V2", "V3", "V5"]
      },
      {
        "id": "M4",
        "outcome": "The sole Phase 1 repository mapping round-trips exact Domain Core Project/Task/dependency snapshots and rejects invalid storage classes, impossible row shapes, corrupt graph data, stale revisions, and newer schema without defaults or partial success.",
        "validation_ids": ["V6", "V10"]
      },
      {
        "id": "M5",
        "outcome": "Online backup produces immutable verified generations, and explicit restore uses expected-current CAS, prior-file retention, durable intent/receipt state, exact recovery classification, and full readback while refusing corrupt, incomplete, stale, substituted, or newer candidates.",
        "validation_ids": ["V4", "V5", "V10"]
      },
      {
        "id": "M6",
        "outcome": "The stable candidate passes fresh independent A1 and every required fresh A2, the complete offline repository gate, candidate-inventory review, and ExecPlan completion readiness with all unsupported routes recorded truthfully; the separately governed terminal commit, artifact prune, exact-head receipts, integration, and eligible ordinary push then consume that completed candidate.",
        "validation_ids": ["V7", "V10", "V13", "V14"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "EP-01A terminal predecessor, strict product chain, and post-predecessor governance-base impact",
        "criterion": "terminal-resolve identifies exactly 71dc606d5e4c40de4f669d0732da653d81bc8f92 for completed EP-01A; historical scope at that commit is completion-ready with no error, warning, outside-scope path, or blocker; Git proves that terminal is an ancestor of current material base 2df03a4f6a2106555740944596924561e2753e89 with exactly the enumerated 5c286f3 and 2df03a4 governance commits between them; an explicit chain-check observation returns only E_CHAIN because its mechanical exact-base rule cannot represent intervening non-product governance; and manual impact assessment confirms those commits change task-artifact execution constraints but not the approved product/schema outcome or strict product-predecessor identity."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Staged schema, immutable migration identity, fresh/upgrade/failure recovery, and compatibility refusal",
        "criterion": "The targeted persistence test exits 0 and proves exact committed migration filenames/bytes/checksums, one registry, fresh initialization, upgrade from every shipped earlier prefix with a verified pre-upgrade backup, atomic failed migration rollback and restart, exact history continuity, missing/reordered/unknown/checksum mismatch refusal, FK/postcondition verification, and typed refusal before mutation for a newer schema."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Verified SQLite connection, bounded write contention, and read snapshot behavior",
        "criterion": "The targeted persistence test exits 0 and observes foreign_keys=ON, primary WAL, synchronous=FULL, read_uncommitted=OFF, busy_timeout=5000, typed bounded busy failure under a competing BEGIN IMMEDIATE writer, rollback on callback failure, rejection of asynchronous transaction callbacks, and a WAL reader retaining one snapshot while a second connection commits a visible later revision. It also proves explicit checkpoint cannot truncate frames needed by that active reader; one exact no-follow lifecycle-lock owner excludes competing open/migration/backup/restore topology transitions; live or crash-stale connection receipts block upgrade/restore as applicable; and replaced/lost lock or receipt identity plus crash residue returns a typed no-mutation blocker rather than being deleted or adopted."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Verified backup, restore CAS/publication, interruption recovery, and retained source",
        "criterion": "The targeted persistence test exits 0 and proves SQLite online backup to an unpublished exact private inventory, immutable manifest/database identities, read-only quick_check/FK/history/typed readback before and after publication, expected-current restore CAS, explicit data-loss acknowledgement, exact prior main/WAL/SHM retention, successful target readback, recoverable injected interruption, idempotent target finalization, and typed refusal of incomplete, corrupt, extra-member, substituted, stale, conflicting, or newer backup/restore state."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Runtime-root and persistence filesystem isolation",
        "criterion": "The targeted persistence test exits 0 and proves the Windows default resolves from the supplied local-application-data environment to its agent-task-orchestrator child, the TASK_ORCHESTRATOR_DATA_DIR override is treated only as an untrusted path choice, and each passes the same canonical safety checks. It refuses relative paths, filesystem roots, lexical traversal, checkout/Project equality or overlap, non-directory nodes, symlink/junction/reparse ancestors and targets, path-identity swaps, caller-selected generation paths, and unsafe inventory without mutating outside the exact creator-owned disposable runtime generation. On hosts with enforceable POSIX mode semantics it verifies user-only directory/file permissions; on Windows it records that mode enforcement is unavailable without converting that observation into a platform-support claim."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Typed repository ingress/decode and exact Domain Core persistence",
        "criterion": "The targeted persistence test exits 0 and proves repository transactions round-trip the exact frozen Domain Core Project/Task/dependency shapes and revisions, preserve graph and waiting/completion/cancellation/supersession fields, atomically reject stale revision/conflicting dependency/FK writes, and return typed integrity failures for wrong SQLite storage classes, unknown enums, conditional-shape violations, corrupt rows, duplicate identities, or invalid decoded snapshots without defaults, skipped members, or partial commits."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Documentation authority, staged Phase 1 ownership, security truthfulness, and inventory hygiene",
        "criterion": "pnpm docs:check and git diff --check exit 0; every repository-relative link resolves with exact case; manual authority review finds one owner for every changed schema/path/version/security rule; manual capability review states only the validated persistence foundation is implemented and explicitly leaves EP-01C, EP-01D, execution/completion, adapters, CLI product commands, support, hosted CI, and external integration unimplemented or unverified; the candidate inventory contains only task-owned regular files and no runtime artifact or secret, with the separate final staged-inventory check still required after plan completion readiness and before the terminal commit."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Repository/source/package boundary and hygiene",
        "criterion": "pnpm lint exits 0 and validates the exact expanded production source and migration inventory, permits node:sqlite and other built-ins only inside the persistence owner, retains the Domain Core no-I/O boundary, rejects feasibility/vendor imports and forbidden/generated/sensitive/reparse material, and reports no whitespace or staged-inventory error."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Strict TypeScript compile and build of the persistence owner",
        "criterion": "pnpm typecheck and pnpm build exit 0 under exact TypeScript 5.9.3 NodeNext strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes settings and produce the declared ESM/declaration output without fallback compiler, diagnostic, or generated source change."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "Complete Node test suite and production persistence matrix",
        "criterion": "pnpm test exits 0 with every configuration, repository utility, feasibility, Domain Core, and new persistence test discovered and passing; no test is skipped/todo, no unsupported external E2E is fabricated, every negative fixture remains below its owned disposable generation, and no .task-artifacts child survives."
      },
      {
        "id": "V11",
        "type": "automated",
        "target": "Frozen dependency and registry policy",
        "criterion": "pnpm dependency:check exits 0 offline and proves zero production dependencies, exact TypeScript 5.9.3 as the only development dependency, exact Node/pnpm/package-manager/lockfile/.npmrc policy, no install script or credential drift, and no network-dependent audit result is claimed."
      },
      {
        "id": "V12",
        "type": "automated",
        "target": "Packed persistence/package consumer boundary",
        "criterion": "pnpm package:smoke exits 0 offline, packs exactly the declared Domain Core, persistence declarations/code, and immutable migration files, installs the tarball into a disposable consumer, imports the declared root persistence surface, performs a fresh disposable open/read/backup verification without a product CLI claim, confirms the ato console remains status-only, uninstalls, and leaves no owned artifact."
      },
      {
        "id": "V13",
        "type": "automated",
        "target": "Complete available repository gate without network repair",
        "criterion": "With network-disabled npm/pnpm settings and the existing frozen local store, pnpm verify:offline exits 0 end-to-end at the final material state, including lint, typecheck, build, all tests, docs, dependency shape, package smoke, Windows SQLite feasibility, and truthful Codex blocked-boundary checks, with no download, substitution, omission, repair, or surviving creator-owned artifact."
      },
      {
        "id": "V14",
        "type": "automated",
        "target": "ExecPlan lifecycle, independent audits, scope, evidence freshness, terminal persistence, and coordinator readiness",
        "criterion": "Immediately before staging, fresh exec_plan trace reports schema v3, exact task scope, no error/warning/outside-scope or stale state, current approval digest/base, fresh independent A0 and A1, every required A2 closure-safe, M1-M6 and V1-V14 successful, a nonempty final summary, and no derived completion blocker; final staging, task commit, coordinator prune, exact-head gate receipts, ready, integration, and eligible push remain separate consumers of this completed plan rather than circular inputs to it."
      }
    ],
    "risks": [
      { "id": "R1", "risk": "A runtime-root alias, reparse point, overlap, or path race could write database or recovery material into source, a Project, or unrelated user data." },
      { "id": "R2", "risk": "A duplicated or mutable migration definition, forged history, partial DDL, or missing pre-upgrade backup could make schema state ambiguous or unrecoverable." },
      { "id": "R3", "risk": "Permissive SQLite/JSON decode could silently coerce corrupt rows, skip Tasks, or produce a false valid DomainSnapshot." },
      { "id": "R4", "risk": "Unbounded SQLite waits, overlapping migration/restore/open operations, asynchronous transaction callbacks, or stale connection receipts could create partial writes or unsafe replacement." },
      { "id": "R5", "risk": "A backup may be self-consistent but stale/incomplete, or restore may crash between retaining the prior file set and publishing the replacement." },
      { "id": "R6", "risk": "The large historical all-phase schema could remain frozen or implementation prose could overclaim EP-01C/EP-01D, Phase 2 execution, authorization, platform support, or product readiness." },
      { "id": "R7", "risk": "Repository/toolchain expansion could weaken the Domain Core isolation, introduce a dependency, omit package migration bytes, or admit forbidden generated/runtime artifacts." },
      { "id": "R8", "risk": "Post-EP-01A governance commits or a later master advance could invalidate material evidence or be mistaken for a product predecessor change." },
      { "id": "R9", "risk": "Validation corruption/restore/path fixtures could escape their creator-owned generation or leave .task-artifacts content that invalidates terminal coordinator receipts." },
      { "id": "R10", "risk": "Scope drift, pre-existing content, audit findings, or a stale material state could be hidden by a broad commit, premature integration, or unsupported cleanup." }
    ]
  },
  "execution_contract": {
    "decisions": [
      { "id": "D1", "statement": "Use 2df03a4f6a2106555740944596924561e2753e89 as the approval and current material base while retaining 71dc606d5e4c40de4f669d0732da653d81bc8f92 as the strict product predecessor terminal.", "rationale": "The intervening two commits change only maintainer artifact-policy governance and validation tooling; their execution impact is incorporated without relabeling them as product predecessors." },
      { "id": "D2", "statement": "Treat EP-01B as Tier 2 persistence and review the complete writer/reader, identity, ingress, pre-mutation, topology, lock/transaction, inventory/terminal, and recovery transitions.", "rationale": "The task introduces authoritative database state, migrations, backup publication, restore resumption, and concurrent access." },
      { "id": "D3", "statement": "Ship exactly two staged migrations: 0001 owns persistence metadata/history and 0002 owns only Domain Core Project, Task, and dependency storage; later plans append migrations without editing these bytes.", "rationale": "A real earlier-prefix upgrade can be tested now while avoiding premature allocation of EP-01C/EP-01D and Phase 2/3 tables." },
      { "id": "D4", "statement": "Load committed SQL through one frozen migration registry and calculate uppercase SHA-256 from exact file bytes at ingress; package the same SQL files consumed by source and tests.", "rationale": "One byte owner prevents DDL, checksum, fixture, and distribution drift." },
      { "id": "D5", "statement": "Implement persistence under src/persistence using only Node built-ins and locally declared narrow built-in types; re-export only the documented foundation from the package root and keep the ato console status-only.", "rationale": "This expands the production owner without adding a dependency or application/interface behavior." },
      { "id": "D6", "statement": "Require callers to supply the protected checkout/Project roots when preparing a runtime root; construct all database, backup, restore, lock, and connection-receipt paths internally below the validated root.", "rationale": "The persistence owner cannot infer all registered Projects, and caller-selected descendant paths would split path authority." },
      { "id": "D7", "statement": "Use one short-lived exclusive lifecycle lock for migration, backup publication, restore, and connection-receipt creation; retain a no-follow identity-bound receipt for each open store; use SQLite BEGIN IMMEDIATE for ordinary writes and synchronous callbacks only.", "rationale": "This serializes topology-changing operations, makes active or crash-stale connections observable, and prevents transactions from spanning awaited work." },
      { "id": "D8", "statement": "Use one repository/decoder owner to read the complete DomainSnapshot and atomically commit trusted Domain Core mutations by exact prior snapshot and Task revision; do not duplicate domain transition logic or expose direct SQL.", "rationale": "EP-01C can orchestrate authorization and domain commands later while persistence stays a narrow storage owner." },
      { "id": "D9", "statement": "Publish backups by private-directory rename after exact verification; restore only a verified generation after expected-current raw file-set CAS and acknowledgement, persist one exact restore intent, retain all prior primary members, and finalize an immutable receipt after typed target readback.", "rationale": "The design preserves actual partial success and permits deterministic recovery without reverse migration, overwrite, or fabricated rollback." },
      { "id": "D10", "statement": "Open refuses a pending restore intent, incompatible/newer schema, corrupt history/row, or upgrade with other connection receipts; automatic repair, replacement initialization over an existing path, and stale-lock deletion do not exist.", "rationale": "Unknown ownership or state must remain blocked for a later doctor/user decision." },
      { "id": "D11", "statement": "Keep product tests and package smoke under unique creator-owned .task-artifacts generations and rely on their existing receipt-bound cleanup plus the coordinator's final prune receipt.", "rationale": "Runtime data stays outside Git and terminal evidence proves no task scratch survives." }
    ],
    "milestone_recovery": [
      { "id": "M1", "recovery": "Keep the unique plan in proposal and make no product implementation edit until predecessor/current-base evidence, scope, staged schema, Tier-2 controls, and fresh independent A0 are exact." },
      { "id": "M2", "recovery": "Stop on any dependency/toolchain/package/source-boundary drift; retain Domain Core bytes and the status-only CLI, and repair only the declared package/tooling paths." },
      { "id": "M3", "recovery": "On unsafe root, lock/receipt ambiguity, connection-policy failure, unknown/newer schema, history mismatch, busy timeout, migration failure, or failed backup, close owned handles and return a typed blocked result without normal repository mutation or replacement initialization." },
      { "id": "M4", "recovery": "Roll back the complete BEGIN IMMEDIATE transaction on stale snapshot/revision, constraint, decode, or DomainSnapshot failure; preserve the offending database for read-only diagnosis and never skip or coerce a row." },
      { "id": "M5", "recovery": "Before publication leave an unpublished stage; after a restore intent preserve exact observed file placement, prior bytes, and intent. Explicit recovery may finish only an exact recognized target or report blocked ambiguity; it never deletes the retained source." },
      { "id": "M6", "recovery": "A failed validation or audit keeps the task reserved and editable. Repair only in scope, refresh material evidence, rerun required A2/full gates, and do not commit/integrate/push until all lifecycle and coordinator gates are exact." }
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
      { "id": "V11", "state_binding": "material" },
      { "id": "V12", "state_binding": "material" },
      { "id": "V13", "state_binding": "material" },
      { "id": "V14", "state_binding": "material" }
    ],
    "risk_controls": [
      { "id": "R1", "mitigation": "Validate exact lexical and real path topology before creation, reject overlap and every link/reparse/non-directory component, construct descendants internally, and revalidate identity around creation and protected mutation.", "recovery": "Return UNSAFE_RUNTIME_ROOT or PATH_IDENTITY_CHANGED before protected mutation and preserve every unrelated path." },
      { "id": "R2", "mitigation": "Use one immutable file-backed registry, contiguous exact-prefix comparison, per-migration transaction/history/postconditions, and a verified pre-upgrade online backup for an existing older schema.", "recovery": "Rollback the failed migration, retain the verified backup and unchanged history, and refuse restart until registry/history are exact." },
      { "id": "R3", "mitigation": "Check exact storage classes, enum/conditional shapes, safe integers, FK integrity, and reconstruct the complete snapshot through the Domain Core once.", "recovery": "Return typed INTEGRITY_ERROR/CORRUPT_ROW, stop normal writes, and retain bytes for diagnosis or explicit verified restore." },
      { "id": "R4", "mitigation": "Verify busy_timeout=5000, use short synchronous BEGIN IMMEDIATE/read transactions, reject Promise callbacks, serialize topology changes with one lock, and record exact open-connection ownership.", "recovery": "Rollback owned transactions, close owned connections, preserve stale receipts/locks as blockers, and require later explicit diagnosis rather than guessing ownership." },
      { "id": "R5", "mitigation": "Bind exact backup inventory/database/manifest/schema/history identities, verify via separate read-only ingress, CAS the complete current primary inventory, retain prior members, and persist restore intent before file moves.", "recovery": "Classify only exact pre/partitioned/target states, finish or finalize recognized transitions idempotently, and leave mixed or substituted state blocked with prior evidence intact." },
      { "id": "R6", "mitigation": "Replace the all-phase physical allocation with an implemented EP-01B migration table plus explicitly unallocated later phases; update status and evidence prose at every authority entry point.", "recovery": "Fail documentation/authority review and revise current contracts without editing historical plans or claiming future modules." },
      { "id": "R7", "mitigation": "Freeze the expanded source/migration/package inventory in lint/configuration/package-smoke tests, confine built-in I/O imports to persistence, and retain zero production dependencies.", "recovery": "Reject lint/package/dependency gates and remove only task-owned drift before review; never repair via network or dependency addition." },
      { "id": "R8", "mitigation": "Record the EP-01A terminal separately from current base, assess every intervening path, and use ExecPlan base-diff/transition rules if master advances.", "recovery": "Stop, refresh through the coordinator only when eligible, write the required base assessment, and rerun stale material validation/A1/A2 as routed." },
      { "id": "R9", "mitigation": "Create unique receipt-bound test generations, use only internally derived children, preserve failure evidence during the test, and run existing safe creator cleanup plus final coordinator prune.", "recovery": "A surviving or identity-drifted generation fails tests/prune; report it without force deletion and do not record a passed terminal gate." },
      { "id": "R10", "mitigation": "Trace before lifecycle decisions, keep exact task paths, use independent audits, inspect final staged inventory, bind evidence/gates to one commit, and let coordinator commands alone mutate task lifecycle.", "recovery": "Keep the plan active and task reserved, preserve out-of-scope content, and request new authority only for a genuine boundary expansion." }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "2df03a4f6a2106555740944596924561e2753e89",
      "current_material_base": "2df03a4f6a2106555740944596924561e2753e89",
      "base_transitions": []
    },
    "milestone_progress": [],
    "validation_results": [],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/ep01b_a0_r6, A0 attempt 6",
        "independence": "Fresh independent read-only A0 reviewer, separate from the plan author and implementer. The review made no file, plan, Git, coordinator, network, secret, external-repository, D:/quant, or external-state mutation and granted no permission.",
        "scope": "Complete revised schema-v3 EP-01B approval_contract and execution_contract; harness-exec-plan PLAN-SCHEMA and A0 requirements; Tier-2 PERSISTENCE-AUDIT transition lens; repository AGENTS.md, ARCHITECTURE.md, documentation/plan lifecycle, all authoritative reference contracts, security contracts, compatibility and feasibility evidence; complete current plan including A1 findings; current trace, predecessor terminal/history, Git material base, exact task scope, dirty/untracked inventory, authorization, milestones, binary validations, risks, and recovery.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-29 15:27:02+08:00",
        "approval_sha256": "048C8F1B56866DA0D05FE0DA37A62A00407C157C18BC4216AFC7ECD17D455622",
        "reviewed_material_base": "2df03a4f6a2106555740944596924561e2753e89",
        "evidence": "Current trace reported schema v3, no warnings, approval/current material base 2df03a4f6a2106555740944596924561e2753e89, zero base transitions, canonical approval size 26454 bytes, and digest 048C8F1B56866DA0D05FE0DA37A62A00407C157C18BC4216AFC7ECD17D455622; its sole error was the expected E_LIFECYCLE caused by stale A0 attempt 5. Independent canonical UTF-8 sorted-key compact-JSON recomputation reproduced the exact size and digest. Removing only task path scripts/codex-contract.mjs reproduced the prior 26402-byte digest D67C7C7D8CFC47650B1CAEE6F7FC8F3680A90576054CC21692F508E70156AA98, proving this is the sole approval-contract delta. Git reported SHA-1, HEAD and merge-base exactly at the reviewed base on task/ep-01b, no staged path, and 40 modified or untracked paths; all are covered by the 36 non-overlapping task envelopes, with no external path or pre-existing dirty item. scripts/codex-contract.mjs is a tracked, currently clean regular file and package.json deterministically invokes it as the final pnpm verify:offline route; its hardcoded three-file pre-persistence inventory conflicts with the already-approved 13-file source boundary, so the exact added scope is necessary and sufficient. EP-01A terminal and the two governance-only intervening commits remain exact. Goal, non-goals, authorization, staged schema, Tier-2 outcomes, milestones, binary validations, recovery, and non-claims remain coherent. A1 findings F-A1-01 through F-A1-06 remain implementation/A2 blockers and receive no closure from this A0.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/ep01b_a1, A1 attempt 1",
        "independence": "Fresh independent read-only reviewer; no file, plan, Git, coordinator, network, secret, other-repository, or external-state mutation.",
        "scope": "Complete active EP-01B plan and evidence; current trace and full material diff; repository authorities; migration SQL/registry; persistence source, tests, scripts, package/config; predecessor/base evidence; Git-flow state; full Tier-2 persistence lens.",
        "reviewed_at": "2026-08-29 15:15:22+08:00",
        "evidence": "Trace remained schema v3 with approval digest D67C7C7D8CFC47650B1CAEE6F7FC8F3680A90576054CC21692F508E70156AA98, material base/head 2df03a4f6a2106555740944596924561e2753e89, 40 task-owned material paths, no external or pre-existing dirty paths, and the Git-flow reservation held by ep-01b. EP-01A and the two governance-only intervening commits were verified. Exact offline TypeScript 5.9.3, typecheck, build, package smoke, and 93 tests passed without download. The complete offline route failed deterministically at the stale three-file Codex source inventory, while V10 remained unrecordable with two ignored task-artifact residues. Independent source review reproduced missing path-identity bindings at protected filesystem transitions, the restore intent catch-boundary gap, the read-only connection cleanup gap, incomplete V8 lint evidence, and the schema-metadata writer-closure documentation conflict.",
        "reviewed_state_id": "git-sha1:f08ce94ce316f5210e1acd0f29f980265a7bd901",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-A1-01",
            "severity": "HIGH",
            "summary": "Protected backup, restore, and connection-receipt filesystem transitions are not bound to retained parent, dynamic-directory, source, stage, and terminal-readback identities.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Retain and revalidate issued and dynamic directory/file identities immediately before and after every protected mutation and after each await or hook, bind verification and publication to the same source/stage/content, reserve SQLite-created targets exclusively or equivalently, enforce private mode before sensitive bytes, and add deterministic swaps at the actual operation boundaries.",
            "closure_evidence": "Not closed at A1: repair the implementation and operation-boundary tests, rerun every affected path/backup/restore gate, and obtain fresh independent A2 on the repaired final material state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-02",
            "severity": "MEDIUM",
            "summary": "Restore can cross durable intent publication and then return a path or lifecycle error instead of RESTORE_RECOVERY_REQUIRED with the restore identity.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Make successful exclusive intent publication the exact catch boundary and normalize every subsequent failure to RESTORE_RECOVERY_REQUIRED while preserving the restoreId and original cause.",
            "closure_evidence": "Not closed at A1: add deterministic failures immediately after intent publication and before primary moves, rerun restore recovery evidence, and obtain fresh independent A2.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-03",
            "severity": "MEDIUM",
            "summary": "Read-only SQLite open can leak its owned handle when setup or policy inspection throws after construction.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Retain the handle outside the setup block, close every unsuccessful open while preserving the authoritative typed error, and add a deterministic post-construction setup failure regression.",
            "closure_evidence": "Not closed at A1: repair openReadOnlyDatabase, rerun backup/corruption and handle-release evidence, and obtain fresh independent A2.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-04",
            "severity": "MEDIUM",
            "summary": "The complete offline gate is impossible because scripts/codex-contract.mjs hardcodes the pre-persistence three-file source inventory and was absent from task scope.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Add only scripts/codex-contract.mjs to the task scope, obtain fresh independent A0 for the revised approval digest before editing it, and consume the same exact production-source inventory owner as lint without weakening the Codex/OpenAI prohibition.",
            "closure_evidence": "Not closed at A1: this approval revision invalidates the prior A0; after fresh A0, repair the gate, rerun verify:offline, and obtain fresh independent A2.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-05",
            "severity": "MEDIUM",
            "summary": "V8's pnpm lint route does not implement its declared exact migration inventory and general built-in ownership checks.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Extend the in-scope lint owner and regression evidence to enforce the exact committed migration inventory and declared Node built-in ownership boundary.",
            "closure_evidence": "Not closed at A1: repair V8 without weakening its approved criterion, rerun lint/configuration/scaffold evidence, and obtain fresh independent A2.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-06",
            "severity": "LOW",
            "summary": "Writer-closure documentation assigns all schema_metadata writes to migrations.ts even though repository initialization owns domain_initialized.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Split durable field ownership explicitly: migrations own schema/version/registry/timestamp identity while the repository initializer solely owns the one-time domain_initialized transition.",
            "closure_evidence": "Not closed at A1: repair the authoritative table and include the change in the already-required fresh A2 review.",
            "closure_state_id": null
          }
        ]
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-A0-01", "F-A0-02", "F-A0-03", "F-A0-04"],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-08-29 12:50:02+08:00 confirmed one HIGH and three MEDIUM approval gaps under digest F97B02361EA6938C6AAEFB32DFB7DC29C0C1971BA92D6AF081EACD5A60297A7B. V1 now records the expected E_CHAIN limitation for intervening governance commits instead of claiming acceptance; the standing ordinary origin/master push is the sole network exception consistently across authorization text; V3 now freezes lifecycle-lock/connection-receipt ownership, contention, identity-loss, crash-residue, and active-reader checkpoint evidence; and C7/C8/V3/V5 now cover default/override root resolution, supported-host private permissions, and checkpoint safety. All findings were confirmed in scope and the revised approval contract requires fresh A0."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "The ready A0 bound digest 0A8232B204923E636C8D9A27D6608C74909754398BFE8083B2FA13CE585F7A43. The first active trace then reported W_PREFLIGHT_LIFECYCLE_SCOPE because the contract used docs/plans/proposals while the schema-v3 lifecycle convention derives docs/plans/proposal. The task path was corrected without changing any product, schema, persistence, authorization, validation, or external-action outcome; the scope digest changed and requires fresh A0 before implementation."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": ["F-A0-05"],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-08-29 13:13:35+08:00 confirmed one MEDIUM scope gap under digest A8164ECCA8EA9BB7D90EDD93A2FB2841D3CFB7E3C935639ABF8DFD82C30A3681: AGENTS.md is the higher-authority current-capability statement and still says no persistence repository exists, while EP-01B implements that narrow owner and V7 requires authority truthfulness. The original user authorization explicitly requires authoritative-contract convergence and complete EP-01B implementation, so AGENTS.md is now task-owned for only that truthful status update; no product, schema, external-path, permission, or adjacent capability boundary expands. Fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "The ready A0 bound digest C943C0668979B51A9F2795AFB28D11B78CCD665868750F898090925817BBA93B. Stable implementation inventory then proved that the approved placeholder test/persistence.test.mjs did not cover the seven exact responsibility-split persistence test/helper files. The original user authorization already covers the same EP-01B behavior and validation outcome, but schema-v3 scope must name the actual task-owned paths; the approval digest changed and requires fresh independent A0 before further product mutation."
      },
      {
        "audit": "A0",
        "attempt": 5,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "The ready A0 bound digest D67C7C7D8CFC47650B1CAEE6F7FC8F3680A90576054CC21692F508E70156AA98. Fresh independent A1 then proved that the required complete offline gate reaches scripts/codex-contract.mjs, whose pre-persistence source inventory must converge with the already approved expanded source boundary. The original product, schema, persistence, security, validation, external-path, and authorization outcomes do not change, but schema-v3 scope must add that exact script before it is edited; the approval digest changes and requires fresh independent A0."
      },
      {
        "audit": "A2",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-A2-01", "F-A2-02"],
        "disposition": "reopened",
        "reason": "Fresh independent A2 attempt 1 at 2026-08-29 15:59:25+08:00 bound git-sha1:7613a664cc7b07c1894df83242ee55d05077dc6c and independently closed F-A1-02 through F-A1-06, but left F-A1-01 open through two direct residuals. F-A2-01 (HIGH) found that present WAL/SHM members could be touched before no-follow binding and that backup rename lacked an immediate post-hook exact stage-inventory/content check. F-A2-02 (MEDIUM) found no current-primary CAS recapture after the restore staging await or at durable-intent publication. Both findings were confirmed in scope, require implementation and operation-boundary tests, and route to fresh repeat A2 without broad A1 reopening or A3."
      }
    ],
    "validation_attempts": [],
    "contract_revisions": [
      {
        "at": "2026-08-29 12:51:52+08:00",
        "summary": "Close F-A0-01 through F-A0-04 by making product-predecessor evidence truthful across intervening governance commits, aligning the sole standing-push network exception, and freezing the missing Tier-2 lifecycle-lock, connection-receipt, runtime-root, permission, and active-reader checkpoint outcomes without expanding product scope.",
        "previous_approval_sha256": "F97B02361EA6938C6AAEFB32DFB7DC29C0C1971BA92D6AF081EACD5A60297A7B"
      },
      {
        "at": "2026-08-29 13:02:38+08:00",
        "summary": "Correct the schema-v3 proposal lifecycle task path from the noncanonical plural directory to docs/plans/proposal after the first active trace warning; no product, schema, authorization, validation, persistence, or external-action outcome changed.",
        "previous_approval_sha256": "0A8232B204923E636C8D9A27D6608C74909754398BFE8083B2FA13CE585F7A43"
      },
      {
        "at": "2026-08-29 13:14:36+08:00",
        "summary": "Close F-A0-05 under the user's original authoritative-contract convergence authorization by adding AGENTS.md only for the narrow implemented-persistence-foundation status update while preserving every adjacent capability and external-action non-claim.",
        "previous_approval_sha256": "A8164ECCA8EA9BB7D90EDD93A2FB2841D3CFB7E3C935639ABF8DFD82C30A3681"
      },
      {
        "at": "2026-08-29 14:48:55+08:00",
        "summary": "Replace the unrealized monolithic persistence-test placeholder with the seven exact responsibility-split persistence test and helper paths already required by the same approved validation matrix; no product, schema, persistence guarantee, permission, external path, or external action changes.",
        "previous_approval_sha256": "C943C0668979B51A9F2795AFB28D11B78CCD665868750F898090925817BBA93B"
      },
      {
        "at": "2026-08-29 15:21:25+08:00",
        "summary": "Add only scripts/codex-contract.mjs to the exact task scope after A1 proved that the complete approved offline route reaches its stale pre-persistence source inventory; no product, schema, persistence guarantee, validation criterion, external path, dependency, permission, or external action changes.",
        "previous_approval_sha256": "D67C7C7D8CFC47650B1CAEE6F7FC8F3680A90576054CC21692F508E70156AA98"
      }
    ],
    "final_summary": null
  }
}
```

## Context

EP-01A implemented only the pure in-memory Domain Core. The current base also
contains two completed maintainer-governance commits that adopted and verified
the repository's task-artifact policy; they are not product-roadmap
predecessors. This plan applies the user's newer product split and stages the
physical schema so future owners add only the records their approved phase can
actually implement and validate.
