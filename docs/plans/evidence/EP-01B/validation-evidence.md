# EP-01B validation evidence

## Status

This is the final tracked candidate evidence log for EP-01B. It is
non-normative: the ExecPlan owns material-state validation and audit bindings,
while coordinator state owns the later exact-head receipts. No entry here
creates authorization, a release, or a platform-support claim.

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
restore staging await. The parent confirmed both in scope. A2 attempt 2 at
`git-sha1:ac9764468ccc0b974696631d282f45c4bb510357` closed the restore and
backup-publication residuals, but retained `F-A2-01` because `existsSync`
followed links when deciding that a database member was absent and a newly
appearing sidecar was validated without entering the retained identity map.
The parent again confirmed the finding in scope. A2 attempt 3 at
`git-sha1:4f8111982fdc198ad04d8f58682d5445ce3fdc7b` verified those repairs
but found the same HIGH family still reached one direct filesystem SQLite
open during standalone backup normalization. The parent confirmed that
residual in scope. The repaired candidate now routes that open through the
same complete no-follow main/WAL/SHM binding owner, requires terminal DELETE
mode with no sidecar, and covers the post-clone seam with a dangling internal
junction whose target bytes must remain unchanged. Fresh independent A2
attempt 4 at `git-sha1:c761ba4429cc0f7ba7c1a9ab8d126ddd4c85e4bd`
closed `F-A1-01` through `F-A1-06`, closed both A2 residuals, reported no new
finding, and was closure-safe. Because the later authorized artifact receipt
had to be recorded in this material evidence file, the plan's current A2
record is the sole closure owner for the resulting final stable state.

## Candidate validation observations

The following checks ran successfully at the final material state and are
bound by the plan's validation records:

| Route | Command | Current observation |
| --- | --- | --- |
| Persistence targeted suite | network-disabled `pnpm test:persistence` with exact Node `24.19.0` | exit `0`; 56 passed, 0 failed/skipped/todo after the repeated-A2 residual repairs |
| Complete Node suite | network-disabled `pnpm test` with exact Node `24.19.0` | exit `0`; 101 passed, 0 failed/skipped/todo after the no-follow and retained-sidecar regressions |
| Repository lint | exact Node `24.19.0` executable with `scripts/lint.mjs` | exit `0`; 111 files and the exact 13-file production source boundary passed |
| Documentation links | exact Node `24.19.0` executable with `scripts/docs-check.mjs` | exit `0`; 57 Markdown files, 225 local links, 0 forbidden artifacts |
| Dependency shape | exact Node `24.19.0` executable with `scripts/dependency-security.mjs` | exit `0`; zero production dependencies and only `typescript@5.9.3` in development |
| Exact compiler | `node node_modules/typescript/bin/tsc --version` | `Version 5.9.3` |
| Strict typecheck/build | network-disabled `pnpm typecheck` and `pnpm build` | both exit `0` with no diagnostic under the exact compiler |
| Package smoke | network-disabled `pnpm package:smoke` | exit `0`; exact frozen TypeScript install, 53 packed files, consumer declarations, export, persistence, console, and uninstall all passed |
| Complete offline route | network-disabled `pnpm verify:offline` | exit `0`; lint, exact typecheck/build, 101 tests, docs, dependency shape, package smoke, Windows SQLite feasibility, and truthful Codex blocked-boundary route all passed |

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
  plus create/release parent-directory revalidation, no-follow refusal of a
  dangling internal junction, and retained identity for a newly appearing
  sidecar;
- Windows default and environment-root selection, relative/root/UNC/traversal,
  protected overlap, non-directory, symlink/junction/reparse, issued-directory
  swap, inventory, and noncanonical-ingress negatives; and
- online backup stage/source identity and exclusive-publication checks,
  post-clone no-follow refusal of an unsafe or dangling stage sidecar,
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

## Offline compiler provenance and artifact lifecycle

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

The first post-A2 full offline attempt reached all tests but failed because the
malformed-read-only fixture could rename its database file while Windows still
refused the parent generation rename with `EPERM`. The owner now revalidates
the complete binding after close, and the regression requires immediate
directory rename. A targeted rerun and a complete offline run after the final
no-follow/retained-sidecar and standalone-normalization repairs both passed;
the latter reported lint
`111/13`, exact typecheck/build, tests `101/101`, docs `57/225/0`, zero
production dependencies, package smoke with 53 files, the Windows SQLite
matrix with zero matrix survivors, and the truthful blocked Codex boundary.

Four ignored `.task-artifacts` generations had remained: the two earlier
pre-repair residues, the malformed-reader generation retained by the first
failed full route, and the dangling-sidecar generation retained by the first
version of that regression. Their exact names were
`concurrency-readonly-close-jm1YOr`,
`concurrency-receipt-swap-EH39QK`,
`concurrency-sidecar-dangling-xNcprx`, and
`repository-storage-class-VV2kTL`. All subsequent repaired runs removed their
own generations. The clean candidate head allowed the coordinator's sole
`prune-artifacts` route to be requested, but the permission reviewer rejected
the deletion because the user instruction separately prohibits destructive
cleanup. Nothing was deleted or moved and no workaround was attempted before
authorization.

The user later explicitly authorized deletion of those exact four root
children. Immediately before mutation the task worktree was clean and all
four children were ordinary directories with no link/reparse attribute. The
Git-flow `prune-artifacts` command accepted no caller path, revalidated the
frozen manifest and complete no-follow inventory, and at
`2026-08-29T09:10:47Z` recorded a receipt bound to task head
`f53e612aec890a201dd96850a968156fd70947e2`: 9 files, 50 directories, and
one internal reparse alias were removed without following the alias. The
`.task-artifacts` root was absent immediately afterward. A complete
network-disabled `pnpm verify:offline` then passed lint `111/13`, exact
typecheck/build, tests `101/101` with no skip/todo, docs `57/225/0`, zero
production dependencies, package smoke with 53 files, the real Windows SQLite
matrix with zero per-run survivors, and the truthful blocked Codex boundary;
the root remained absent after the run. A final-material rerun produced the
same successful observations, satisfying the local V10/V13 criteria; the
terminal-head prune receipt is a separate post-completion coordinator
consumer. Hosted CI, online dependency audit, release, product CLI,
application service, adapter, external E2E, and supported-platform claims
remain not run or unimplemented.

## Evidence ownership after candidate completion

This tracked file records the final material identity, local validation,
independent audit disposition, candidate inventory, plan completion trace, and
staged inventory before the terminal task commit. The terminal task commit,
terminal-head prune receipt, exact-head gate receipts, ready transition,
FF-only integration, and ordinary push are later consumers of that completed
candidate. Their post-state is recorded only by the coordinator state and the
final user report; it is not written back into tracked task material after the
head-bound receipts are issued.
