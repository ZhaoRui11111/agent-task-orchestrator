# RC01 validation evidence

## Scope

RC01 replaces the unreleased seven-file persistence migration prefix with one
fresh current schema-version-1 baseline. It removes pre-Phase-3 schema readers,
upgrade execution, authorization table partitions and lifecycle digest
fallbacks while preserving the implemented local explicit-Manual Phase 2
product behavior. This evidence does not claim compatibility with any earlier
runtime database or completion of RC02 through RC05.

The material base is
`c95de33b104282292a0cd9203e66e5a1112cb3bd`. The current approval digest is
`0ED11FFDAE5105792F8677E04E4F1D78497B8C9BFA57986570D5FCDE50C9A9DE`.
Exact material-state, audit, final-gate and staged-inventory receipts are stored
in the completed RC01 ExecPlan because those receipts are finalized after this
evidence file itself becomes part of the reviewed material.

## Baseline identity and static closure

- `migrations/0001-current-baseline.sql` is the only shipped migration. Its
  canonical LF SHA-256 is
  `EF756403D6D03EF73208326B0234991CBC4189372121474E6AD97C11BA70F6BD`.
- Repository-wide source, test and current-document scans found no live
  historical reader, versioned authorization table, grant-link table,
  lifecycle-digest fallback, adoption field or prefix-upgrade path. Remaining
  matches are negative absence assertions, explicit incompatibility statements
  or changelog history.
- `git diff --check` exited 0. Git emitted only the repository's expected
  Windows working-tree line-ending notices for non-migration files.
- The active schema-v3 ExecPlan trace exited 0 with `errors=[]`, `warnings=[]`,
  `outside_scope=[]`, `overlap=[]`, `pre_existing_dirty=[]`, and a current,
  complete A0 bound to the exact approval digest and material base above.

## Pre-review executable results

| Command | Binary acceptance | Result |
| --- | --- | --- |
| `pnpm test -- test/persistence-schema-migrations.test.mjs` | Exit 0; exact baseline, inventory, refusal and rollback cases all pass | Exit 0; 14/14 tests passed |
| `pnpm typecheck` | Exit 0 | Exit 0 |
| `pnpm test -- test/application-atomicity.test.mjs test/application-service.test.mjs test/cli-security.test.mjs` | Exit 0 | Exit 0; 107/107 tests passed |
| `pnpm test -- test/persistence-concurrency.test.mjs` after current-only test correction | Exit 0 | Exit 0; 14/14 tests passed |
| `pnpm test:persistence` after that correction | Exit 0 | Exit 0; 88/88 tests passed |
| `pnpm test -- test/scaffold.test.mjs` with the exact migration add/delete set staged | Exit 0 | Exit 0; 3/3 tests passed |

## Superseded diagnostic attempts

The first complete persistence run passed 87 of 88 tests and exposed one stale
test conversion: a former migration-upgrade receipt test had been pointed at a
current database, so its rejected-promise assertion leaked the successfully
opened second store and Windows then refused fixture quarantine with `EPERM`.
The test was corrected to the current invariant—an existing crash-stale
connection receipt blocks first initialization until its exact owner releases
it—and both the focused and complete persistence reruns passed.

The first complete `pnpm test` run passed 411 of 412 tests. Its sole failure was
the package inventory assertion because the deleted historical migrations had
not yet been staged, while that assertion intentionally reads the Git index.
After staging exactly the one baseline addition and seven old migration
deletions, the focused scaffold rerun passed 3/3. The exact staged final route
is recorded in the completed ExecPlan rather than inferred from this
precondition failure.

All test runs preserved their observed `.task-artifacts` baseline. Failed-run
diagnostics remain ignored and are not manually deleted; the coordinator-owned
pathless prune, exact-head gates, readiness, FF-only integration and ordinary
push occur only after the result commit under the local Git-flow contract.
