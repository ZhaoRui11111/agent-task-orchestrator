# EP-00B validation evidence

This is a sanitized, non-normative evidence log. Terminal binary results and
their exact material-state binding live in the schema-v3 EP-00B ExecPlan. This
file does not turn a feasibility observation into a support claim.

## Observed environment

The Windows observations on 2026-08-28 used:

- Windows kernel release `10.0.22631`, architecture `x64`;
- NTFS on the worktree volume, observed by the read-only
  `Get-Volume -DriveLetter D` procedure;
- Node.js `24.19.0`, TypeScript `5.9.3`, and bundled SQLite `3.53.3`;
- pnpm `11.19.0`; and
- Git `2.53.0.windows.1`.

The recorded filesystem value `0` in the SQLite JSON is the sanitized Node
filesystem probe value; the independent read-only `Get-Volume -DriveLetter D`
procedure established NTFS for the evidence record.

## Current candidate observations

These observations precede the terminal task commit and are not exact-head
coordinator receipts. The schema-v3 ExecPlan binds terminal binary results to
their material state.

- Exact TypeScript resolution used pnpm HTTPS only to
  `https://registry.npmjs.org/`, with install scripts disabled. The resulting
  lockfile names `typescript@5.9.3` and its registry integrity. A later isolated
  prefetch reported one downloaded package into the ignored worktree-local
  store, and package smoke reproduced an empty-project
  `--offline --frozen-lockfile --ignore-scripts` install from that cache.
- The post-A1 isolated offline frozen install reused the exact TypeScript cache
  with zero downloads, then `pnpm verify:offline` exited `0`. Lint reported 78
  inventoried regular no-follow files and two source files; typecheck and build
  exited `0`; all 18 tests passed with zero failures, skips, or todo items;
  documentation reported 49 Markdown files, 223 local links, and zero forbidden
  artifacts; and dependency policy reported zero production dependencies plus
  only `typescript@5.9.3` for development.
- The same offline gate packed exactly 11 declared files, installed the package
  into a disposable consumer without registry access, passed the library import
  and `ato` console checks, removed the package, and left no owned validation
  generation.
- `node scripts/sqlite-feasibility.mjs --json` passed foreign-key enforcement,
  WAL snapshot reader/writer behavior, bounded busy contention, bounded
  pre-readiness worker failure, exactly one of two atomic-claim winners, and a
  two-member no-follow private online backup normalized to standalone
  `journal_mode=DELETE`. Publication bound explicit absent-prior, candidate,
  manifest, database, observed pointer, and reopen identities. Incomplete,
  extra-member, reparse-backed, stale-CAS, losing-publication,
  self-consistent-corrupt, and raw-corrupt candidates were refused; fresh-process
  ambiguous recovery did not replay; no `.ep00b-tmp` generation survived. The
  earlier 20/20 stress loop predates the A1 repair and is historical only.
- `node scripts/codex-contract.mjs --json` exited `0` only for the truthfulness
  boundary: `evidenceMode=blocked`, `externalE2E=not_run`, and
  `supportClaim=false`. The checker is blocked-only and rejects every synthetic
  `validated`/support-producing record, changed capability criterion,
  credential-bearing source URL, raw path, and secret-shaped value. This is not
  a Codex compatibility pass.
- `pnpm audit --prod --audit-level high
  --registry=https://registry.npmjs.org/` exited `0` and reported `No known
  vulnerabilities found`. The package has zero production dependencies.

## Retained non-passing history and local artifacts

- Fresh independent A1 found six MEDIUM gaps in command/config self-checks,
  forbidden/no-follow inventory, temp-root containment, SQLite stage/CAS and
  worker readiness, and the Codex synthetic-positive branch. All six were
  confirmed in scope, repaired in task-owned paths, and classified
  `a2_required`; the targeted repair suite passed 15/15 before the first full
  post-repair gate.

- Before registry authorization, `pnpm install --offline` exited `1` with
  `ERR_PNPM_NO_OFFLINE_META`; no dependent check was counted as passed.
- The first authorized install did not honor the untracked linked-worktree
  `.npmrc` as assumed. It wrote pnpm store data to `D:\.pnpm-store`; the prior
  offline attempt had created `D:\agent-task-orchestrator\.pnpm-store`. That
  invocation is invalid evidence. Work stopped, and neither external ignored
  store was deleted, adopted, staged, or used by the later isolated package
  proof.
- An attempt to relink the already contaminated root `node_modules` to the
  worktree-local store failed closed with Windows `EPERM` during unlink/rename.
  No force or destructive cleanup was used. The isolated frozen install remains
  the clean reproducible proof; the partial root `node_modules` and both
  external stores remain ignored local artifacts and are excluded from the
  committed inventory.
- A direct post-A1 local-equivalent retry again reached lint and then failed at
  `tsc` because that retained partial `node_modules` has no compiler link; it was
  not counted as a pass. The creator-owned isolated frozen install supplied the
  compiler for the successful full route and was removed no-follow afterward.
- After separate user authorization, the integration-root store was inspected
  without recursion. Only the exact project-registration junction pointing to
  the EP-00B worktree was removed; the worktree target and all other store data
  were preserved. The coordinator then reserved the unchanged exact local and
  remote-tracking integration head. The two external stores remain ignored and
  uncommitted.

Official OpenAI documentation lookup, Codex login/account use, and real Codex
product execution remain unauthorized and not run. Hosted CI is also
unobserved. Therefore all affected compatibility rows remain `unverified`, and
the repository makes no Windows product, Codex, CI, or release support claim.
