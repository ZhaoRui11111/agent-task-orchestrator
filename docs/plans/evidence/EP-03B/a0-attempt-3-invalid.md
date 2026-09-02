# EP-03B A0 attempt 3 — invalid, non-canonical

- Reviewer: `/root/ep03a_a0_5`
- Reviewed at: `2026-09-02 14:29:41+08:00`
- Approval SHA-256: `6FA2BF147FFAF10A78A2CD7F5B4911EAD9CBE86E058EED31DCC2B8FDC308395C`
- Approval bytes: `39447`
- Reviewed material base: `d0ed2d85c2908e36f8b97a450366ee85ab72368f`
- Pre-violation material state: `git-sha1:c36f15483b6f1d8c264576f00f10a15f2bc610e6`
- Report status: `failed`
- Readiness: `revision_required`; this attempt is invalid and cannot activate the plan
- Parent disposition: `failed`

## Read-only boundary violation

The independent reviewer accidentally invoked `pnpm exec node --version`. Because `node` was not available in that shell, pnpm attempted to query `https://registry.npmjs.org/pnpm` and bootstrapped the lockfile-pinned TypeScript `5.9.3` development dependency into the ignored task-worktree `node_modules` tree at `2026-09-02 14:25:33+08:00`. Pnpm reported `reused 1` and `downloaded 0`; the registry request failed. The shared store was `D:\agent-task-orchestrator\.pnpm-store\v11`, and there was no pre-attempt metadata snapshot from which to prove that store metadata did not change.

The reviewer immediately reported the violation and performed no cleanup, rollback, repair, Git/index/coordinator mutation, product test, or later external action. The parent independently observed:

- `node_modules/.pnpm/typescript@5.9.3`, `node_modules/.modules.yaml`, and related ignored install metadata exist in the EP-03B worktree;
- `package.json` and `pnpm-lock.yaml` have no Git diff and retain their pre-attempt timestamps;
- tracked/staged Git diffs remain empty apart from the already untracked task-owned proposal/evidence set;
- the ignored dependency bootstrap is not a successful A0 fact and is not concealed or treated as authorization.

No cleanup is authorized or performed. The task may use the ordinary local development dependency during later authorized implementation checks, but a different fresh reviewer must establish strict-read-only A0 readiness.

## Static findings retained for revision only

### F-A0-07 — HIGH — mandatory validation owners omitted

The proposal adds `src/workspace-git-adapter.ts`, changes the exact production inventory in `scripts/repo-utils.mjs`, and adds package-root factory/constants/types through `src/index.ts`. `scripts/lint.mjs` independently rejects a production-source count other than 45, while `test/domain-architecture.test.mjs` compares package-root keys to an exact runtime-export list. Both owners were outside task scope, so V10/V12 could not be satisfied without an out-of-scope edit or a deterministic gate failure.

Parent closure: add both files to task scope; constrain the source inventories to exactly 46 files and the package-root owner to only the approved adapter exports; repeat A0.

### F-A0-08 — MEDIUM — persistence contract would become stale

`docs/reference/persistence-contract.md` currently states that the workspace backend is test-only Fake and that no production Git/filesystem workspace adapter exists. EP-03B delivers an exported but unwired production adapter library. Leaving the persistence contract outside scope would make an authoritative current-capability statement false even though the SQLite schema, persisted receipt digest/closed projection, and durable writer/reader/coordinator ownership stay unchanged.

Parent closure: add the persistence contract to task scope and narrowly distinguish the new unwired adapter library from the unchanged persistence and no-product/no-CLI boundaries; repeat A0.

## Other static conclusions and unrun work

The invalid reviewer found no residual in F-A0-04, F-A0-05, or F-A0-06, and found no new SQLite schema, cleanup-effect, product/CLI wiring, external-repository, platform-support, or compatibility-reader expansion. These are non-canonical observations only.

No product test, lint, typecheck, build, package smoke, real adapter command, new Git fixture, CLI path, Git/ExecPlan/Git-flow mutation, cleanup, push, successful network operation, credential operation, release, or deployment ran during this attempt.
