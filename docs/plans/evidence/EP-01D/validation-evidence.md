# EP-01D validation evidence

Status: post-A1 repair implementation, focused persistence, complete Node-test,
distribution, and complete offline repository routes passed on 2026-08-30. The
exact-state repeat and independent A2 closure are recorded by the active
ExecPlan; no terminal Git-flow result is claimed here.

## Environment and dependency boundary

- Windows development host, `win32 x64`; Node `24.19.0`; bundled SQLite
  `3.53.3`; pnpm `11.19.0`; Git `2.53.0.windows.1`; TypeScript `5.9.3`.
- The package has zero production dependencies. Validation used only the frozen
  local dependency and did not perform a registry or other network operation.
- `pnpm dependency:audit` was not run because it is a distinct online gate and
  network access was not authorized. Hosted CI was not observed.

## Product predecessor and plan activation

- `exec_plan.py terminal-resolve` returned the sole completed EP-01C terminal
  `511f444f44d5404459875452f42b0055cc94785c`, with no rejection.
- Historical `scope --at` at that commit returned `ok=true`,
  `completion_ready=true`, and no outside-scope, overlap, dirty, error, or
  warning result.
- `chain-check` bound the active EP-01D material base to that exact terminal and
  returned `ok=true` with no error or warning.
- Fresh independent A0 attempt 12 reproduced the 77,195-byte approval contract,
  digest
  `FE62B860D545ED19C859679C3060F11FF00AC6DF25A8A39F3B32D2B2214BC725`,
  and exact predecessor, reported no finding, and was parent-accepted before the
  plan moved from proposal to active. Earlier A0 findings and reopened attempts
  remain preserved in the active plan.

## Implemented local Phase 1 capability

- `ato` is now the strict local product CLI for one-time initialization,
  capability adoption/renewal and finite grant administration,
  Project/Task/dependency management and exact queries, status, authorized
  backup, separately confirmed restore, and grant-independent read-only doctor.
- The CLI owns only bounded parsing, trusted local actor/confirmation setup,
  versioned human/JSON presentation, redaction, and stable public errors/exits.
  Project, Task, dependency, policy, authorization, registry, and persistence
  decisions continue through their pre-existing typed owners.
- There is no Task `running` or `completed` command and no execution attempt,
  backend, claim, completion, dispatcher, scheduler, port, adapter, workspace,
  gate, external intent/effect, MCP, plugin, Git/Project mutation, network,
  secret, release, deployment, repair, cleanup, or arbitrary shell/SQL/filesystem
  surface.

## Independent A1 and repair evidence

Fresh independent A1 bound the exact pre-review material state and reported five
in-scope findings: an environment-redirectable default user-data root, incomplete
semantic decoding before schema-v3 migration, a pre-authorization restore backup
oracle, non-exact lifecycle readback, and post-transaction CLI re-interpretation
of Project state. The implementation and contracts now close each seam:

- local product ingress derives its root from the OS account record and ignores
  `HOME`, `USERPROFILE`, and `LOCALAPPDATA`; a child-process negative test proves
  redirected environment content cannot select or create trusted state;
- the released schema-v3 physical shape is fully decoded through the shared
  application/Domain invariant owner before any writable open, backup, or
  migration, and doctor uses that same decoder;
- restore authorizes and obtains its exact application lifecycle handoff before
  inspecting the requested backup inventory or generation, so absent and corrupt
  generations are indistinguishable to revoked, expired, or pre-adoption callers;
- the application returns the lifecycle row by its exact newly inserted ID and
  returns a safe Project DTO captured inside the terminal transaction; and
- the CLI serializes those application results directly without a second
  registry/Domain read or business interpretation.

Focused regressions for all five repairs passed before the complete routes below.
The active ExecPlan preserves the original A1 report and owns final A2 closure.

## Schema, authorization, and persistence evidence

- `git diff --exit-code 511f444... --` for migrations `0001`, `0002`, and
  `0003` exited `0`. Their SHA-256 values remain, respectively,
  `E31C5A3D24E4DB99620635A9CE83F752978C5FD2AF7A15C84CE13BEECAC9C34F`,
  `0FC2DEECBC8ABBA31F9E5063A870706320F66C5AEE882E4A05DA0CADCF9CEC7E`,
  and
  `58D428B10198B7483ECB6CED2F88D8DA81A97B052CF650ED4CD0012D7183F0702`.
  Appended `0004` is
  `3446455B4A49C2339EC22E6B99FFF5DD43908D0BEB45EFCE099A79D732CFF6557`.
- Fresh schema 0 and each shipped 1/2/3 prefix migrate to schema 4 only after the
  released prefix is fully decoded, with verified pre-upgrade backup where
  applicable. Failed migration, semantic schema-v3 corruption,
  checksum/history/live
  fingerprint drift, newer schema, explicit mandatory-column NULL, and
  same-count semantic rewrite cases fail atomically. No Phase 2 object is
  allocated.
- Schema-v4 tests bind the OS-derived local identity, exact nineteen-action set,
  non-grantable adoption/renewal epochs, immutable grant provenance, bounded
  listing, high-risk confirmation, request/decision/audit cardinality, and every
  staged rollback. Migrated schema-v3 authority remains unchanged until one
  confirmed adoption; content cannot become actor, grant, confirmation, epoch,
  or lifecycle authority.
- Manual backup requires the sole initiating connection receipt and a current
  application lifecycle handoff, repeats the authorization/state-digest check
  at the writer barrier, and publishes one immutable schema-2 generation.
  Real process-kill tests preserve the exact lock, initiating receipt, stage or
  generation, identity, timestamps, and inventory for every approved route.
- Restore first requires a current application-authorized `runtime.restore`
  handoff, then accepts only the named schema-2 manual backup, exact primary CAS,
  and data-loss
  acknowledgement. Substituting any of all sixteen handoff fields, stale or
  active state, legacy/pre-upgrade/wrong-application/corrupt backup, and every
  pre-intent mismatch produces no partial restore; post-intent failure remains
  recovery-required with retained evidence.
- Doctor classifies absent/partial/unsafe, every shipped schema, Domain-only and
  pre-adoption upgrade state, active lock/receipt, backup stage/generation,
  restore pending/ambiguous, migration drift, newer schema, and corrupt state.
  Schema-v3 semantic corruption is `state_corrupt`, never upgradeable.
  Byte/hash/time/inventory tests prove it performs no creation, repair,
  migration, deletion, or writable open.

## CLI, application, and security evidence

- Strict parser tests exhaust the 24 command paths, duplicate-free option sets,
  bounds, canonical time/revision/UUID forms, confirmation phrases, list limits,
  unknown version/field/command, aliases, positional/equals/response-file forms,
  control/format characters, normalization, overflow, and injection content.
  Parser failures do not select, create, or open runtime state.
- Application-parity tests cover registration and legacy Domain-Project binding,
  Task create/body/parent/ready/cancel, dependency add/remove, Project/Task/grant
  reads, status, grant issue/revoke/list/evaluate, stale revisions, disabled
  policy, illegal transition, cycle, cross-Project parent, duplicate/self edge,
  terminal mutation, and atomic accepted/denied audit behavior.
- Security tests prove wrong/changed local identity, expired/revoked grant,
  stale scope/revision, missing confirmations, content self-authorization, and
  attempted restore after revoked, expired, or pre-adoption authority cannot
  mutate state or distinguish missing from corrupt backup generations.
- Human and `ato.api/v1` results omit Task body, cancellation reason, full
  Project/runtime path, actor/principal, internal operation IDs/digests, raw
  errors, stacks, environment values, and secrets. Failures expose only fixed
  public codes/messages and stable exits.
- Separate-process E2E completed init -> Project -> Task update/ready ->
  dependency add/remove -> status/query -> backup -> post-backup mutation ->
  confirmed restore -> restart readback, proving the disclosed data rollback.

## Validation commands observed so far

- `pnpm typecheck`: exit `0`.
- `pnpm lint`: exit `0`; `140` repository files and `20` production source
  files accepted.
- `pnpm build`: exit `0`.
- `pnpm test`: exit `0`; `268` tests, `268` pass, `0` fail/skip/todo; artifact
  hygiene passed with baseline `247` and terminal `247`.
- `pnpm test:persistence`: exit `0`; `90` tests, `90` pass,
  `0` fail/skip/todo; artifact baseline and terminal both `247`.
- `pnpm package:smoke`: exit `0`; frozen local consumer installation,
  declarations, package export, persistence, source/build/packed-installed
  JSON/human/error/exit parity, uninstall, and exact `83`-file package inventory
  passed.

## Complete offline repository gate

Command: `pnpm verify:offline`.

Binary result: exit `0`.

- lint accepted `140` repository files and `20` production source files;
- strict TypeScript typecheck and build passed;
- Node tests passed `268/268` with `0` fail/skip/todo and artifact hygiene
  baseline/terminal `247/247`;
- docs accepted `67` Markdown files, `240` exact-case local links, and `0`
  forbidden references;
- dependency shape passed with `0` production dependencies and only
  `typescript@5.9.3` as a development dependency;
- package smoke passed the exact `83`-file inventory, frozen local consumer,
  declarations/export/persistence, source-build-installed console parity, and
  uninstall;
- SQLite feasibility passed on Windows `10.0.22631`, Node `24.19.0`, SQLite
  `3.53.3`, including FK/WAL/read snapshot, bounded busy, atomic-claim
  feasibility, private online backup, publication CAS/readback, interruption and
  corruption refusal, and `0` surviving generation members; and
- the Codex boundary passed only in blocked evidence mode with
  `externalE2E=not_run` and `supportClaim=false`.

## Manual ownership and capability review

- The CLI/API contract solely owns command grammar, result schemas, redaction,
  fixed public errors, and exits. Authorization owns identity, action vocabulary,
  grants, epochs, policy, confirmation, and lifecycle handoff; persistence owns
  schema, SQLite, paths, backup/restore, active-use refusal, and doctor; Domain
  and ProjectRegistry retain their original business/path judgments.
- README, package metadata/status, architecture, changelog, documentation index,
  compatibility matrix, toolchain, security, versioning, validation,
  authorization, and persistence contracts describe the implemented local Phase
  1 surface without a release or platform-support claim.

## Not run, unimplemented, or unauthorized

- Online dependency audit, hosted CI, real external E2E, and non-Windows support
  matrix: not run or unverified; no dependent claim.
- Secret/account access, another repository (including `D:/quant`), PR, release,
  deployment, force/rebase/reset/stash/clean, coordinator cleanup, and any
  arbitrary network or external write: unauthorized and not performed.
- EP-02, execution backend/attempt/running/completed loop, claim/lease/fence,
  dispatcher, scheduler, ports/adapters, workspace/completion/gates, MCP/plugin,
  Git/Project mutation, external intent/effect, telemetry, automatic repair, and
  automatic or ambiguous restore recovery: unimplemented and not claimed.
- Terminal task commit, registered artifact prune, exact-head Git-flow gates,
  readiness, FF-only local integration, and standing-authorized ordinary push
  remain coordinator lifecycle facts and are not claimed by tracked evidence.

## Preserved local diagnostic material

An unsuccessful local dependency-store copy experiment left an ignored
repository-local `.pnpm-store` directory. It contains no tracked product/runtime
data and was not used as authority. Deletion was not authorized, so it is
preserved and excluded from every completion or cleanup claim. Registered
`.task-artifacts` remains owned exclusively by the coordinator's later pathless
prune transition; it was not manually deleted.
