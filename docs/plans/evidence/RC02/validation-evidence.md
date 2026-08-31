# RC02 validation evidence

## Scope

RC02 converges backup manifest, restore intent, and restore receipt handling on
one exact current schema-version-2 JSON format for each artifact. It removes
the V1/V2 TypeScript unions, schema-selected readers, `pre_upgrade` backup kind,
`pre_upgrade_internal` provenance, and nullable-authorization writer while
preserving the current application-authorized manual generation bytes and the
implemented restore/recovery protocol. Schema-version-1 and pre-upgrade
artifacts remain invalid or ambiguous untouched evidence.

The material base is
`7b950488dd1fbc5cc6ee78e904d22dc067dfe00e`. The approval digest is
`4D22A5E0165E369C8D290635C83A2B3190D071B068110BBF4462A886BAB79597`.
Exact material-state, independent audit, final-gate, artifact-prune, staged
inventory, integration, and push receipts are finalized in the completed RC02
ExecPlan. This evidence does not perform RC03 API-major convergence, RC04
persistence decomposition, RC05 application/CLI decomposition, or any Phase 3
capability.

## Current-format and static closure

- `BackupManifest`, `RestoreIntent`, and `RestoreReceipt` each have one exact
  schema-version-2 field set. Current manifest bytes retain `kind=manual`,
  `provenanceKind=application`, the non-null lifecycle authorization ID and
  digest, and the source application-state digest.
- The sole production writer requires `runtime.backup` authorization before
  stage creation and revalidates it inside the writer barrier. Verification
  always checks that authorization against the cloned state.
- Restore intent and receipt parsing requires every current authorization and
  identity field. Continuation validates retained restore authority and
  published backup authority at pre-existing receipt, pre-receipt, and terminal
  receipt checkpoints without a version branch.
- Repository scans find no live `BackupManifestV1/V2`, `RestoreIntentV1/V2`,
  `RestoreReceiptV1/V2`, `pre_upgrade`, or `pre_upgrade_internal` production
  surface. Remaining old-format strings are negative fixtures, absence checks,
  or explicit incompatibility documentation.
- Public `ato.api/v1` and `ato.api/v2` grammar and projections remain outside
  the material diff; backup still projects `kind=manual`.

## Pre-review executable results

| Command | Binary acceptance | Result |
| --- | --- | --- |
| pinned TypeScript `tsc -p tsconfig.json --noEmit` | Exit 0 | Exit 0 |
| pinned Node `scripts/lint.mjs` | Exit 0 | Exit 0 before evidence publication; 194 files and 28 source files passed |
| pinned Node focused backup/restore/doctor route | Exit 0; all current bytes, retired-format refusals, recovery, and doctor cases pass | Exit 0; 29/29 tests passed; artifact baseline 0-to-0 and root reclaimed |
| `pnpm test:persistence` | Exit 0; complete persistence regression passes | Exit 0; 90/90 tests passed; artifact baseline 0-to-0 and root reclaimed |
| `pnpm build` | Exit 0 | Exit 0 |
| `pnpm package:smoke` | Exit 0; declarations contain only current types and source/build/installed CLI parity passes | Exit 0; pnpm 11.19.0, TypeScript 5.9.3, 112 packed files, consumer types/export/persistence/console/uninstall passed |
| pinned Node 24.19.0 `pnpm verify:offline` | Exit 0; every frozen local gate passes | Exit 0; lint 195 files/28 sources, typecheck/build, 414/414 tests with artifact baseline 0-to-0 and root reclaimed, docs 100/252/21/0, zero production dependencies, 112-file package smoke, SQLite 3.53.3 with schemaVersion 1 and zero surviving generation members, and Codex boundary passed with external E2E not run and no support claim |
| `git diff --check` | Exit 0 | Exit 0; only expected Windows working-tree line-ending notices were emitted |
| active schema-v3 ExecPlan trace | Exit 0; no scope or state finding | Exit 0 with `errors=[]`, `warnings=[]`, `outside_scope=[]`, `overlap=[]`, and `pre_existing_dirty=[]` |

## Negative and interruption evidence

- Current manifest, intent, and receipt tests assert the exact field inventory,
  schema marker, provenance literals, non-null digests, and canonical JSON
  bytes emitted by the production path.
- Manifest schema 1 and pre-upgrade provenance both fail `BACKUP_INVALID` before
  restore intent publication and preserve the generation and primary bytes.
- Intent and receipt schema 1, missing-field, extra-field, and noncanonical
  fixtures fail explicit recovery with `RESTORE_BLOCKED`; the restore inventory
  is byte- and timestamp-preserved and doctor reports it as ambiguous.
- Current caught-failure, real process termination, source/stage/inventory/
  sidecar/publication identity, acknowledgement, expected-primary CAS,
  connection receipt, after-intent, after-retain, after-publish, after-receipt,
  response-loss, and mixed/substituted topology cases all pass unchanged.

## Superseded diagnostic attempt

The first focused test invocation was run inside a filesystem sandbox that
refused creation of the registered worktree-local `.task-artifacts` directory
with `EPERM`. Three CLI-process cases that did not require that directory
passed, while the remaining 26 cases did not reach their assertions. The exact
same focused command was rerun in the authorized local test environment and
passed 29/29 with artifact baseline 0-to-0 and successful root reclamation. No
code or contract change was made in response to the sandbox-only failure.
