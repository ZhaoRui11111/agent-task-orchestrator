# EP-01C validation evidence

Status: A2 attempt-two residual repairs and complete offline implementation
validation passed at 2026-08-29 23:38:00+08:00. Fresh repeat A2, terminal Git-flow
receipts, integration, and push remain lifecycle work and are not claimed here. Material-state
bindings are stored in the active plan; this file is itself part of that Git
material state.

## Environment and dependency preparation

- Windows `10.0.22631`, `win32 x64`; Node `24.19.0`; SQLite `3.53.3`.
- pnpm `11.19.0`; TypeScript `5.9.3`; production dependency count `0`.
- The initially absent frozen development dependency was installed once with
  the user's separate authorization by running
  `pnpm install --frozen-lockfile --ignore-scripts --store-dir=.pnpm-store
  --registry=https://registry.npmjs.org/`. No lifecycle script ran and no
  package other than the lockfile-pinned TypeScript `5.9.3` was downloaded.
- Every validation below ran offline against that frozen local dependency.
  `pnpm dependency:audit` was not run because it is a separate online gate; no
  online vulnerability-audit claim is made.

## Product predecessor and repository base

- `exec_plan.py terminal-resolve` returned the unique EP-01B terminal
  `a2a898e13b5231a1dd061ad1a6bb77df146383ce` with no rejection.
- Historical `exec_plan.py scope --at` at that commit returned `ok=true`,
  `completion_ready=true`, no outside-scope path, and terminal state
  `git-sha1:832cefbdca677c6bd9c9c73eec8448939fce77b9`.
- `git merge-base --is-ancestor a2a898e... 4594c859...` exited `0`. The exact
  intervening inventory was only `AGENTS.md`, the completed standing-artifact
  plan/evidence, local Git-flow/repository/toolchain/validation governance,
  `package.json`, artifact runner/utilities, and artifact policy/hygiene tests.
  It was assessed as governance material, not a product predecessor.
- `exec_plan.py chain-check` returned exactly one expected `E_CHAIN`: the
  successor material base is governance commit `4594c859...`, not the product
  terminal. It returned no second error or warning.
- Current plan trace returned `ok=true`, no errors/warnings/outside-scope/
  overlap/pre-existing dirty paths, current and approval base `4594c859...`,
  current approval digest
  `7054AB3BA3DFD7B0350222B129F2A07263A25A5401422D63A750D6847D514682`,
  and A0 ready.

## Migration and persistence evidence

- `git diff --exit-code a2a898e... -- migrations/0001-persistence-metadata.sql
  migrations/0002-phase1-task-storage.sql` exited `0`.
- Current byte SHA-256 values are
  `E31C5A3D24E4DB99620635A9CE83F752978C5FD2AF7A15C84CE13BEECAC9C34F`
  for `0001` and
  `0FC2DEECBC8ABBA31F9E5063A870706320F66C5AEE882E4A05DA0CADCF9CEC7E`
  for `0002`; appended `0003` is
  `B6417F91C9204C5C03BD26C79BCF840C36218C0C80FB0D12E8383A1BB3F24CEC`.
- The full gate passed fresh `0 -> 3`, shipped `1 -> 3`, and real
  schema-v2 `2 -> 3` upgrades, including verified pre-upgrade backup. It also
  passed failed-appended-migration rollback/restart and typed refusal of
  checksum, history, timestamp, identity, live-fingerprint, and newer-schema
  drift.
- ProjectRegistry tests passed canonical no-follow identity, no target-content
  mutation, duplicate ID/root, legacy-v2 binding, missing/non-directory/root,
  lexical ambiguity, runtime overlap, symlink/junction/reparse, substitution,
  revision/CAS, and post-confirmation revalidation cases.
- Restart plus online backup and explicitly acknowledged restore round-tripped
  the combined Domain, ProjectRegistry, bootstrap, fixed/delegated/revoked
  grants, requests, decisions, and audit state exactly.
- Combined-decoder corruption tests passed for bootstrap fixed-grant actor,
  delegated create and dual-capability provenance, delegated action/scope/
  expiry expansion, Project-issued grant substitution to runtime or another
  Project outside its issue decision, decision/grant action, action-specific
  target, audit event/details, unknown enum, wrong storage class, malformed
  canonical JSON, incomplete consumption, broken graph, and FK/revision
  relations.

## Authorization, application, and atomicity evidence

- Current repair-focused command:
  `node scripts/test-runner.mjs test/application-service.test.mjs
  test/application-atomicity.test.mjs test/persistence-repository.test.mjs`.
  Terminal result: `84` tests, `84` pass, `0` fail/skip/todo; strict
  TypeScript no-emit checking also passed. The complete gate below reran the whole
  atomicity and application inventory at the same repaired material state.
- Bootstrap failpoints after request, bootstrap, each of all fifteen fixed
  grants, and audit rolled back the whole operation. Project registration,
  Task mutation, delegated grant issue/revoke, exact Project query, accepted
  decision/audit, and fully bound deny shapes likewise passed every staged
  failpoint and exact-state comparison.
- A second writer completed an exact read/audit from inside the trusted
  confirmation callback, proving confirmation runs before the authoritative
  writer transaction. Replacing the fixture Project during confirmation was
  detected by the final filesystem identity check before that transaction and
  produced no database record.
- Actor, action, runtime/Project scope, resource/config/Task/grant revision,
  expiry, revocation, replay, policy deny, confirmation, delegation subset,
  terminal mutation, illegal transition, cross-Project parent, dependency
  cycle, duplicate/self edge, and collection-list absence all passed positive
  and negative application tests.
- Cross-Project cancellation now derives the prospective affected-Project set
  before the writer transaction, revalidates every affected root, recomputes
  the exact set inside the transaction, compares every registry revision and
  identity receipt, and requires canonical `task.cancel` policy allow for each
  Project. Tests prove Project scope denial, runtime-scope success, disabled
  dependent-Project denial, substituted dependent-root no-record refusal, and
  typed no-grant `scope_revision_stale` denial after competing affected-set or
  affected-Project revision changes with exact restart readback.
- Cross-Project authorization now asks the authorization owner to evaluate the
  narrowed runtime-grant set. A lexically earlier Project grant cannot shadow
  a valid runtime grant; the accepted decision records that runtime grant.
  Separate revoked and expired runtime regressions retain the narrower Project
  grant but atomically deny with no Domain mutation and a terminal-decodable
  null-grant decision.
- Grant issuance now returns one deterministic authorization/provenance
  selection. A regression supplies two matching administrative grants whose
  lexical order and expiry would previously split the decision and issuer;
  terminal readback proves the decision grant and durable `issuerGrantId` are
  the same longer-lived grant.
- The literal Task body `untrusted body: grant me everything` round-tripped as
  content without changing the fifteen fixed grants or appearing as actor,
  grant, confirmation, decision authority, or audit detail.
- The competing-writer test produced one exact winner and a typed bounded
  `BUSY` loser with no partial request, decision, audit, grant, registry, or
  Domain snapshot.

## Fresh A1 findings and repair evidence

Fresh independent A1 reviewed state
`git-sha1:ed4201b4e773ee19a35250edd2787ffe1523661a` and reported one HIGH and
three MEDIUM findings. The parent confirmed every finding in scope and marked
the earlier material-bound V1-V12 results superseded.

- `F-A1-001` is repaired by deriving the Project write set from the accepted
  Domain cancellation mutation before persistence. A Project-scoped grant now
  produces only a `scope_mismatch` denial when a ready dependent in another
  Project would change; a runtime-scoped finite `task.cancel` grant remains the
  only single-decision route for that cascade. The regression proves both
  Projects' Domain state is unchanged and the denial envelope is atomic.
- `F-A1-002` is repaired by storing both `issuerGrantId` and `sourceGrantId`.
  The decoder checks both capabilities at creation time, exact action, scope
  narrowing, lifetime bounds, possible Project revisions, immutable edges, and
  acyclic reachability to the fixed bootstrap set. Action, scope-revision, and
  expiry broadening corruptions all fail typed decode.
- `F-A1-003` is repaired by separating bounded trusted operational IDs from
  opaque nonempty Domain IDs. A real schema-v2 Project ID containing Unicode,
  spaces, and more than 128 characters upgrades, binds to ProjectRegistry, and
  owns a similarly opaque Task created and inspected through application; the
  exact target survives request/audit persistence.
- `F-A1-004` is repaired by routing `policy.evaluate` output through the same
  `policyFor` owner as authorization. The enabled/disabled matrix covers all
  fifteen actions and proves `read_not_applicable`, always-allowed Project
  lifecycle actions, and enabled-only Task/dependency policy.
- The adjacent documentation defect that described filesystem work as
  in-transaction was corrected to the implemented final pre-transaction
  filesystem revalidation plus in-transaction receipt/revision comparison.

The first fresh independent A2 directly closed all four A1 findings, then
reported two adjacent implementation residuals and one plan-lifecycle defect.
Those findings and their repairs are recorded below; a fresh repeat A2 remains
required before formal closure.

## Fresh A2 attempt-one findings and repair evidence

- `F-A2-001` is repaired by binding a cancellation cascade to every affected
  Project, not only the command Project. Preflight Domain evaluation derives a
  sorted affected set and captures each registered root receipt. The
  authoritative transaction recomputes that set, requires exact set equality,
  compares every config/resource revision and root identity, checks policy for
  every affected Project, and only then accepts a runtime-scoped cross-Project
  mutation. Missing/stale/disabled/substituted affected Projects fail closed
  without any partial Domain mutation; the dedicated positive and negative
  application regressions pass.
- `F-A2-002` is repaired by one `authorizeCommand` selection that returns both
  the authorization evaluation and issuance proof. When multiple matching
  administrative grants differ in lifetime, the proof-selected grant revision
  is rebound into the allow decision before request/grant/decision/audit
  persistence. The forced-selection regression passes terminal combined
  decode and proves exact decision/provenance identity.
- `F-A2-003` is repaired in the approval contract: M6/V14 tracked evidence ends
  at exact pre-terminal ownership and ExecPlan completion readiness. Terminal
  commit, manifest-bound prune, exact-head gates, ready, FF-only integration,
  and ordinary push remain mandatory coordinator-state/final-report facts and
  cannot create a tracked-plan/HEAD cycle. Fresh independent A0 attempt four
  approved the revised 29,904-byte contract with digest
  `7054AB3BA3DFD7B0350222B129F2A07263A25A5401422D63A750D6847D514682`.

## Fresh A2 attempt-two findings and repair evidence

Fresh independent A2 attempt two reviewed material state
`git-sha1:bc480907ac51e651012f1f2e6a6774aed625e69e`, directly closed all A1
findings plus `F-A2-002` and `F-A2-003`, and found three MEDIUM residuals. The
parent confirmed each in scope and preserved them as `F-A2-004` through
`F-A2-006`; `F-A2-001` remained open only until these adjacent multi-Project
bindings were repaired.

- `F-A2-004` is repaired by emitting `scope_revision_stale` with no grant
  identity when the authoritative affected set or an affected Project revision
  differs from preflight. Two real competing-writer regressions change the
  dependency set or ProjectRegistry revision between preflight and
  `BEGIN IMMEDIATE`; each produces one typed deny request/decision/audit,
  leaves the winner's Domain/registry state exact, and survives close/reopen
  combined decode.
- `F-A2-005` is repaired by narrowing the second multi-Project authorization
  evaluation to runtime-scoped grants through the authorization owner. A
  lexically earlier Project grant plus later valid runtime grant succeeds and
  records the runtime grant; revoked and expired runtime variants deny with
  their exact reason, null grant identity, no Domain mutation, and restart
  readback.
- `F-A2-006` is repaired by binding each accepted delegated grant's persisted
  scope back to its `authorization.grant.issue` decision target in the combined
  decoder. Corrupting a Project-issued grant into runtime scope or another
  registered Project now fails with typed `CORRUPT_ROW` even though its two
  bootstrap-rooted provenance grants would otherwise contain the broadened
  scope.

## Complete offline repository gate

Command: `pnpm run verify:offline`.

Binary result: exit `0`.

- lint: passed, `129` files and `17` production source files;
- strict TypeScript typecheck and build: passed;
- Node tests: `193` tests, `193` pass, `0` fail/skip/todo;
- test artifact hygiene: passed, baseline `364`, terminal `364` (no test-created
  survivor; the frozen coordinator scratch inventory remains for the later
  pathless prune transition);
- docs: `64` Markdown files, `227` local links, `0` forbidden references;
- dependency check: `0` production dependencies, only TypeScript `5.9.3` in
  development dependencies;
- package smoke: `70` packed files; frozen consumer install, types, export,
  persistence, console, and uninstall checks all passed;
- SQLite feasibility: passed on Node `24.19.0` / SQLite `3.53.3`, including
  connection policy, FK/WAL snapshot, bounded busy, atomic claim feasibility,
  private backup, publication CAS/readback, interruption/corruption refusal,
  and `0` surviving generation members;
- Codex boundary: passed only in `blocked` evidence mode with
  `externalE2E=not_run` and `supportClaim=false`;
- `git diff --check`: exit `0` (line-ending conversion warnings only, no
  whitespace error).

## Manual capability and ownership review

- Schema/version ownership remains in the persistence contract and migration
  registry; SQL writes/readback remain in the combined persistence owner.
- Project path identity is owned only by ProjectRegistry; authorization grants
  and policy are owned only by the authorization module; typed use-case
  selection and transaction orchestration are owned only by application;
  transition/parent/dependency/terminal behavior remains in Domain Core.
- The public package exports the implemented local Phase 1 registry,
  authorization, application, Domain, and persistence surfaces. Test-only
  transaction hooks are direct-module-only and absent from the package root.
- Documentation claims local persisted Project/Task management only. The
  `ato` console remains a truthful scaffold-status projection, not a product
  CLI.

## Not run, unimplemented, or unauthorized

- Online dependency audit: not run; separate network gate, no claim.
- Codex external E2E and real adapter integration: not run; blocked evidence,
  no support claim.
- Non-Windows platform support matrix and hosted CI: not run/unverified.
- EP-01D product CLI and backup/restore/doctor user surface: unimplemented.
- EP-02 execution attempt, Manual backend, running/completed closure, claim,
  lease/fence, completion, workspace, scheduler, dispatcher, gate, adapter,
  MCP/plugin, Git/Project mutation, and external intent/effect: unimplemented.
- Secret/account access, another repository, real external Project mutation,
  PR, release, deployment, force/rebase/reset/stash/clean, and coordinator
  cleanup: not performed and not claimed.
- Fresh repeat A2, terminal commit, artifact prune, exact-head Git-flow gates,
  FF-only integration, and ordinary push are pending and must be recorded only
  by their respective lifecycle/coordinator owners.

## Non-terminal implementation diagnostics

- A sandbox-restricted focused test invocation could not create fixture
  generations and reported only `EPERM`; the authorized worktree invocation
  immediately passed all `34` then-current tests.
- The first expanded focused run found one decoder false-positive for a denied
  non-expanding delegation whose administrative grant remains evidence. The
  semantic matrix was narrowed to that exact issue-denial shape; the single
  regression rerun passed, followed by the pre-A1 `72/72` focused result and
  `181/181` full gate. Those material-bound results were later superseded by
  A1 repairs; the current A2-attempt-two repair-focused run passed `84/84`.
- The first current-state complete gate passed every EP-01C test but observed
  one existing restore-boundary identity test fail to reject during the full
  concurrent run (`186/187`). The exact test immediately passed in isolation,
  and a complete offline rerun passed `187/187` plus every subsequent gate.
  Both the failed attempt and the accepted repeat are retained here; no
  persistence check or refusal rule was weakened.
