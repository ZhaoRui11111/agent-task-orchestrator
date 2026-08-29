# adopt-task-artifact-policy validation evidence

This record contains sanitized, reproducible repository-development evidence.
It is not product-runtime persistence evidence and does not authorize cleanup or
an external action beyond the plan's narrow envelope.

## Base and coordinator facts

- EP-01A was ordinarily pushed before this task began; local `master` and
  `origin/master` both resolved to
  `71dc606d5e4c40de4f669d0732da653d81bc8f92`.
- The coordinator upgraded from state version `1` to `2` only after the EP-01A
  reservation cleared and `pending_operation` was null.
- `start` created `task/adopt-artifact-policy` from that exact base with nine
  frozen gates. Because the manifest was absent on that base, the task receipt
  truthfully records `artifact_policy=null` and
  `artifact_prune_receipt=null`.

## Candidate checks before independent A1

All commands ran from the coordinator-owned task worktree on Windows
`10.0.22631` x64 with Node.js `24.19.0`, pnpm `11.19.0`, TypeScript `5.9.3`,
and bundled SQLite `3.53.3`.

- The schema-v3 plan `check`, `preflight`, `scope`, and `trace` commands exited
  `0`; fresh independent A0 reviewed approval digest
  `66A1ADC5BBE42020C31A4BB238E5547B6C0DCE299A7241D2C2E175B1DA6B2343`
  and returned `ready_for_activation` with no finding.
- `node --test test/artifact-policy.test.mjs test/repo-utils.test.mjs
  test/sqlite-feasibility.test.mjs` exited `0`: 8 tests passed, 0 failed, 0
  skipped. The suite proved the exact manifest/ignore/tracked-overlap contract,
  creator receipt, internal-junction unlink without traversal, external and
  root junction refusal before target mutation, and the complete Windows
  SQLite matrix.
- `node scripts/lint.mjs` exited `0` with `files=88` and `sourceFiles=3`.
- `node scripts/docs-check.mjs` exited `0` with `markdownFiles=53`,
  `localLinks=231`, and `forbidden=0`.
- A frozen worktree-local dependency store was copied read-only from the prior
  repository task after a recursive inventory found 133 regular files and zero
  reparse entries. `pnpm install --offline --frozen-lockfile --ignore-scripts
  --store-dir=.pnpm-store --registry=https://registry.npmjs.org/` downloaded
  zero packages and installed exact TypeScript `5.9.3`.
- With pnpm/npm offline mode and automatic repair disabled,
  `pnpm verify:offline` exited `0`. Lint, strict typecheck, build, all 41 Node
  tests, documentation, dependency shape, package smoke, Windows SQLite, and
  the fail-closed Codex boundary passed. Package smoke reported 15 files with
  export/console/uninstall passed. SQLite reported foreign keys, WAL reader,
  bounded writer, one claim winner, backup/publication/CAS/readback,
  reparse/corruption/ambiguity refusals, and
  `survivingGenerationMembers=0`. Codex remained
  `externalE2E=not_run` and `supportClaim=false`.
- `git diff --check` exited `0`. After targeted and full commands,
  `.task-artifacts` was absent. No online audit, secret, external project,
  cleanup, pull request, release, or deployment was used.

Independent A1, any required A2, staged-inventory review, terminal commit, and
exact-head coordinator receipts are intentionally pending at this point.

## A1 repair and adjacent validation

Fresh independent A1 bound material state
`git-sha1:9fbd62695f3b42c9852b7d7d2dcc1bd31414e174` and reported one confirmed
in-scope MEDIUM finding, `F-A1-001`: creator cleanup revalidated the receipt
before recursive path deletion but did not keep identity bound across that
destructive phase.

The repair now performs a same-root atomic quarantine rename, verifies the
quarantined generation's receipt-bound device/inode/real-path identity, and
revalidates the root, quarantine, and every captured member before a unique
same-parent rename-and-delete boundary. A safely identifiable quarantine is
restored on interruption; ambiguous replacement state is preserved rather than
deleted.

Post-repair evidence on the same Windows/Node environment:

- The targeted artifact/repository-utils/SQLite suite exited `0` with 11
  passed, 0 failed, and 0 skipped.
- Deterministic failpoints swapped the generation after inventory, swapped the
  quarantined generation, and swapped a member immediately before removal. All
  three operations failed closed; owned bytes and replacement bytes remained
  distinguishable and byte-identical for inspection and recovery.
- Ten additional repository-utils stress iterations exited `0`, and
  `.task-artifacts` was absent after every completed run.
- The complete offline gate exited `0` with lint `89/3`, strict typecheck and
  build, Node `44/44`, docs `54/231/0`, dependency shape, 15-file package
  smoke, the full Windows SQLite matrix with zero surviving generation
  members, and the Codex blocked/no-support boundary.

Fresh independent A2 remains required before final inventory and terminal
persistence.
