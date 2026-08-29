# ExecPlan: implement the Phase 1 ProjectRegistry, authorization, and application service

EP-01C follows the completed EP-01B product terminal while treating the later
task-artifact governance commit as a separately assessed repository-base
transition. It implements only local persisted task-management application
use cases; execution and product interfaces remain later work.

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-29 19:18:49+08:00",
    "updated_at": "2026-08-30 00:13:26+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user delegation for complete EP-01C implementation",
        "at": "2026-08-29 19:18:49+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "current user delegation for task commit, coordinator FF-only integration, and eligible ordinary origin/master push",
        "at": "2026-08-29 19:18:49+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Starting from the unique completed EP-01B product terminal, implement and validate EP-01C: a safe local ProjectRegistry, a single-user runtime authorization owner, and a typed application service through which Project, Task, dependency, status, and query use cases consume the existing Domain Core and persistence owners; append only the Phase 1 schema records required by those owners and atomically persist every accepted mutation with its current authorization decision and sanitized append-only audit evidence, without implementing execution or a product interface.",
    "non_goals": [
      "Do not create, activate, implement, reserve, or pre-allocate EP-01D, its product CLI, backup/restore/doctor user surface, or Phase 1 closure.",
      "Do not implement EP-02 execution attempts, Manual ExecutionBackend, running/completed execution flow, claim, completion acceptance, lease, fence, workspace, gate, intent/effect, dispatcher, scheduler, port, adapter, MCP, plugin, Git/Project mutation, or external side effect.",
      "Do not edit, reorder, or regenerate the committed 0001 or 0002 migration bytes or allocate any Phase 2/3 execution, intent, workspace, scheduler, gate, completion, adapter, MCP, or dispatcher table.",
      "Do not turn the local actor/grant model into team accounts, RBAC, cloud identity, a default administrator, wildcard action, inherited text/path authority, or a security/support claim against another same-user or privileged process.",
      "Do not treat Project content, Task bodies, repository files, prompts, tool output, adapter text, Agent text, a plan, a test, or a prior decision as actor identity, a grant, a confirmation, or authority for a mutation.",
      "Do not modify D:/quant or another repository, access a secret/account, use arbitrary network access, create a PR, release, deploy, force, rebase, reset, stash, clean, run coordinator cleanup, or perform an external Project/Git mutation.",
      "Do not add a production dependency, change Node 24.19.0, pnpm 11.19.0, TypeScript 5.9.3, claim hosted CI, or claim a supported platform/release from local evidence.",
      "Do not rewrite completed plans or historical evidence in the fixed EP-01A -> EP-01B -> EP-01C -> EP-01D -> EP-02 product chain."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "EP-01B terminal commit a2a898e13b5231a1dd061ad1a6bb77df146383ce is the strict product predecessor. The later 4594c859e4cb172353cc93298518b0a7eafb7fb3 base adds only repository artifact-governance behavior and must be assessed through an explicit schema-v3 base transition rather than becoming a product predecessor.",
        "source": "Current user decision; docs/plans/README.md; read-only terminal-resolve and Git history evidence"
      },
      {
        "id": "C2",
        "statement": "SQLite allocation remains additive and phase-scoped: EP-01C appends exactly one migration after immutable 0001/0002 and allocates only ProjectRegistry, bootstrap/grant/decision, request-consumption, and append-only audit records required by implemented Phase 1 task management.",
        "source": "Current user decision; docs/reference/persistence-contract.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C3",
        "statement": "ProjectRegistry is the sole owner of canonical local Project roots, no-follow identity receipts, enabled state coordination, config revision, and resource revision. Registration and later Project-bound mutation never write the registered target and fail closed on duplicate, overlap, alias/reparse, missing, substituted, or otherwise uncertain identity.",
        "source": "Current user decision; ARCHITECTURE.md; docs/security/threat-model.md N1"
      },
      {
        "id": "C4",
        "statement": "The Phase 1 local authorization owner uses trusted-ingress actor assertions, one non-recursive consumed bootstrap, finite explicit grants, exact actions/scopes, separate grant-scope and command-target revisions, revocation, expiry, request consumption, and trusted high-risk confirmations. Its implemented vocabulary is exactly authorization.grant.issue, authorization.grant.inspect, authorization.grant.revoke, policy.evaluate, project.register, project.update, project.disable, project.inspect, task.create, task.update, task.mark_ready, task.cancel, task.inspect, dependency.add, and dependency.remove; there is no wildcard, alias action, or implicit administrator.",
        "source": "Current user decisions; docs/reference/authorization-contract.md"
      },
      {
        "id": "C5",
        "statement": "A Project-scoped daily capability may cover Project resources only through an explicit canonical constraint and remains usable only while its bound Project resource/config revision is current. Task command CAS still binds the exact target Task revision. Local policy can deny or narrow a matching grant but can never create or broaden authority.",
        "source": "Current user daily-capability and no-expansion decisions; docs/reference/authorization-contract.md"
      },
      {
        "id": "C6",
        "statement": "The application service is the only public owner of typed commands and queries, trusted actor/correlation/request identity, authorization evaluation, Domain command selection, transaction coordination, and stable result mapping. It calls Domain Core functions and typed persistence repositories rather than copying state-transition, parent, dependency, or terminal rules.",
        "source": "Current user decision; ARCHITECTURE.md dependency constraints; docs/reference/domain-contract.md"
      },
      {
        "id": "C7",
        "statement": "Each operation has one explicit BEGIN IMMEDIATE atomic shape: bootstrap consumes one request while inserting the consumed bootstrap, only the fixed initial grants, one sanitized audit event, and terminal authorization readback without inventing a grant-derived allow; grant issue/revoke consume one current confirmed administrative allow and atomically write the grant change, request, decision, audit, and terminal grant readback; registry/Domain mutations atomically write the consumed allow, request, exact Project/Task/dependency/registry change, audit, and terminal combined snapshot; reads consume one read allow and bounded query request while appending decision/audit but change no target state; a fully bound denial writes only its deny decision, request, and audit. Any injected failure, stale revision, busy/conflicting writer, Domain rejection, corrupt ingress, or replay leaves no partial operation shape.",
        "source": "Current user decision; docs/reference/persistence-contract.md transaction boundary; Tier-2 persistence lens"
      },
      {
        "id": "C8",
        "statement": "Authorization decisions, request/query consumption, and audit events have one persistence writer, fixed typed columns, immutable append-only storage, bounded sanitized details, and no Task body, Project path, prompt, source content, tool output, secret, or free-text authorization source. authorization.grant.inspect binds one exact grant identity/revision with read_not_applicable policy binding; project.inspect binds one exact Project identity/resource revision; task.inspect binds one exact Task identity/revision and is the sole action for that Task's body/status/dependency projection. EP-01C exposes no collection-list query. Each allow is consumed by exactly one bounded request/query and cannot authorize another operation. Rejected fully bound requests may append a deny decision/audit but never a partial Domain or registry mutation.",
        "source": "Current user decision; docs/reference/authorization-contract.md; docs/security/privacy-and-logging.md"
      },
      {
        "id": "C9",
        "statement": "EP-01C exposes only Phase 1 Project registration/enablement, Task create/body/parent/readiness/cancellation, dependency add/remove, Project/Task/status/dependency queries, and grant initialization/issue/inspect/revoke. It cannot transition a Task to running or completed and exposes no execution-facing command.",
        "source": "Current user Phase 1/EP-02 split; docs/reference/domain-contract.md"
      },
      {
        "id": "C10",
        "statement": "Migration, repository, and application decoders reject unknown fields, wrong SQLite storage classes, invalid enum/JSON shapes, malformed revisions, incomplete binding, newer schema, checksum drift, and impossible Domain/registry/authorization relations without defaults, skipped rows, replacement state, or partial success.",
        "source": "docs/reference/persistence-contract.md authoritative ingress; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C11",
        "statement": "EP-01C is Tier 2 persistence work: every new field/table/status has one writer and enumerated readers; identity and policy bind semantic inputs; mutation eligibility is rechecked before commit; lock/CAS/transaction topology is explicit; terminal evidence is exact readback; restart, interruption, and competing-writer outcomes fail closed.",
        "source": "harness-exec-plan persistence lens; current user direction"
      },
      {
        "id": "C12",
        "statement": "The frozen package remains private ESM with zero production dependencies and exact Node/pnpm/TypeScript versions. Package-root exports may add only the implemented ProjectRegistry, authorization, and application APIs; the ato console remains a truthful status projection and not the EP-01D product CLI.",
        "source": "Current user constraint; docs/reference/toolchain-contract.md"
      },
      {
        "id": "C13",
        "statement": "Fresh independent A0 is required before activation, fresh independent A1 after the stable validated diff, and fresh independent A2 after every confirmed in-scope HIGH or MEDIUM repair. The implementer cannot substitute for those reviewers.",
        "source": "Current user requirement; harness-exec-plan audit contracts"
      },
      {
        "id": "C14",
        "statement": "One task-owned terminal commit, the task-frozen pathless .task-artifacts prune receipt, exact-head gate receipts, coordinator ready, FF-only local integration, and the standing-authorized ordinary origin/master push are authorized only after every independent and repository gate is exact. Cleanup and every adjacent external action remain unauthorized.",
        "source": "Current user authorization; AGENTS.md; docs/reference/local-agent-git-flow.md"
      }
    ],
    "authorization": {
      "allowed": [
        "Read repository material and modify only task-owned paths in the coordinator-owned task/ep-01c worktree.",
        "Implement the exact EP-01C ProjectRegistry, local authorization owner, application service, one staged migration, typed repositories, contracts, tests, and truthful capability documentation.",
        "Run local offline tests that create only creator-owned disposable .task-artifacts generations and temporary Project/runtime fixtures, including deliberate corruption, replay, expiry, revocation, contention, failpoint, and alias/reparse cases that preserve their targets.",
        "Use fresh independent read-only subagents for A0, A1, and required A2 and record their reports plus parent dispositions without granting reviewer mutation authority.",
        "Create task-owned implementation and terminal commits as required by the approved lifecycle, invoke the manifest-bound pathless prune after the result commit, record exact-head gates, perform coordinator FF-only local integration, and invoke the repository standing-authorized ordinary origin/master push when every prerequisite remains exact."
      ],
      "requires_reapproval": [
        "Any change to the product goal, EP chain, public/data/security outcome, schema allocation, task-path envelope, external-path set, required gate set, binary validation criterion, Tier-2 guarantee, dependency/toolchain selection, terminal persistence action, or authorization boundary.",
        "Any implementation or schema allocation for EP-01D, EP-02, a product CLI, backup/restore/doctor surface, execution, claim/completion, dispatcher, scheduler, port, adapter, workspace, external intent/effect, gate, MCP, plugin, Git/Project mutation, or external effect.",
        "Any network action except the repository standing-authorized ordinary origin/master push after exact prerequisites, any dependency download/audit query, secret/account use, another-repository access or mutation, PR, release, deployment, non-standing push, destructive cleanup, or force/rebase/reset/stash/clean operation.",
        "Any test mutation outside exact creator-owned temporary fixtures or any mutation of a real registered Project or user runtime database."
      ],
      "prohibited": [
        "Modify D:/quant, another repository, a real external Project, user data, secrets, or accounts; create a PR; release or deploy.",
        "Use arbitrary network access, force push, rebase, reset, stash, clean, force/destructive cleanup, coordinator cleanup, history rewriting, or edits to completed plans/evidence.",
        "Commit databases, WAL/SHM files, backups, logs, runtime state, dependency stores, build/package output, ignored scratch, prompts, source excerpts, credentials, personal paths, or sensitive actor/correlation values.",
        "Interpret Project/Task/repository/prompt/tool/Agent content, a Domain-ready state, a policy allow, a prior decision, a test, or a plan as permission.",
        "Claim EP-01D, Phase 1 closure, EP-02 execution, a product CLI, external adapter, supported platform/API, hosted CI, release, deployment, or multi-user/RBAC/cloud security."
      ],
      "persistence": {
        "required": true,
        "action": "task-owned commits culminating in one completed-plan terminal commit, then manifest-backed prune, exact-head gates, coordinator FF-only local integration, and the standing-authorized ordinary origin/master push",
        "source": "Current user delegation plus AGENTS.md/local Git-flow standing grants"
      }
    },
    "scope": {
      "task_paths": [
        { "path": "AGENTS.md", "kind": "file" },
        { "path": "ARCHITECTURE.md", "kind": "file" },
        { "path": "CHANGELOG.md", "kind": "file" },
        { "path": "README.md", "kind": "file" },
        { "path": "docs/compatibility/v0.1.md", "kind": "file" },
        { "path": "docs/plans/proposal/EP-01C-project-registry-authorization-application.md", "kind": "file" },
        { "path": "docs/plans/active/EP-01C-project-registry-authorization-application.md", "kind": "file" },
        { "path": "docs/plans/completed/EP-01C-project-registry-authorization-application.md", "kind": "file" },
        { "path": "docs/plans/evidence/EP-01C", "kind": "directory" },
        { "path": "docs/reference/authorization-contract.md", "kind": "file" },
        { "path": "docs/reference/contract-ownership.md", "kind": "file" },
        { "path": "docs/reference/domain-contract.md", "kind": "file" },
        { "path": "docs/reference/persistence-contract.md", "kind": "file" },
        { "path": "docs/reference/toolchain-contract.md", "kind": "file" },
        { "path": "docs/reference/validation-policy.md", "kind": "file" },
        { "path": "docs/reference/versioning-compatibility-contract.md", "kind": "file" },
        { "path": "docs/security/privacy-and-logging.md", "kind": "file" },
        { "path": "docs/security/threat-model.md", "kind": "file" },
        { "path": "migrations/0003-phase1-application.sql", "kind": "file" },
        { "path": "package.json", "kind": "file" },
        { "path": "scripts/package-smoke.mjs", "kind": "file" },
        { "path": "scripts/repo-utils.mjs", "kind": "file" },
        { "path": "src/application.ts", "kind": "file" },
        { "path": "src/authorization.ts", "kind": "file" },
        { "path": "src/domain.ts", "kind": "file" },
        { "path": "src/index.ts", "kind": "file" },
        { "path": "src/node-builtins.d.ts", "kind": "file" },
        { "path": "src/project-registry.ts", "kind": "file" },
        { "path": "src/persistence/application-repository.ts", "kind": "file" },
        { "path": "src/persistence/backup.ts", "kind": "file" },
        { "path": "src/persistence/errors.ts", "kind": "file" },
        { "path": "src/persistence/migrations.ts", "kind": "file" },
        { "path": "src/persistence/repository.ts", "kind": "file" },
        { "path": "src/persistence/store.ts", "kind": "file" },
        { "path": "test/application-atomicity.test.mjs", "kind": "file" },
        { "path": "test/application-service.test.mjs", "kind": "file" },
        { "path": "test/authorization.test.mjs", "kind": "file" },
        { "path": "test/configuration.test.mjs", "kind": "file" },
        { "path": "test/domain-architecture.test.mjs", "kind": "file" },
        { "path": "test/domain-property-state-machine.test.mjs", "kind": "file" },
        { "path": "test/domain-unit.test.mjs", "kind": "file" },
        { "path": "test/persistence-backup-restore.test.mjs", "kind": "file" },
        { "path": "test/persistence-concurrency.test.mjs", "kind": "file" },
        { "path": "test/persistence-repository.test.mjs", "kind": "file" },
        { "path": "test/persistence-schema-migrations.test.mjs", "kind": "file" },
        { "path": "test/persistence-smoke.test.mjs", "kind": "file" },
        { "path": "test/persistence-test-helpers.mjs", "kind": "file" },
        { "path": "test/project-registry.test.mjs", "kind": "file" },
        { "path": "test/scaffold.test.mjs", "kind": "file" }
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "The unique schema-v3 EP-01C plan records the exact EP-01B terminal, independently assesses the post-terminal governance base, freezes the Tier-2 schema/authorization/application boundary, passes fresh independent A0, and becomes active without changing historical plans or successor work.",
        "validation_ids": ["V1", "V13"]
      },
      {
        "id": "M2",
        "outcome": "One immutable 0003 migration upgrades every shipped earlier prefix to the exact Phase 1 registry/authorization/audit schema while preserving 0001/0002 bytes and refusing failure, interruption, checksum, corruption, and newer-schema cases atomically.",
        "validation_ids": ["V2", "V9"]
      },
      {
        "id": "M3",
        "outcome": "ProjectRegistry safely registers or binds local Projects without changing target content, persists canonical root identity plus enabled/config/resource revisions, and rejects duplicate, overlap, alias/reparse, stale-CAS, and uncertain identities.",
        "validation_ids": ["V3", "V6"]
      },
      {
        "id": "M4",
        "outcome": "The single-user authorization owner provides trusted consumed bootstrap, bounded inspectable/revocable daily grants, exact scope/action/revision checks, non-expanding local policy, replay prevention, sanitized decisions/audit, and trusted separate-confirmation refusal for high-risk or unimplemented actions.",
        "validation_ids": ["V4", "V5"]
      },
      {
        "id": "M5",
        "outcome": "The typed application service exclusively implements Project/Task/dependency/status/query use cases by orchestrating authorization, Domain Core, and persistence owners, with accepted records and snapshot readback atomic under injected failure and competing writers.",
        "validation_ids": ["V6", "V7", "V8", "V9"]
      },
      {
        "id": "M6",
        "outcome": "The stable candidate passes package/dependency/docs truthfulness, the complete offline repository gate, fresh independent A1 and every required A2, exact pre-terminal task ownership, and ExecPlan completion readiness, with unsupported routes recorded as not run/unimplemented; terminal commit, artifact prune, exact-head coordinator gates, FF-only integration, and eligible ordinary push remain later coordinator consumers recorded outside tracked plan material.",
        "validation_ids": ["V10", "V11", "V12", "V13", "V14", "V15"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "strict product predecessor and independent current-base assessment",
        "criterion": "terminal-resolve returns only a2a898e13b5231a1dd061ad1a6bb77df146383ce for completed EP-01B; historical scope at that commit is terminal; base-diff proves it is an ancestor of 4594c859e4cb172353cc93298518b0a7eafb7fb3 and enumerates only the later governance delta; the parent records approval_unchanged without rewriting product history; chain-check reports only the expected current-base/product-terminal mismatch and no second error."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "schema-v3 migration identity, upgrade matrix, and staged allocation",
        "criterion": "Byte/checksum evidence for committed 0001 and 0002 matches EP-01B; the registry is exactly contiguous 1/2/3; fresh 0->3 and real prefix 1->3 and 2->3 upgrades pass with verified pre-upgrade backup where required; failed/interrupted 0003 is wholly absent or wholly committed on restart; checksum/history/fingerprint drift and schema 4 are typed refusals; sqlite_schema contains every and only EP-01C-approved table/index/trigger plus earlier objects."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Project root, identity, overlap, registration, and revision safety",
        "criterion": "Positive registration/restart readback preserves the exact canonical root and no-follow identity plus enabled/config/resource revision; duplicate Project/root, lexical alias, reparse/junction/symlink, missing/non-directory/root, runtime-root overlap in either direction, identity substitution, stale Project revision, and ambiguous path cases return typed refusal; byte/path inventory proves the registered target Project was not modified."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "trusted bootstrap and bounded daily grant lifecycle",
        "criterion": "A matching trusted local actor/runtime-root attestation consumes exactly one request and atomically inserts one consumed bootstrap, only the fixed finite administrative grant set, one sanitized audit record, and terminal authorization readback without a fabricated allow decision; failpoints after every staged bootstrap write roll back all members and restart preserves consumption. Missing/mismatched/expired/consumed identity refuses. Later confirmed issuance cannot exceed issuer action/scope/expiry/constraint authority and atomically commits its request/allow/grant/audit/readback; authorization.grant.inspect binds and consumes one exact grant identity/revision and returns only that grant; confirmed exact-revision revocation atomically commits request/allow/revocation/audit/readback and is irreversible. Contention/CAS, failpoint, replay, restart, and terminal-readback tests cover each authority-changing shape."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "authorization, content-injection, replay, policy, and high-risk negative boundary",
        "criterion": "Expired/revoked/missing grants, wrong actor/action/scope/grant-scope revision/target revision, malformed delegation/constraint, request or bounded-query replay, stale confirmation, local-policy deny/error, and every action outside the exact 15-action Phase 1 vocabulary all deny before target mutation; Project/Task/repository/tool/Agent injection strings never become identity/grant/confirmation or appear in authorization/audit payloads; policy never broadens a grant. authorization.grant.inspect, project.inspect, and task.inspect each require their exact single grant/Project/Task target and revision, read_not_applicable binding, one-query consumption, and sanitized decision/audit; collection-list queries are absent and rejected; external/destructive/future-phase actions remain absent or return stable high-risk/unimplemented refusal even if content asks otherwise."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Project application commands and registry/Domain/persistence convergence",
        "criterion": "Authorized Project register, legacy-v2 Project binding, enable, and disable use their exact mutation actions, while get consumes project.inspect for one exact Project identity/resource revision; no Project collection listing exists. All use the application owner and produce exact registry plus Domain Project state/revision results. Duplicate/stale/disabled/identity-invalid/cross-scope/list-attempt cases leave Project, Domain snapshot, decision/request consumption, and audit in the operation-specific all-or-deny shape with no direct public persistence writer."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Task, dependency, status, and query application parity with Domain Core",
        "criterion": "Authorized create/body/parent/mark-ready/cancel/dependency-add/dependency-remove use their exact mutation actions; Project get uses project.inspect for one exact Project identity/resource revision and Task body/status/dependency projection uses task.inspect for one exact Task identity/revision, each as a one-query consumed read decision. Results match direct Domain Core outcomes; illegal transition, cycle, duplicate/self edge, cross-Project parent, disabled Project, terminal mutation, missing identity, wrong inspect action/scope, collection/list attempt, query replay, and stale Task/Project revision are atomically rejected; no application command can select running/completed or another EP-02 event."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "single-transaction mutation, decision, audit, request, and snapshot consistency",
        "criterion": "Operation-shape tests prove: bootstrap atomically commits request/bootstrap/fixed-grants/audit/readback with no allow decision; grant issue/revoke atomically commit confirmed consumed allow/request/grant change/audit/readback; registry/Domain mutations atomically commit consumed allow/request/exact state/audit/combined readback; reads atomically consume one read allow/request and append decision/audit with no target change; fully bound denies commit only deny/request/audit. Failpoints after every staged member roll back the whole shape; competing current writers yield one exact CAS winner; replay/stale losers create no partial accepted state; decision/request/audit UPDATE or DELETE is refused."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "restart readback, concurrent access, and typed corruption refusal",
        "criterion": "After close/reopen and after verified online backup plus explicit restore, the sole authoritative v3 decoder round-trips registry/bootstrap/grants/revocation/decisions/audit/requests and Domain snapshot exactly. Backup verification and restore terminal readback call that same decoder. Wrong SQLite storage class, unknown action/scope/policy/result enum, malformed canonical constraints/details, broken FK/revision/consumption/bootstrap/audit relation, busy writer, failed transaction, corrupt/truncated database or backup, checksum drift, and newer schema yield typed failure without defaults, skipped rows, repair, publication, or false success."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "package boundary, dependency direction, and frozen toolchain",
        "criterion": "Strict TypeScript 5.9.3 typecheck/build pass; lint proves the exact production source and three-migration inventories, Domain remains I/O-free, application depends inward on Domain and internal persistence contracts, no concrete adapter/interface/feasibility dependency exists, package smoke consumes every declared ProjectRegistry/authorization/application export offline, and production dependency count remains zero under Node 24.19.0/pnpm 11.19.0."
      },
      {
        "id": "V11",
        "type": "manual",
        "target": "authoritative documentation and capability truthfulness",
        "criterion": "Exact-case repository links pass and manual authority/capability review finds one current owner for schema, registry, grants, application commands, transaction/audit, and validation; current docs claim only implemented local Phase 1 task management and explicitly retain EP-01D, EP-02, product CLI, backup/restore/doctor surface, execution, adapters, scheduler, MCP, external mutation, hosted CI, release, and platform support as unimplemented/unverified."
      },
      {
        "id": "V12",
        "type": "automated",
        "target": "complete offline repository gate",
        "criterion": "With network disabled and the frozen local dependency, pnpm verify:offline exits 0 end to end, all discovered Node tests and the targeted persistence route pass with zero fail/skip/todo, package and SQLite feasibility checks pass, Codex externalE2E remains not_run with supportClaim=false, git diff --check passes, and no task artifact survives."
      },
      {
        "id": "V13",
        "type": "manual",
        "target": "ExecPlan independent lifecycle audit",
        "criterion": "The unique plan passes fresh independent A0 at the accepted current base before activation, fresh independent A1 at the stable validated material state, and fresh independent A2 for every confirmed in-scope HIGH/MEDIUM repair; parent dispositions close every finding and the underlying lifecycle, authorization, scope, material-state, milestone, validation, audit, and final-summary gates have no error, stale evidence, outside-scope path, or blocker. No warning is permitted except W_PREFLIGHT_A2_CONVERGENCE when it is caused solely by preserving more than one factually reopened historical A2 report, the parent records an explicit convergence assessment, and the final same-family A2 is current, clean, and closure-safe."
      },
      {
        "id": "V14",
        "type": "automated",
        "target": "pre-terminal task ownership and coordinator eligibility",
        "criterion": "A fresh schema-v3 trace at the stable candidate proves only approved regular task-owned material, no completed-plan/evidence or 0001/0002 change, exact approval/base/state binding, current independent audits, terminal V1-V13/V15, completed milestones, nonempty final summary, and no error, outside-scope path, overlap, stale evidence, or blocker other than V14 recording itself. The sole permitted warning is W_PREFLIGHT_A2_CONVERGENCE under V13's exact preserved-history, parent-assessment, and current-clean-A2 conditions; it is advisory evidence of retained lifecycle history, not a waived finding or incomplete review. The tracked plan records no claimed terminal commit, prune, exact-head gate, ready, integration, or push receipt; those head-bound transitions remain exclusively in harness-git-flow coordinator state and the final user report, where success or failure is reported truthfully without writing back into task material."
      },
      {
        "id": "V15",
        "type": "manual",
        "target": "unsupported and unauthorized route truthfulness",
        "criterion": "The final evidence names every applicable route not run because no implementation, account, secret, permission, network grant, hosted environment, external Project, or supported-platform matrix exists; no dependent capability/support claim is made, and no EP-01D/EP-02, product CLI, execution, adapter, scheduler, MCP, PR, release, deployment, other-repository, secret, or cleanup action occurred."
      }
    ],
    "risks": [
      {
        "id": "R1",
        "risk": "A Project path alias, reparse point, identity swap, or runtime-root overlap could bind the wrong resource or later let an authorized command target unintended data."
      },
      {
        "id": "R2",
        "risk": "Bootstrap, grant delegation, Project-descendant capability, local policy, or high-risk confirmation could accidentally create broader or reusable authority than the actor explicitly received."
      },
      {
        "id": "R3",
        "risk": "Separating Domain, registry, authorization, request-consumption, and audit writes could leave an accepted decision or state mutation without its other terminal evidence after failure or contention."
      },
      {
        "id": "R4",
        "risk": "A schema-v3 addition or decoder change could mutate released migration bytes, silently misread an EP-01B database, pre-allocate later phases, or make interrupted upgrade/restart ambiguous."
      },
      {
        "id": "R5",
        "risk": "Application or SQL code could reproduce Domain transition, hierarchy, dependency, terminal, or revision judgments and later diverge from the Domain Core."
      },
      {
        "id": "R6",
        "risk": "Tracked lifecycle evidence could promise post-terminal coordinator receipts and create a material-head cycle, or current docs could overclaim EP-01D/EP-02/security/platform behavior."
      }
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Create the proposal against the EP-01B terminal, use base-diff to assess 4594c859e4cb172353cc93298518b0a7eafb7fb3, and accept it only as approval_unchanged governance material before A0.",
        "rationale": "This preserves the strict product predecessor while honoring current repository governance through the schema-v3 base-transition owner."
      },
      {
        "id": "D2",
        "statement": "Append only migrations/0003-phase1-application.sql with normalized ProjectRegistry, bootstrap, grant, authorization-decision/request-consumption, and application-audit storage; never change earlier migration bytes.",
        "rationale": "A separate Phase 1 migration gives every implemented shared record an authoritative schema without reserving later execution concerns."
      },
      {
        "id": "D3",
        "statement": "Keep path canonicalization and identity receipt issuance in ProjectRegistry, pure grant/policy evaluation in authorization, Domain behavior in Domain Core, SQL mapping in persistence, and orchestration/result mapping in application.",
        "rationale": "These owners preserve dependency direction and avoid parallel business-rule implementations."
      },
      {
        "id": "D4",
        "statement": "Use an application-internal synchronous persistence unit of work bound to an open PersistenceStore; it exposes typed repository operations only to application code and commits one BEGIN IMMEDIATE transaction with terminal readback.",
        "rationale": "The public store remains a trusted persistence primitive while the application controls command choice and authorization without direct SQL at interfaces."
      },
      {
        "id": "D5",
        "statement": "Treat trusted actor attestation, clock/ID generation, and high-risk confirmation as explicit trusted local ingress dependencies; command/query payloads never construct those facts.",
        "rationale": "The library has no EP-01D interface yet, so trust must be an explicit boundary rather than inferred from untrusted text or environment-shaped command data."
      },
      {
        "id": "D6",
        "statement": "Implement a built-in Phase 1 registry-local policy that can only deny based on exact Project enabled/config/resource state; no ProjectPolicy adapter or external call is introduced.",
        "rationale": "Project-bound task management must be usable in EP-01C while later adapter policy remains unimplemented and cannot broaden a grant."
      },
      {
        "id": "D7",
        "statement": "Persist only fixed audit fields and bounded canonical details generated from trusted IDs, action, result, reason, and revision metadata; never serialize command bodies, paths, arbitrary errors, or tool content into decisions/audit. Route open, backup verification, restore readback, and application restart through the same authoritative combined Domain/registry/authorization decoder.",
        "rationale": "Append-only evidence remains useful without becoming a second sensitive-content store or an authorization channel, and every durable reader enforces the same v3 relations."
      }
    ],
    "milestone_recovery": [
      {
        "id": "M1",
        "recovery": "Keep the single plan in proposal if base impact, scope, authorization, Tier-2 outcome, or A0 readiness is uncertain; do not activate or edit implementation."
      },
      {
        "id": "M2",
        "recovery": "Migration failures stay in creator-owned fixtures; verify transaction rollback and restart from the first absent registry member, never edit 0001/0002 or repair a real database."
      },
      {
        "id": "M3",
        "recovery": "Reject and close any Project registration/update whose preflight or terminal identity is missing, stale, reparse-backed, overlapping, or changed; fixtures are removed only by their creator."
      },
      {
        "id": "M4",
        "recovery": "On bootstrap/grant/policy/confirmation ambiguity, record only contract-allowed sanitized denial evidence after full binding and leave every capability/mutation unchanged."
      },
      {
        "id": "M5",
        "recovery": "Any Domain, persistence, failpoint, busy, CAS, corruption, or replay failure rolls back the complete application transaction; retain diagnostic evidence without fabricating success or retrying an external effect."
      },
      {
        "id": "M6",
        "recovery": "A failed review or gate leaves the task reserved and editable; repair in scope, recommit, refresh material evidence and required A2, then re-prune/re-gate the new exact head. Push failure remains merged_local for ordinary retry/reporting; cleanup is never invoked."
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
      { "id": "V11", "state_binding": "material" },
      { "id": "V12", "state_binding": "material" },
      { "id": "V13", "state_binding": "material" },
      { "id": "V14", "state_binding": "material" },
      { "id": "V15", "state_binding": "approval" }
    ],
    "risk_controls": [
      {
        "id": "R1",
        "mitigation": "Reject lexical ambiguity and root/non-directory targets, inspect every existing component no-follow, bind canonical root plus stable identity/platform key, reject runtime overlap and duplicates, revalidate before Project-bound mutation, and test static/deterministic substitutions without modifying alias targets.",
        "recovery": "Return typed identity refusal and leave registry, Domain, authorization consumption, audit mutation outcome, and target Project unchanged; re-registration requires a fresh explicit command after the operator resolves identity."
      },
      {
        "id": "R2",
        "mitigation": "Use one consumed bootstrap, exact finite action vocabulary, no wildcard, issuer-subset validation, finite expiry, explicit descendant constraint, current scope revision, separate target CAS, irreversible revocation, local deny-only policy, and trusted one-request high-risk confirmation.",
        "recovery": "Deny on missing/stale/ambiguous input; preserve current grants and state; issue a new narrower grant only through a separately authorized confirmed command."
      },
      {
        "id": "R3",
        "mitigation": "Use one synchronous BEGIN IMMEDIATE unit of work, exact expected snapshot/revisions, one request ID, append-only decision/audit inserts, typed repository writers, failpoints at every staged write, and terminal full readback before commit.",
        "recovery": "Rollback the transaction and return a typed failure; competing/replayed callers must reload current state and obtain any newly required authorization rather than reuse a consumed decision."
      },
      {
        "id": "R4",
        "mitigation": "Freeze earlier checksums as test constants, append one exact migration registry member, test every earlier prefix, require pre-upgrade backup, bind history/fingerprint/postconditions, and reject newer/corrupt states read-only.",
        "recovery": "Leave failed 0003 absent or committed; restart from verified history; use only the existing separately acknowledged backup/restore owner for real recovery, never ad hoc repair."
      },
      {
        "id": "R5",
        "mitigation": "Application maps explicit commands to exported Domain functions, checks only authorization/CAS/application concerns, persists only trusted Domain mutation output, and parity-tests every positive and negative application case against the Domain owner.",
        "recovery": "Treat any parity drift as a gate failure; remove the duplicate judgment and rerun Domain plus application state-machine routes before review."
      },
      {
        "id": "R6",
        "mitigation": "Keep tracked evidence limited to pre-terminal observations, bind validations/A1/A2 to exact material state, leave prune/gate/integration/push receipts solely in coordinator state and final report, and manually review capability wording.",
        "recovery": "If evidence or docs overclaim or create a head cycle, repair within scope, invalidate stale material evidence, rerun affected gates and independent review, and do not complete until trace is clean."
      }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "4594c859e4cb172353cc93298518b0a7eafb7fb3",
      "current_material_base": "4594c859e4cb172353cc93298518b0a7eafb7fb3",
      "base_transitions": []
    },
    "milestone_progress": [
      { "id": "M1", "status": "complete", "updated_at": "2026-08-29 21:38:20+08:00" },
      { "id": "M2", "status": "complete", "updated_at": "2026-08-29 21:38:20+08:00" },
      { "id": "M3", "status": "complete", "updated_at": "2026-08-29 21:38:20+08:00" },
      { "id": "M4", "status": "complete", "updated_at": "2026-08-29 21:38:20+08:00" },
      { "id": "M5", "status": "complete", "updated_at": "2026-08-29 21:38:20+08:00" },
      { "id": "M6", "status": "complete", "updated_at": "2026-08-30 00:11:37+08:00" }
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "terminal-resolve, historical scope, Git ancestry/delta, and expected chain-check mismatch",
        "evidence": "Unique EP-01B terminal a2a898e13b5231a1dd061ad1a6bb77df146383ce; historical completion_ready=true; governance head 4594c859e4cb172353cc93298518b0a7eafb7fb3 is an ancestor-only governance delta; chain-check returned only the expected current-base/product-terminal E_CHAIN. See validation-evidence.md.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "migration registry, immutable-byte, fresh/prefix upgrade, rollback/restart, and drift tests",
        "evidence": "0001/0002 are byte-identical to EP-01B; contiguous 1/2/3 fresh and 1/2 prefix upgrades passed; schema-v2 opaque IDs survive; dual grant provenance is present; failed 0003 restart plus checksum/history/fingerprint/newer-schema refusal passed. See validation-evidence.md.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "ProjectRegistry unit and application identity/revision tests",
        "evidence": "Canonical no-follow receipt, no target mutation, duplicate ID/root, Unicode/space/>128 schema-v2 legacy bind, overlap, alias/reparse, substitution, stale revision, post-confirmation revalidation, every affected cancellation Project receipt/revision case, and competing affected-Project revision denial passed. See validation-evidence.md.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "authorization unit, bootstrap/grant lifecycle, failpoint, restart, and contention tests",
        "evidence": "One finite bootstrap with fifteen fixed grants, exact deterministic administrative/source provenance, bounded delegation/inspection/revocation, forced multi-admin selection, deterministic mixed-scope runtime selection, revoked/expired runtime refusal, replay/expiry/CAS refusal, corruption refusal, and every authority-changing failpoint passed. See validation-evidence.md.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "positive/negative authorization and application boundary tests",
        "evidence": "Exact actor/action/scope/time/revision, Project-scope cross-Project refusal, deterministic runtime-scope positive despite an earlier Project grant, revoked/expired runtime refusal, per-affected-Project disabled/root-substitution/competition refusal, complete fifteen-action policy matrix, separate confirmation, content-injection inertness, exact consumed inspections, list absence, and future/external action absence passed. See validation-evidence.md.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Project application, legacy binding, registry/Domain convergence, and atomic refusal tests",
        "evidence": "Register/update/disable/inspect, duplicate/stale/identity/policy refusal, lossless Unicode/space/>128 schema-v2 binding without Domain duplication, and staged rollback passed. See validation-evidence.md.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "application-to-Domain parity and exact query tests",
        "evidence": "Task create/body/parent/readiness/cancel, dependency add/remove, exact inspect, illegal transition/cycle/terminal/cross-Project/stale cases, exact affected-set/registry/policy cancellation enforcement, and absence of running/completed commands passed. See validation-evidence.md.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "operation-specific failpoint, append-only, confirmation-order, and competing-writer tests",
        "evidence": "Bootstrap, deterministic dual-provenance grant, Project, Task, cross-Project policy/scope denial, affected-root no-record refusal, competing affected-set/revision typed denial with restart readback, read, allow/deny, decision/audit, terminal readback, and every staged member remained atomic; confirmation and filesystem work stayed outside the writer transaction. See validation-evidence.md.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "restart, backup/restore, concurrency, and combined typed-corruption tests",
        "evidence": "Combined v3 state round-tripped after restart and explicit restore; source action/scope/expiry, issue-decision-to-created-scope substitution, semantic relation, storage-class, enum/JSON, FK/revision, busy, transaction, checksum, and newer-schema refusals passed. See validation-evidence.md.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "lint, strict typecheck/build, dependency-direction tests, dependency check, and package smoke",
        "evidence": "17-source inventory, TypeScript 5.9.3, zero production dependencies, intended package-root surface, 70-file packed consumer, persistence, console, and uninstall checks passed. See validation-evidence.md.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "docs-check plus manual owner and capability wording review",
        "evidence": "64 Markdown files, 227 local links, zero forbidden references; one owner per schema/registry/authorization/application/Domain concern and local Phase 1-only capability wording confirmed. See validation-evidence.md.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V12",
        "status": "passed",
        "method": "pnpm run verify:offline and git diff --check",
        "evidence": "Exact final-state repeat exit 0: lint/typecheck/build, 193/193 tests with zero fail/skip/todo, artifact hygiene 364->364, docs, zero-production dependency check, package smoke, SQLite feasibility, blocked Codex boundary, and diff check all passed; historical superseded/transient attempts remain retained. See validation-evidence.md.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V13",
        "status": "passed",
        "method": "fresh independent A0/A1/A2 lifecycle review and parent convergence assessment",
        "evidence": "Fresh independent A0 attempt 5 approved the current C5E4BB3A642317CE99B4FF13650AAA9F452AA167523D89563376A8B65363C6DA approval contract at the accepted base; fresh independent A1 identified F-A1-001 through F-A1-004; and the final fresh same-family A2 attempt 3 reviewed exact material state git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887 with no findings and closure_safe=true. Parent convergence assessment: historical A2 attempt 1 found the all-affected-Project binding, deterministic issuance/provenance split, and tracked-plan/head cycle; attempt 2 found three bounded adjacent residuals in typed stale denial, mixed-scope runtime selection, and issue-decision scope binding. Every confirmed repair remained inside the approved EP-01C repair envelope, the final A2 independently closed F-A1-001 through F-A1-004 and F-A2-001 through F-A2-006, and both factually reopened histories remain unchanged. Therefore the sole W_PREFLIGHT_A2_CONVERGENCE advisory satisfies the exact preserved-history exception; there is no other warning, error, stale evidence, outside-scope path, overlap, or lifecycle blocker for V13.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V14",
        "status": "passed",
        "method": "fresh schema-v3 exact-state trace and task-ownership reconciliation",
        "evidence": "Fresh trace returned ok=true at exact 45-path material state git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887, approval digest C5E4BB3A642317CE99B4FF13650AAA9F452AA167523D89563376A8B65363C6DA, and base 4594c859e4cb172353cc93298518b0a7eafb7fb3. It reported outside_scope=[], overlap=[], pre_existing_dirty=[], errors=[], current independent A0/A1/A2, terminal V1-V13/V15, M1-M6 complete, and a nonempty final summary; immutable completed plans/evidence and migrations 0001/0002 are absent from the task material set. Its sole warning was the V13-adjudicated W_PREFLIGHT_A2_CONVERGENCE preserved-history advisory, and its sole completion blocker validation_not_terminal was exactly this not-yet-recorded V14. The tracked plan claims no terminal commit, prune, exact-head gate, ready, integration, or push receipt.",
        "state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887"
      },
      {
        "id": "V15",
        "status": "passed",
        "method": "manual unsupported-route and authorization-boundary inventory",
        "evidence": "Online audit, external E2E, other platforms, hosted CI, EP-01D/EP-02, product interfaces, execution/adapters, external mutation, PR/release/deploy, secrets, another repository, and cleanup are explicitly not run/unimplemented and unclaimed. See validation-evidence.md.",
        "state_id": "approval-sha256:C5E4BB3A642317CE99B4FF13650AAA9F452AA167523D89563376A8B65363C6DA"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/ep01c_a0_r5",
        "independence": "Fresh independent, strictly read-only A0 attempt 5; no file, Git, coordinator-state, fixture, network, secret, authorization, or external-state mutation.",
        "scope": "Complete revised 30,403-byte approval_contract and execution_contract, full active EP-01C plan and historical audits/evidence, authoritative repository/domain/authorization/persistence/validation/toolchain/versioning/security/Git-flow contracts, relevant implementation/tests, and the complete Tier-2 persistence transition lens.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-30 00:09:08+08:00",
        "approval_sha256": "C5E4BB3A642317CE99B4FF13650AAA9F452AA167523D89563376A8B65363C6DA",
        "reviewed_material_base": "4594c859e4cb172353cc93298518b0a7eafb7fb3",
        "evidence": "Independent duplicate-key-rejecting canonical JSON serialization reproduced exactly 30,403 bytes and SHA-256 C5E4BB3A642317CE99B4FF13650AAA9F452AA167523D89563376A8B65363C6DA. Read-only Git evidence confirmed reviewed base 4594c859e4cb172353cc93298518b0a7eafb7fb3, unique EP-01B terminal ancestry, and unchanged 45-entry material state git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887 with outside_scope=[] and overlap=[]. In-memory fresh-A0 substitution produced no parse error and only W_PREFLIGHT_A2_CONVERGENCE, caused solely by preserving two factually reopened histories. V13/V14 require the parent's explicit convergence assessment plus the current independent clean closure-safe same-family A2 and still reject every other warning/error/stale/scope/blocker. No goal, schema, scope, product, validation, runtime authorization, persistence, Tier-2, or external-action boundary changed; terminal commit/prune/gates/ready/FF-only integration/ordinary push remain later coordinator consumers and cleanup remains unauthorized.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/ep01c_a1",
        "independence": "Fresh independent read-only A1 reviewer; not the implementer. The reviewer made no file edits, Git/coordinator-state writes, external actions, or authorization decisions.",
        "scope": "Complete 45-path EP-01C material diff relative to 4594c859e4cb172353cc93298518b0a7eafb7fb3, including implementation, migration, persistence readers/writers, tests, package boundary, documentation, active ExecPlan, and validation evidence.",
        "reviewed_at": "2026-08-29 22:08:20+08:00",
        "evidence": "Fresh read-only trace returned ok=true, zero errors/warnings/outside-scope paths, exact approval digest 14B434AAA5E27ECC96474D6B291BA531E60017504D7E3CB08489136E8B5E2518, and exact reviewed state. The reviewer read the complete ExecPlan/A1/A2/Tier-2 persistence lens and repository/domain/authorization/persistence/validation/toolchain/compatibility/security authorities, then confirmed one HIGH and three MEDIUM implementation gaps not exercised by the then-current 181/181 full and 72/72 focused results.",
        "reviewed_state_id": "git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-A1-001",
            "severity": "HIGH",
            "summary": "A Project-scoped task.cancel grant could persist a Domain cancellation cascade that mutates a ready dependent Task owned by another Project.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Compute the accepted Domain mutation's affected Project write set and require runtime-scoped task.cancel authority whenever cancellation propagation crosses a Project boundary; with the current single-decision schema, fail closed and append only the bounded denial.",
            "closure_evidence": "Implemented pending independent A2: application now inspects every changed Task in the trusted Domain mutation before any Domain write, permits a multi-Project cascade only through the matched runtime-scoped grant, and atomically records a scope_mismatch denial otherwise. A delegated Project-A regression proves both Project-A prerequisite and Project-B ready dependent remain unchanged while the denial request/decision/audit is complete; the repaired focused route passes.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-002",
            "severity": "MEDIUM",
            "summary": "Delegated grants persisted only administrative grant provenance, so the decoder could not prove action, scope, and expiry were copied from an exact source capability.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Persist both the exact administrative authorization.grant.issue grant and exact candidate-action source grant, then validate their creation-time actor/action/scope/lifetime bounds, possible Project revisions, immutable edges, and acyclic bootstrap-rooted provenance on every combined decode.",
            "closure_evidence": "Implemented pending independent A2: schema 0003, authorization proof selection, application writes, immutable trigger, combined decoder, contracts, and backup/restart path now carry administrative and source grant identities. Corruption regressions independently broaden delegated action, Project revision, and expiry and are all rejected; focused authorization/persistence tests pass.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-003",
            "severity": "MEDIUM",
            "summary": "The application parser and schema-v3 request/registry/audit columns narrowed released schema-v2 opaque Domain IDs to ASCII and at most 128 characters.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Separate bounded trusted operational identities from opaque nonempty Domain Project/Task identities and preserve the schema-v2 identifier domain through ProjectRegistry, commands, authorization scope, request/audit targets, and persistence.",
            "closure_evidence": "Implemented pending independent A2: bounded operational IDs retain their strict parser while Project/Task/dependency/parent/supersession IDs use the Domain's nonempty opaque shape; v3 registry/request/audit constraints no longer add the 128-character narrowing. A real v2-to-v3 test binds a Unicode/space/>128 Project ID and creates/inspects a Unicode/space/>128 Task ID through the application owner.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-004",
            "severity": "MEDIUM",
            "summary": "policy.evaluate returned a generic Project-enabled boolean instead of the action-specific canonical local policy.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Map policy.evaluate output through the same policyFor owner used by authorization and exercise the complete fifteen-action matrix for enabled and disabled Projects.",
            "closure_evidence": "Implemented pending independent A2: policy.evaluate now calls policyFor(command.action, project, state); the canonical owner also explicitly treats project.register/update/disable as allow. The complete enabled/disabled fifteen-action matrix proves read_not_applicable, allow, and deny results through the application service.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "/root/ep01c_a2_r3",
        "independence": "Fresh independent same-family repeat A2, strictly read-only; not an implementer and no repository, Git, coordinator-state, fixture, network, secret, authorization, or external-state mutation.",
        "scope": "Complete 45-path EP-01C material state relative to 4594c859e4cb172353cc93298518b0a7eafb7fb3, active ExecPlan and historical audit dispositions, validation evidence, authoritative contracts, full repair delta, and Tier-2 persistence lens, with explicit closure review of F-A1-001 through F-A1-004 and F-A2-001 through F-A2-006.",
        "reviewed_at": "2026-08-29 23:56:04+08:00",
        "evidence": "Independent final state reproduced git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887, exact 29,904-byte approval digest 7054AB3BA3DFD7B0350222B129F2A07263A25A5401422D63A750D6847D514682, outside_scope=[], overlap=[], pre_existing_dirty=[], errors=[], and warnings=[]; git diff --check and immutable 0001/0002 checks passed. Source/decoder/test review closed affected-Project set/root/revision/policy binding, deterministic issuance decision/provenance, opaque Domain IDs, canonical policy, null-grant stale race denial with restart readback, deterministic mixed-scope runtime selection plus revoked/expired negatives, issued-scope/decision corruption refusal, and the M6/V14 plan-head-cycle repair. The recorded 193/193 offline gate and truthful unsupported-route evidence were inspected without rerunning fixture-writing tests.",
        "reviewed_state_id": "git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887",
        "parent_disposition": "complete",
        "closes": ["F-A1-001", "F-A1-002", "F-A1-003", "F-A1-004"],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-A0-001", "F-A0-002", "F-A0-003", "F-A0-004"],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-08-29 19:30:53+08:00 bound digest 92B3622F0817AFC8F98C3CE15FED3FBA4C61DC0A409F6BCF571C6633B2A2FD30 and reviewed base 4594c859e4cb172353cc93298518b0a7eafb7fb3. The parent confirmed all four findings in scope: the pre-A0 base record did not bind the actually reviewed governance head; sensitive Project/Task/grant reads lacked exact finite actions and read-decision semantics; bootstrap/grant administration lacked operation-specific Tier-2 atomic/failpoint closure; and backup/restore was an omitted direct v3 reader. The contract now binds the reviewed base, exact inspect actions, five atomic operation shapes, and shared backup/restore decoder evidence; fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-A0-005"],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-08-29 19:40:30+08:00 bound digest 603B82F7B67CD2AA0C6866795CE5FC1EC522B3E819E770C4556344774B3DD231 and the exact current base. It confirmed F-A0-001, F-A0-003, and F-A0-004 closed, but found the read-action closure incomplete because Project list had no single exact target/revision and grant inspection did not bind the inspected grant. The parent confirmed F-A0-005 in scope, removed every collection-list query, and bound grant/Project/Task inspect to one exact target/revision and one consumed bounded query; fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "accepted",
        "reason": "Fresh independent A0 at 2026-08-29 19:48:35+08:00 bound approval digest 14B434AAA5E27ECC96474D6B291BA531E60017504D7E3CB08489136E8B5E2518, reviewed base 4594c859e4cb172353cc93298518b0a7eafb7fb3, and material state git-sha1:c5e2a559021c4d8a7cb80be99629bfdf57194bbf. It found no remaining findings, verified F-A0-005 closed, and declared the plan ready_for_activation."
      },
      {
        "audit": "A2",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-A2-001", "F-A2-002", "F-A2-003"],
        "disposition": "reopened",
        "reason": "Fresh independent A2 attempt 1 at 2026-08-29 22:25:51+08:00 bound approval digest 14B434AAA5E27ECC96474D6B291BA531E60017504D7E3CB08489136E8B5E2518 and material state git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82. It directly closed F-A1-001 through F-A1-004 but confirmed two adjacent implementation residuals: affected cross-Project cancellation writes lacked per-Project policy/registry receipt binding, and multiple administrative grants could split the allow decision from durable provenance. It also confirmed the old V14 terminal-receipt criterion created a tracked-plan/head cycle. The parent confirmed all three in scope, revised only M6/V14 to the pre-terminal coordinator boundary, and requires fresh A0 before the implementation repairs plus fresh repeat A2."
      },
      {
        "audit": "A0",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "accepted",
        "reason": "Fresh independent A0 attempt 4 at 2026-08-29 22:35:12+08:00 independently reproduced the revised 29,904-byte approval contract and digest 7054AB3BA3DFD7B0350222B129F2A07263A25A5401422D63A750D6847D514682, exact reviewed base 4594c859e4cb172353cc93298518b0a7eafb7fb3, and unchanged material state git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82. It found no approval finding, confirmed M6/V14 remove the tracked-plan/head cycle without weakening mandatory coordinator completion, and left F-A2-001/F-A2-002 explicitly open for implementation and repeat A2."
      },
      {
        "audit": "A2",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-A2-004", "F-A2-005", "F-A2-006"],
        "disposition": "reopened",
        "reason": "Fresh independent A2 attempt 2 at 2026-08-29 23:22:03+08:00 bound approval digest 7054AB3BA3DFD7B0350222B129F2A07263A25A5401422D63A750D6847D514682 and material state git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e. It directly closed F-A1-001 through F-A1-004, F-A2-002, and F-A2-003, but found three MEDIUM adjacent residuals: concurrent affected-set/revision denial retained a grant shape the combined decoder rejects, lexically earlier Project grants could shadow a valid runtime cancellation grant, and delegated grant scope was not bound back to its issue-decision target. The parent confirmed all three in scope, repaired source/contracts/tests/evidence without changing the approved product contract, and requires the same-family fresh repeat A2; F-A2-001 remains open until the adjacent multi-Project repairs are independently closed."
      }
    ],
    "validation_attempts": [
      { "validation_id": "V1", "attempt": 1, "classification": "superseded", "at": "2026-08-29 22:08:20+08:00", "evidence": "The predecessor result passed at the earlier state but all material-bound validation records are superseded after the confirmed A1 repairs; it must be rebound with the current final-state validation set.", "state_id": "git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a" },
      { "validation_id": "V2", "attempt": 1, "classification": "superseded", "at": "2026-08-29 22:08:20+08:00", "evidence": "The pre-A1 schema result lacked source-grant provenance and full opaque-ID compatibility; migration and upgrade gates must be rerun at the repaired state.", "state_id": "git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a" },
      { "validation_id": "V3", "attempt": 1, "classification": "superseded", "at": "2026-08-29 22:08:20+08:00", "evidence": "The pre-A1 ProjectRegistry result did not exercise the released Unicode/space/>128 schema-v2 identifier domain; current-state registry and upgrade evidence must replace it.", "state_id": "git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a" },
      { "validation_id": "V4", "attempt": 1, "classification": "superseded", "at": "2026-08-29 22:08:20+08:00", "evidence": "The pre-A1 authorization result omitted durable source-capability provenance and its corruption matrix; the repaired authorization lifecycle must be rerun.", "state_id": "git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a" },
      { "validation_id": "V5", "attempt": 1, "classification": "superseded", "at": "2026-08-29 22:08:20+08:00", "evidence": "The pre-A1 boundary result did not reject Project-scoped cross-Project cancellation propagation or verify all policy outputs; repaired negative evidence must replace it.", "state_id": "git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a" },
      { "validation_id": "V6", "attempt": 1, "classification": "superseded", "at": "2026-08-29 22:08:20+08:00", "evidence": "The pre-A1 Project application result used only an ASCII short legacy ID; current-state v2 binding and application evidence must replace it.", "state_id": "git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a" },
      { "validation_id": "V7", "attempt": 1, "classification": "superseded", "at": "2026-08-29 22:08:20+08:00", "evidence": "The pre-A1 Domain parity result lacked cross-Project cancellation write-set authorization; the augmented application-to-Domain matrix must be rerun.", "state_id": "git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a" },
      { "validation_id": "V8", "attempt": 1, "classification": "superseded", "at": "2026-08-29 22:08:20+08:00", "evidence": "The pre-A1 atomicity result preceded the new fail-closed cancellation decision and dual-provenance grant write; current-state transaction/failpoint tests must replace it.", "state_id": "git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a" },
      { "validation_id": "V9", "attempt": 1, "classification": "superseded", "at": "2026-08-29 22:08:20+08:00", "evidence": "The pre-A1 combined decoder result lacked action/scope/expiry source-grant corruption refusal; current restart/restore/corruption evidence must replace it.", "state_id": "git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a" },
      { "validation_id": "V10", "attempt": 1, "classification": "superseded", "at": "2026-08-29 22:08:20+08:00", "evidence": "The pre-A1 code/package result is material-state-bound and must be rerun after source, schema, tests, and contracts changed.", "state_id": "git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a" },
      { "validation_id": "V11", "attempt": 1, "classification": "superseded", "at": "2026-08-29 22:08:20+08:00", "evidence": "The pre-A1 documentation result preceded administrative/source provenance, multi-Project cancellation, and filesystem revalidation wording repairs; current docs evidence must replace it.", "state_id": "git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a" },
      { "validation_id": "V12", "attempt": 1, "classification": "superseded", "at": "2026-08-29 22:08:20+08:00", "evidence": "The complete 181-test offline gate passed before the four confirmed A1 repairs and is stale; the entire offline route must be rerun at the repaired state.", "state_id": "git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a" },
      { "validation_id": "V1", "attempt": 2, "classification": "superseded", "at": "2026-08-29 22:55:00+08:00", "evidence": "The predecessor/base result remained true at the post-A1 state but its material binding was superseded when confirmed A2 implementation repairs changed source, tests, contracts, and evidence.", "state_id": "git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82" },
      { "validation_id": "V2", "attempt": 2, "classification": "superseded", "at": "2026-08-29 22:55:00+08:00", "evidence": "The migration result passed at the post-A1 state but was rebound after A2 source, authorization-contract, regression, and evidence changes; immutable migration bytes and all upgrade routes were rerun.", "state_id": "git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82" },
      { "validation_id": "V3", "attempt": 2, "classification": "superseded", "at": "2026-08-29 22:55:00+08:00", "evidence": "The registry result preceded per-affected-Project root/revision capture and substituted-dependent-root coverage and was superseded by the current exact-state route.", "state_id": "git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82" },
      { "validation_id": "V4", "attempt": 2, "classification": "superseded", "at": "2026-08-29 22:55:00+08:00", "evidence": "The authorization result preceded deterministic multi-administrative-grant decision/provenance selection and was superseded by the current exact-state route.", "state_id": "git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82" },
      { "validation_id": "V5", "attempt": 2, "classification": "superseded", "at": "2026-08-29 22:55:00+08:00", "evidence": "The boundary result lacked runtime positive plus disabled and substituted affected-Project cancellation cases and was superseded by the current exact-state matrix.", "state_id": "git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82" },
      { "validation_id": "V6", "attempt": 2, "classification": "superseded", "at": "2026-08-29 22:55:00+08:00", "evidence": "The Project application result was material-bound before affected-Project registry coordination changed and was rerun at the current state.", "state_id": "git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82" },
      { "validation_id": "V7", "attempt": 2, "classification": "superseded", "at": "2026-08-29 22:55:00+08:00", "evidence": "The Domain parity result preceded exact cancellation affected-set, registry, and policy binding and was superseded by the augmented application route.", "state_id": "git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82" },
      { "validation_id": "V8", "attempt": 2, "classification": "superseded", "at": "2026-08-29 22:55:00+08:00", "evidence": "The atomicity result preceded the A2 cancellation refusal and unified issuance selection changes and was superseded by current-state focused and complete gates.", "state_id": "git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82" },
      { "validation_id": "V9", "attempt": 2, "classification": "superseded", "at": "2026-08-29 22:55:00+08:00", "evidence": "The restart/corruption result was material-bound before the final authorization writer selection changed and was rerun through terminal combined decode.", "state_id": "git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82" },
      { "validation_id": "V10", "attempt": 2, "classification": "superseded", "at": "2026-08-29 22:55:00+08:00", "evidence": "The code/package result was superseded after application source and regression inventory changed; lint, typecheck, build, dependency, and package gates were rerun.", "state_id": "git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82" },
      { "validation_id": "V11", "attempt": 2, "classification": "superseded", "at": "2026-08-29 22:55:00+08:00", "evidence": "The documentation result preceded the per-affected-Project and deterministic issuance contract wording and was superseded by current docs evidence.", "state_id": "git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82" },
      { "validation_id": "V12", "attempt": 2, "classification": "superseded", "at": "2026-08-29 22:55:00+08:00", "evidence": "The complete 185-test post-A1 offline result became stale after confirmed A2 implementation repairs; the complete route was rerun with 187 tests.", "state_id": "git-sha1:3de9b358aa349a2512bac328f2d1ca533b3e5f82" },
      { "validation_id": "V12", "attempt": 3, "classification": "environment_failure", "at": "2026-08-29 22:55:00+08:00", "evidence": "The first A2-repair full concurrent run passed every new EP-01C case but one existing restore identity-boundary case did not reject (186/187). The exact case immediately passed alone and the unchanged complete offline route then passed 187/187, so the transient filesystem/concurrency outcome is retained rather than hidden.", "state_id": "git-sha1:aa296120d9a981da68cee2d9115aa973bce901c8" },
      { "validation_id": "V1", "attempt": 3, "classification": "superseded", "at": "2026-08-29 23:38:00+08:00", "evidence": "The predecessor/base fact remained true, but its bc4809 material binding was superseded by the confirmed A2 attempt-two repairs and the complete exact-state validation set.", "state_id": "git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e" },
      { "validation_id": "V2", "attempt": 3, "classification": "superseded", "at": "2026-08-29 23:38:00+08:00", "evidence": "Migration bytes remained immutable, but the material-bound result preceded new combined-decoder issue-scope checks and corruption regressions and was rerun.", "state_id": "git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e" },
      { "validation_id": "V3", "attempt": 3, "classification": "superseded", "at": "2026-08-29 23:38:00+08:00", "evidence": "Registry coverage preceded competing affected-Project revision regression and was superseded by the current exact-state route.", "state_id": "git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e" },
      { "validation_id": "V4", "attempt": 3, "classification": "superseded", "at": "2026-08-29 23:38:00+08:00", "evidence": "Authorization coverage preceded deterministic runtime-only multi-Project grant selection plus revoked/expired negatives and was superseded.", "state_id": "git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e" },
      { "validation_id": "V5", "attempt": 3, "classification": "superseded", "at": "2026-08-29 23:38:00+08:00", "evidence": "Boundary coverage preceded mixed Project/runtime selection and competing-set/revision typed-denial tests and was superseded.", "state_id": "git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e" },
      { "validation_id": "V6", "attempt": 3, "classification": "superseded", "at": "2026-08-29 23:38:00+08:00", "evidence": "Project application coverage was material-bound before the affected-Project competition repairs and was rerun.", "state_id": "git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e" },
      { "validation_id": "V7", "attempt": 3, "classification": "superseded", "at": "2026-08-29 23:38:00+08:00", "evidence": "Domain parity coverage preceded the authoritative affected-set race and deterministic runtime-grant selection repairs and was superseded.", "state_id": "git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e" },
      { "validation_id": "V8", "attempt": 3, "classification": "superseded", "at": "2026-08-29 23:38:00+08:00", "evidence": "Atomicity coverage lacked typed terminal readback after competing affected-set and registry-revision changes and was superseded by the new races.", "state_id": "git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e" },
      { "validation_id": "V9", "attempt": 3, "classification": "superseded", "at": "2026-08-29 23:38:00+08:00", "evidence": "Restart/corruption coverage preceded decision-to-issued-scope binding and two scope-substitution corruption tests and was superseded.", "state_id": "git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e" },
      { "validation_id": "V10", "attempt": 3, "classification": "superseded", "at": "2026-08-29 23:38:00+08:00", "evidence": "Code/package results were superseded by source and regression inventory changes and were rerun at the final repair state.", "state_id": "git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e" },
      { "validation_id": "V11", "attempt": 3, "classification": "superseded", "at": "2026-08-29 23:38:00+08:00", "evidence": "Documentation results preceded runtime-selection, typed stale-denial, and issue-decision scope-binding wording and were superseded.", "state_id": "git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e" },
      { "validation_id": "V12", "attempt": 4, "classification": "superseded", "at": "2026-08-29 23:38:00+08:00", "evidence": "The accepted 187-test complete route was superseded by six A2 attempt-two regression additions and their implementation/contract/evidence repairs; the complete 193-test route replaces it.", "state_id": "git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e" }
    ],
    "contract_revisions": [
      {
        "at": "2026-08-29 19:23:25+08:00",
        "summary": "Replace V13's derived completion_ready token with its underlying binary lifecycle gates after the initial trace warning; no product, schema, scope, authorization, persistence, validation outcome, or external action changed.",
        "previous_approval_sha256": "A2F2462FFD2BFD55565D0DAD352DA76622FC494B14DC75713DE3763D0CDA280F"
      },
      {
        "at": "2026-08-29 19:33:34+08:00",
        "summary": "Close F-A0-001 through F-A0-004 by binding the fresh reviewed governance base, enumerating exact grant/Project/Task inspect actions and bounded read decisions, freezing operation-specific bootstrap/grant/mutation/read/deny transaction shapes, and adding the existing backup/restore reader plus v3 semantic round-trip/corruption evidence. The user-authorized EP-01C goal remains unchanged.",
        "previous_approval_sha256": "92B3622F0817AFC8F98C3CE15FED3FBA4C61DC0A409F6BCF571C6633B2A2FD30"
      },
      {
        "at": "2026-08-29 19:41:18+08:00",
        "summary": "Close F-A0-005 by removing collection listing from the Phase 1 query surface and binding authorization.grant.inspect, project.inspect, and task.inspect to one exact grant/Project/Task target and revision, one read_not_applicable decision, and one consumed bounded query.",
        "previous_approval_sha256": "603B82F7B67CD2AA0C6866795CE5FC1EC522B3E819E770C4556344774B3DD231"
      },
      {
        "at": "2026-08-29 22:29:16+08:00",
        "summary": "Close F-A2-003 by limiting M6/V14 tracked evidence to exact pre-terminal task ownership and ExecPlan completion readiness while keeping terminal commit, artifact prune, exact-head gates, ready, FF-only integration, and ordinary push exclusively in harness-git-flow coordinator state and the final report. This corrects an impossible evidence cycle without changing product, schema, authorization, persistence, scope, validation coverage, or external-action authority and requires fresh A0 for the revised binary criterion.",
        "previous_approval_sha256": "14B434AAA5E27ECC96474D6B291BA531E60017504D7E3CB08489136E8B5E2518"
      },
      {
        "at": "2026-08-30 00:01:00+08:00",
        "summary": "Preserve both factually reopened A2 histories unchanged and make V13/V14 explicitly permit only the resulting W_PREFLIGHT_A2_CONVERGENCE advisory when the parent documents convergence and the final same-family A2 is current, clean, and closure-safe. No product, schema, scope, implementation, validation coverage, authorization, persistence, external-action authority, finding, or historical disposition changes; fresh A0 is required for this binary lifecycle-criterion revision.",
        "previous_approval_sha256": "7054AB3BA3DFD7B0350222B129F2A07263A25A5401422D63A750D6847D514682"
      }
    ],
    "final_summary": "EP-01C completes the local Phase 1 ProjectRegistry, finite single-user runtime authorization, and typed application service foundation for persisted Project, Task, dependency, status, and exact-query use cases. The exact 45-path material state git-sha1:6d3ddc181f0054a797741d9a0c171d995e537887 passed the full 193-test offline repository route, immutable migration/upgrade and Tier-2 atomicity/corruption/concurrency checks, documentation and package-boundary checks, and fresh independent A0/A1/A2 review; the final same-family A2 is clean and closure-safe while earlier reopened histories remain preserved. Product CLI/MCP, execution, adapters, scheduling, workspace/completion, external mutation, online audit, external E2E, non-Windows support, EP-01D, and EP-02 remain unimplemented or not run and are not claimed. Terminal commit, artifact prune, exact-head coordinator gates, readiness, FF-only integration, and ordinary non-force push remain outside tracked material and will be reported only from authoritative Git-flow state."
  }
}
```

## Context

EP-01B delivered schema version 2 and the trusted Project/Task snapshot
repository, but deliberately left Project registration, runtime authorization,
and application command selection unimplemented. EP-01C adds those owners for
local task management only. The current repository base also contains the
completed standing artifact-prune governance change, which affects maintainer
workflow but not the approved product outcome.
