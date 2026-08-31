# RC03 validation evidence

Status: implementation-complete and full-validation-passed candidate awaiting independent A1.

Material base: `96ef7860938a9a9c6003d55ed65ec841dbe26a76`

Approval contract: 18,662 canonical bytes, SHA-256 `3ED3DAC7DDCD9342EF5E9172DC7AD52EC6B1A562176B36B50E2C47059B417EFC`

Recorded through: `2026-09-01 01:05:01+08:00`

## Approval and scope

- `exec_plan.py check`, `preflight`, `trace`, and the RC02-to-RC03 `chain-check` returned `ok=true`, `errors=[]`, `warnings=[]`, and no path outside the approved scope.
- Fresh independent A0 reproduced the approval digest, used exactly one trace, found no issue, and returned `ready_for_activation`; parent disposition is complete.
- The candidate changes 25 implementation/contract/test files plus the active plan and this evidence file. All are declared task paths. `.task-artifacts` is absent; retained ignored `.pnpm-store`, `node_modules`, and `dist` are not staged or cleaned.

## Implemented invariants

- One production command registry contains exactly 24 base/lifecycle plus 9 product-facade IDs, for 33 unique current `ato.api/v1` commands.
- One production public error table contains exactly 30 prior base plus 7 execution/dispatcher entries, for 37 codes and one `PublicErrorCode` type.
- Omitted and explicit `ato.api/v1` parsing are identical. Retired `ato.api/v2` and other unsupported majors for recognized commands return the sole current-v1 unsupported-version envelope before trusted runtime selection, doctor, runtime creation/loading, persistence, authorization, or Domain evaluation.
- The current parser accepts the finite 30-action vocabulary; bootstrap remains 19 actions and sequential upgrades remain 23, 29, and 30. Product commands route through the trusted product facade.
- The package exposes only `localProductCliImplemented: true` for the product CLI. Retired API constants/tables/types and the two phase-specific status fields are absent from source and generated declarations.
- `ato.execution/v1` remains independently named and has no product-major coupling.

## Successful validation

| Command or route | Acceptance criterion | Actual result |
| --- | --- | --- |
| Pinned Node test: `test/cli-contract.test.mjs test/domain-architecture.test.mjs test/scaffold.test.mjs` | Focused grammar/table/export/status checks pass | 16/16 passed before the additional independent-port static assertion; the later complete route includes that assertion |
| `pnpm run typecheck` | TypeScript exits 0 | Passed with TypeScript 5.9.3 |
| Pinned Node test: `test/cli-phase2-e2e.test.mjs test/cli-e2e.test.mjs test/cli-security.test.mjs` | Current-v1 Manual/product, Phase 1, restart and security paths pass | 11/11 passed |
| `pnpm run lint` | Repository lint exits 0 | Initial pass: 196 files; final full route: 197 files; 28 source files |
| `pnpm run docs:check` | Exact-case links/fragments and forbidden claims pass | Initial pass: 101 Markdown files; final full route: 102 Markdown files, 252 local links, 22 local fragments, forbidden=0 |
| `pnpm run build` | Declaration/JavaScript build exits 0 | Passed |
| `pnpm run package:smoke` | Frozen offline consumer, declarations, export, persistence and source/build/installed CLI parity pass | Passed: pnpm 11.19.0, TypeScript 5.9.3, 112 packed files, consumer types/export/persistence/console/uninstall all passed |
| `pnpm run test` | Complete repository suite has no failure/skip and successful artifact baseline is unchanged | Passed: 414/414, zero fail/cancel/skip/todo; `.task-artifacts` baseline 0-to-0 and fixed root reclaimed |
| `pnpm run verify:offline` with pinned Node 24.19.0 | Every local non-network gate passes at one material state | Passed: lint 197/28; typecheck/build; tests 414/414; docs 102/252/22/0; production dependencies 0; package smoke 112 files; SQLite 3.53.3 matrix with zero surviving generation members; Codex boundary `passed`, evidence `blocked`, external E2E `not_run`, support claim false |
| `git diff --check` | No whitespace error | Passed |

## Classified unsuccessful attempts

- The first sandboxed `pnpm run typecheck` could not create pnpm's worktree-local temporary state (`EPERM`) before TypeScript ran. The authorized local offline rerun passed without a material change; classification: environment failure.
- The first package-smoke attempt stopped before assertions because the new worktree had no `.pnpm-store`. The second stopped because the integration-root seed lacked the TypeScript 5.9.3 offline content. The existing RC02 validated offline store was merged without network or deletion; classification: environment/precondition failures.
- The first package-smoke attempt after the store was complete reached the new declaration check and found that the test expected a source-style equals sign while TypeScript emits `CLI_API_VERSION: "ato.api/v1"` in `.d.ts`. The one-token mechanical assertion repair was made; the rerun passed. No production behavior or contract changed, so no A2 is required for this repair.
- The first complete `verify:offline` attempt stopped at lint before any later gate because this evidence file used two Markdown hard-break trailing spaces. Removing those two spaces was a mechanical evidence-format repair; the full route was rerun from the beginning and passed.

## Pending terminal evidence

- Fresh independent stable-diff A1 and parent disposition.
- Any A2 required by a confirmed substantive A1 finding.
- Final trace/inventory, one result commit, current-head artifact prune, twelve exact-head gates, ready, FF-only integration, and ordinary push.
