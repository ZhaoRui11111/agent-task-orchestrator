# EP-01B validation evidence

## Status

This is the candidate evidence log for EP-01B. It is non-normative and remains
in progress until the completed ExecPlan binds every result to the stable
material state and the coordinator records the separate exact-head receipts.
No entry here creates authorization, a release, or a platform-support claim.

## Scope and environment

- Product predecessor: EP-01A terminal commit
  `71dc606d5e4c40de4f669d0732da653d81bc8f92`.
- Reviewed base: `2df03a4f6a2106555740944596924561e2753e89`;
  the two intervening commits affect repository task-artifact governance, not
  the product contracts or source.
- Task branch/worktree: coordinator-owned `task/ep-01b` linked worktree.
- Observed development host: Windows kernel `10.0.22631`, `x64`, NTFS;
  Node.js `24.19.0`; bundled SQLite `3.53.3`; pnpm `11.19.0`.
- Compiler gate: TypeScript `5.9.3`, exact lockfile selection, available from a
  previously verified same-repository offline store with zero download.

## Plan audit

The active schema-v3 ExecPlan received fresh independent A0 attempt 6 with a
`ready` verdict and no findings after A1 proved that the already-required
offline route also needed the exact task scope to include
`scripts/codex-contract.mjs`. The current approval digest is
`048C8F1B56866DA0D05FE0DA37A62A00407C157C18BC4216AFC7ECD17D455622`.

Fresh independent A1 reviewed material state
`git-sha1:f08ce94ce316f5210e1acd0f29f980265a7bd901` and reported one HIGH,
four MEDIUM, and one LOW finding. The parent confirmed all six in scope and
routed every repair to fresh A2. A2 attempt 1 at
`git-sha1:7613a664cc7b07c1894df83242ee55d05077dc6c` independently closed five
findings but found two direct `F-A1-01` residuals: present WAL/SHM preflight
and backup pre-rename inventory binding, plus current-primary CAS after the
restore staging await. The parent confirmed both in scope. The repaired
candidate now preflights and rebinds the complete present SQLite file set,
repeats exact backup stage checks immediately before rename, and checks
restore CAS after staging and at intent publication. A fresh repeat A2 remains
required after the terminal material evidence is stable.

## Candidate validation observations

The following checks have run successfully against the evolving candidate and
must be rerun after the final material change before they become completion
evidence:

| Route | Command | Current observation |
| --- | --- | --- |
| Persistence targeted suite | network-disabled `pnpm test:persistence` with exact Node `24.19.0` | exit `0`; 55 passed, 0 failed/skipped/todo after the A2 residual repairs |
| Complete Node suite | network-disabled `pnpm test` with exact Node `24.19.0` | earlier candidate exit `0`; 99 passed before the additional sidecar regression; final rerun pending |
| Repository lint | exact Node `24.19.0` executable with `scripts/lint.mjs` | exit `0`; 111 files and the exact 13-file production source boundary passed |
| Documentation links | exact Node `24.19.0` executable with `scripts/docs-check.mjs` | exit `0`; 57 Markdown files, 225 local links, 0 forbidden artifacts |
| Dependency shape | exact Node `24.19.0` executable with `scripts/dependency-security.mjs` | exit `0`; zero production dependencies and only `typescript@5.9.3` in development |
| Exact compiler | `node node_modules/typescript/bin/tsc --version` | `Version 5.9.3` |
| Strict typecheck/build | network-disabled `pnpm typecheck` and `pnpm build` | both exit `0` with no diagnostic under the exact compiler |
| Package smoke | network-disabled `pnpm package:smoke` | exit `0`; exact frozen TypeScript install, 53 packed files, consumer declarations, export, persistence, console, and uninstall all passed |
| Complete offline route | network-disabled `pnpm verify:offline` | exit `0`; lint, exact typecheck/build, 99 tests, docs, dependency shape, package smoke, Windows SQLite feasibility, and truthful Codex blocked-boundary route all passed |

The targeted persistence suite currently demonstrates:

- exact committed migration files/checksums, fresh `0` to `2`, shipped prefix
  `1` to `2` with a verified pre-upgrade backup, atomic failed migration
  rollback/restart, unowned-schema refusal, history/checksum/schema-fingerprint
  mismatch, and newer-schema refusal;
- exact Domain Core Project/Task/dependency round-trip, one-time empty
  initialization, complete-snapshot/revision CAS, wrong storage class, unknown
  enum, conditional-shape, graph-corruption, and FK rollback behavior;
- verified FK/WAL/FULL/busy/read-isolation settings, five-second writer
  contention, synchronous-transaction enforcement, stable reader snapshots,
  checkpoint refusal and ingress, failed read-only handle closure, lifecycle
  lock identity/content, and connection-receipt identity/content/corruption
  plus create/release parent-directory revalidation;
- Windows default and environment-root selection, relative/root/UNC/traversal,
  protected overlap, non-directory, symlink/junction/reparse, issued-directory
  swap, inventory, and noncanonical-ingress negatives; and
- online backup stage/source identity and exclusive-publication checks,
  immediate pre-rename exact inventory/object/content checks,
  hash-to-terminal-SQLite object binding, verification/readback, restore
  acknowledgement, raw main/WAL/SHM file-set CAS, active-receipt refusal,
  exact retained-directory identity/old bytes, pending-intent open refusal,
  immediate post-intent recovery classification, post-staging and
  intent-boundary current-primary CAS, real stage/retained swap refusal,
  post-retain/post-publish/post-receipt recovery, corrupt intent,
  incomplete post-receipt retention, substituted topology,
  canonical-manifest, newer-backup refusal, and unsafe present-sidecar refusal
  before SQLite issues a connection.

## Offline compiler provenance and remaining lifecycle condition

The task initially lacked `node_modules`; its first task-local offline install
failed closed with `ERR_PNPM_NO_OFFLINE_TARBALL`, and attempted authorization
thread creation returned no thread ID or permission. No network request or
download was authorized or performed.

A later repository-wide read-only search found the exact installed
`typescript@5.9.3` and pnpm v11 store in the completed
`verify-artifact-policy` worktree of this same repository. A frozen offline
install using that verified store reported `reused=1`, `downloaded=0`, and the
installed compiler reports version `5.9.3`. Package smoke independently copied
the task-local regular-file store seed into its disposable generation and
completed its own frozen offline install. The earlier VS Code 5.6 diagnostic
is superseded and is not used as gate evidence.

Two ignored `.task-artifacts` generations created by earlier failed-test
cleanup still predate the repaired runs. Every repaired run created and
removed its own generations, but V10/V13 cannot claim the terminal
no-survivor criterion until a clean nonterminal candidate commit lets the
coordinator's sole `prune-artifacts` owner remove those exact residues. The
task remains reserved and no manual deletion is used. Hosted CI, online
dependency audit, release, product CLI, application service, adapter, external
E2E, and supported-platform claims remain not run or unimplemented.

## Final exact-head records

Final material identity, full command results, independent A1/A2 dispositions,
candidate inventory, staged inventory, plan completion trace, task commit,
artifact-prune receipt, coordinator gate receipts, FF-only integration, and
ordinary push status are appended only after those events actually occur.
