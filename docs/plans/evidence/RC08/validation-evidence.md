# RC08 validation evidence

Status: implementation-complete and complete-route-passed candidate awaiting
fresh independent stable-state A1.

Material base: 4777a7dd51256c45cc2478c11ef6835330785d2c

Current approval contract: 17,428 canonical bytes, SHA-256
12E72951F30CFBEEAFD71AE7967372A16170EF1A8E5AA35614C2882D3494639D

Recorded through: 2026-09-01 13:52:46+08:00

## Approval, scope and continuity

- RC07 resolves uniquely at pushed commit
  4777a7dd51256c45cc2478c11ef6835330785d2c. Master, origin/master and
  the RC08 task head matched that predecessor at start, and the serial
  RC07-to-RC08 chain check passed.
- Independent A0 attempt 1 reproduced the proposal identity and found one
  MEDIUM documentation-policy contract gap: completed plans and plan evidence
  remained classified as live. The parent reproduced 21 MEDIUM path findings
  and 7 unverified inline paths, all in immutable plan history.
- The approval contract was revised narrowly to classify only completed plans
  and plan evidence as historical evidence. Fresh independent A0 attempt 2
  reproduced 17,428 bytes and the current SHA-256, found no issue and returned
  ready_for_activation. Both the reopened first attempt and revision history
  remain in the active plan.
- The implementation inventory is confined to the twenty declared material
  paths plus the active/completed plan lifecycle path. Trace reports no
  outside-scope path, overlap or pre-existing dirty content.

## Implemented invariants

- Backup manifest, restore intent and restore receipt each have one exact
  current schema version 1. Restore intent binds
  backupManifestSchemaVersion 1. One persistence owner supplies the constants
  used by types, exact parsers and every writer.
- Existing artifact field inventories, canonical JSON bytes, authorization
  lineage, application-state binding, checksums, identities, lifecycle locks,
  restore topology, failpoints, recovery and doctor semantics are unchanged.
  Database schema version 1 and its migration bytes/checksum are unchanged.
- Version 2 and unknown versions are only unsupported inputs. Missing or extra
  fields, noncanonical bytes and substituted provenance or authorization
  remain invalid or ambiguous immutable evidence. No version union, legacy
  type, compatibility dispatch, conversion, repair or adoption path exists.
- ScaffoldStatus, STATUS and getScaffoldStatus are absent from live source,
  declarations, exact export inventories and consumers. The package root is
  only the explicit operational re-export facade; no replacement capability
  registry was added.
- The repository-local .doc-gardener.json has exactly four additive exclusions:
  .worktrees/**, node_modules/**, dist/** and .pnpm-store/**. Its sole role rule
  classifies exactly docs/plans/completed/**/*.md and
  docs/plans/evidence/**/*.md as historical evidence. Every unmatched document
  remains live-derived, and no public package script invokes the private skill.

## Successful implementation validation

| Command or route | Acceptance criterion | Actual result |
| --- | --- | --- |
| Offline frozen pnpm install using the retained RC07 content store | Exact lockfile, no lifecycle scripts and no network download | Passed with downloaded=0 and TypeScript 5.9.3 |
| Pinned pnpm typecheck and pnpm build | Strict TypeScript and emitted declarations compile | Both exited 0 before the final evidence-only documentation pass; the authoritative full route reruns both |
| Focused backup/restore group | Current exact formats and all unsupported/malformed refusal and recovery paths pass | 19/19; zero fail/cancel/skip/todo; artifact baseline 0-to-0 and root reclaimed |
| Focused doctor/export/configuration group | Read-only ambiguity, exact export removal and policy shape pass | 24/24; zero fail/cancel/skip/todo; artifact baseline 0-to-0 and root reclaimed |
| Focused scaffold rerun after wording cleanup | Operational source console/package boundary passes | 2/2; zero fail/cancel/skip/todo; artifact baseline 0-to-0 and root absent |
| pnpm lint | Repository lint exits 0 | Passed: 226 files and 43 production source files before this terminal evidence update |
| pnpm docs:check | Exact-case links/fragments and forbidden claims pass | Passed: 113 Markdown files, 254 local links, 22 local fragments, forbidden=0 |
| pnpm package:smoke | Packed declaration, isolated consumer, runtime export, console and uninstall boundaries pass | Passed with pnpm 11.19.0, TypeScript 5.9.3 and 172 packed files |
| pnpm test:persistence | Complete persistence family passes | 104/104; zero fail/cancel/skip/todo; artifact baseline 0-to-0 and root reclaimed |
| pnpm test | Complete Node test inventory passes | 432/432; zero fail/cancel/skip/todo; artifact baseline 0-to-0 and root reclaimed |
| Live symbol/version scans | No current schema-2 writer/reader or removed scaffold API survives | Passed; remaining version-2 literals are rejection fixtures/current refusal prose, the negative package regex is intentional, and older changelog bullets remain historical facts |
| git diff --check | No whitespace error | Passed; only expected LF-to-CRLF checkout notices were emitted |

The authoritative exact material-bound pnpm verify:offline result is recorded
in V6 of the active/completed plan after this evidence file is stable. That
route reruns lint, typecheck, build, all tests, documentation, dependency
policy, package smoke, Windows SQLite feasibility and the Codex contract from
the beginning. This evidence file intentionally contains no self-referential
material hash.

## Maintainer documentation audit

The repository policy SHA-256 is
28a29061e4504276850bc69e4ae5bd83cd88b2a09e0544178fa5684f56496d54.

- The targeted JSON run requested the changed current documents plus the
  source/configuration/test impact set. It scanned 12 documents: 10
  live-derived and 2 historical. Requested, policy-added, context, gated,
  scanned and excluded inventories were reported. Structure passed, static
  coverage was complete, and issues, review candidates and unverified were all
  empty.
- The full JSON run scanned and gated 113 documents. It reported the exact
  repository policy, excluded .pnpm-store, dist and node_modules because those
  directories were present, and classified 43 documents live-derived and 70
  historical. Structure passed, static coverage was complete, and issues,
  review candidates and unverified were all empty.
- The tool correctly leaves semantic_review pending. The parent manually
  compared the complete implementation/configuration/test diff with
  ARCHITECTURE.md, README.md, docs/README.md, the compatibility row and the
  persistence, toolchain, validation and versioning contracts. Current artifact
  versions, refusal behavior, database-version independence, package-root
  ownership, policy boundary and unimplemented-capability disclaimers all
  agree. No stale live claim, owner conflict, broken navigation or capability
  overclaim remains, so semantic review is complete for this candidate.
- Isolated strict-policy fixtures rejected every invalid policy: unknown key,
  wrong ignore_globs_add type, duplicate key, overlapping README roles and an
  escaping ../escape/** path. Each exited 1 with its specific fail-closed
  diagnostic and did not touch the repository.
- The proposal-state default full scan without this policy reported 112
  documents, 21 MEDIUM path issues and 7 unverified inline paths. All were
  located in immutable completed-plan/evidence records. The narrow historical
  role rule removed only that false live classification; it did not ignore a
  Markdown file or weaken the independent pnpm docs:check gate.

## Host, caches and artifact hygiene

- Observed development host: Windows kernel 10.0.22631.0, x64; Node 24.19.0;
  pnpm 11.19.0. The full route separately records bundled SQLite 3.53.3.
- RC08 initially had no local package store. A direct recursive seed-copy
  attempt failed closed before creating its target because the retained RC07
  pnpm store contained a generated project-registration reparse link. No link
  was followed or deleted.
- The repository package-smoke policy itself excludes the pnpm projects
  registration tree, so only v11/files and v11/index.db were copied into the
  RC08-local .pnpm-store. Its verified terminal inventory is 133 regular files,
  zero reparse member and no projects directory.
- The offline install caused pnpm to add its own RC08 project-registration
  symlink inside the retained RC07 store. It is generated package-manager
  bookkeeping outside the task source and remains untouched; no cleanup or
  deletion is claimed.
- node_modules, dist and .pnpm-store remain untracked generated validation
  material. The registered .task-artifacts root is absent after every
  successful wrapper, with baseline and terminal inventory both zero. Root
  absence is not presented as the post-result-commit prune receipt; that
  separate coordinator transition remains pending.

## Classified non-success observations

- One combined focused invocation continued asynchronously after its initial
  wrapper output was no longer attached. Its owner-created transient artifact
  generations appeared and then were reclaimed normally. No deterministic
  test failure or retained diagnostic resulted. The same focused routes were
  rerun explicitly and passed with exact exit 0.
- The first broad RC07-store copy check refused the reparse member before
  target creation. The narrower repository-consistent regular-file seed copy
  then passed. No destructive retry, traversal or network fallback occurred.
- Get-CimInstance was denied by the host while collecting an OS display value.
  The read-only System.Environment and RuntimeInformation route returned
  kernel 10.0.22631.0 and X64. No product validation depended on the denied
  query.

## Pending terminal evidence

- Fresh independent stable-state A1 and parent disposition.
- Any fresh A2 required by a confirmed substantive A1 finding.
- Final trace/inventory, one result commit, current-head pathless artifact
  prune, fourteen exact-head gates, ready, FF-only integration and ordinary
  push.
