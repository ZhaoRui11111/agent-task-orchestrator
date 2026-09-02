# EP-03B validation evidence

Status: implementation and documentation are present in the coordinator-owned
`task/ep-03b` worktree. The parent detected an exact-path approval drift,
archived the former A0 as stale, and corrected the compact target/admin
topology. Fresh [A0 attempt 5](a0-attempt-5.md) then found a stale `run root`
statement and a missing 240-code-unit contract/test criterion; both findings
were accepted and closed. Fresh [A0 attempt 6](a0-attempt-6.md) independently
approved the revised contract with no findings. Independent A1 then reported
four confirmed in-scope findings; the production capability attestation,
directory-prefix case check, upstream-effect propagation, and single-link index
repairs plus their focused regressions are now present and primary validation is
green. [Fresh independent A2 attempt 1](a2-attempt-1-reopened.md) confirmed the
principal repairs but found one local residual: a successful directory mkdir
could lose its effect fact if the immediate identity read failed. The parent
confirmed and repaired that residual, and the new deterministic durable
regression is green. Fresh rerun of the same A2, the complete repository gate
set, terminal commit, coordinator artifact prune, exact-head receipts,
integration, and push are still pending. Nothing in this record is a release,
deployment, product-wiring, cleanup-safety, or platform-support claim.

## Bound predecessor and approval

- The task began from the exact pushed EP-03A predecessor
  `d0ed2d85c2908e36f8b97a450366ee85ab72368f`.
- The former schema-v3 A0 approval covered 41,136 bytes with SHA-256
  `A376A9026EC0B1264DBF34DC3BF256ACE8ECE744F3675AD79CEB48AD9F0FEC4D`.
  Its canonical record is [A0 attempt 4](a0-attempt-4.md). It is now preserved
  as stale because its exact physical topology differed from the compact
  implementation path. A0 attempt 5 is also historical after finding
  F-A0-09/F-A0-10. Attempt 6 approved the current 42,003-byte contract with
  SHA-256
  `42CE09525A869C8A91E8DD8DDF9025D254CE2240C497486D0F50158265F349E6`;
  no prior record was rewritten.
- EP-03C has not been started. The EP-03B task remains isolated in its linked
  worktree and no product repository, remote repository, credential, Codex,
  scheduler, MCP, release, or deployment target has been used.

## Implemented boundary

- `ato.workspace/v1` now requires an uppercase 64-hex
  `ownershipBindingSha256` in both subject and receipt. The application owner
  derives it from the immutable Project/Task/run/member/execution/fence/
  workspace-generation tuple and verifies the exact echo. This is the one
  authorized unreleased fresh-only v1 reset: the prior shape is rejected, with
  no reader, alias, migration, fallback, dual write, or deprecation window.
- The package exports the `windows-git-local` backend version `1.0.0` as a
  library-only implementation. No product facade or CLI constructs it.
- The backend accepts only injected trusted, pairwise-disjoint roots and the
  exact configured Git executable; rejects unsupported repository topology,
  object indirection, hostile tree entries, aliases/reparse points, foreign
  ownership, and identity drift; manually creates one locked detached linked
  worktree registration and materializes local blobs without invoking
  `git worktree add`, checkout, a shell, a remote, or credentials.
- Before either registration leaf is acquired, production runs an
  ownership-bound empty-directory rename positive control and nested
  current-directory rename-refusal probe under both `.git/worktrees` and the
  exact `ato-workspaces` parent. Only `EBUSY`/`EPERM`, same-device identity,
  exact restoration, and exact non-recursive removal pass. Probe/parent effects
  are never discarded from a later failure classification.
- Tree preflight preserves the original spelling of every folded directory
  prefix, so `Dir/a.txt` plus `dir/b.txt` is refused before worker dispatch.
  Complete inspection additionally requires the linked-admin index to remain a
  stable single-link regular file across Git status observation.
- The target name is derived from the workspace ID digest and generation. The
  administrative name is derived from the ownership-binding digest. A closed
  canonical manifest binds versions, object IDs, generation, ownership digest,
  and hashed physical identities. Inspect/recover compare that manifest with
  authoritative Git and filesystem state.
- Cleanup returns `policy_denied/cleanup_policy_unavailable` before consulting
  roots, starting a worker, or invoking Git. Integration, ref mutation, push,
  product composition, general cleanup, and support claims remain absent.
- SQLite schema and persistence ownership are unchanged. Durable application
  state retains only the existing receipt digest and closed projection, never
  the raw backend receipt, manifest, canonical path, repository content, or
  ownership binding.

## Current post-A2-attempt-1-repair observations

The following observations bind only the current uncommitted material state;
they do not replace the final exact-head gate receipts:

- Host probe: Node `24.19.0`; Git `2.53.0.windows.1`; `win32`/`x64`, kernel
  release `10.0.22631`.
- The focused Windows create E2E passes `1/1`.
- The split recovery selections pass `10/10`, including response loss, a real
  SQLite close/reopen recovery that reaches `ready` without a second create.
- The complete five-file Windows adapter selection passes `46/46`: adapter
  contract `3/3`, command/repository security `10/10`, path/ownership security
  `22/22`, recovery `10/10`, and linked-worktree E2E `1/1`, with zero
  fail/skip/todo. It includes real create at both 239 and exactly 240 UTF-16
  code units for target and linked-admin paths, exact 241 refusal before any
  registration/target/Git mutation, all eight cwd namespace-anchor probes, both
  production capability parents, exact upstream-effect ambiguity and durable
  `recovery_required`, directory-only case collision preflight, hardlinked-index
  partial inspection,
  object-store and target-tree reparse/alias refusal, and canonical positive
  generation text. It also deterministically creates `.git/worktrees`, injects
  failure of the immediately following identity read through a direct-module,
  package-root-unexported test runner, retains the unproven directory without
  cleanup, and proves `ambiguous_external_state` plus durable
  `recovery_required`. The host did not permit privileged file-symlink creation;
  the stable suite therefore uses an unchanged-byte hardlink substitution for
  a tracked leaf and a directory junction for recursive reparse coverage,
  without skip or weakened expected outcome.
- The current post-residual workspace/application/architecture regression
  selection passes `70/70`; the adjacent persistence repository/schema/smoke
  selection passes `47/47`. Both invocations have zero fail/skip/todo. The
  earlier broader post-A1 selection passed `72/72` at its recorded state.
- Strict typecheck and build pass. Lint reports `264` checked files and exactly
  `46` production source files. Documentation validation passes `137` Markdown
  files, `260` local links, `22` local fragments, and zero forbidden paths.
- The offline dependency-shape check passes with zero production dependencies
  and exact `typescript@5.9.3`. Package smoke passes with `184` packed files,
  frozen offline install, consumer types, package-root export, persistence,
  source/built/installed console parity, and uninstall all passing.

Those are the primary results after the current A2-attempt-1 repair. The first
focused recovery invocation reached the new test with an invalid overlong
fixture generation prefix and reported `9/10`; shortening only that test-owned
label produced the recorded `10/10` result. Fresh independent A2 rerun, the
complete Node suite, full offline verification, the separately networked
dependency audit, and all 17 frozen coordinator gates are not yet recorded as
passing here.

## A1 repair evidence

- `F-A1-EP03B-001`: production now probes the real configured Project and
  workspace filesystems before acquiring linked-admin or target leaves. A
  pre-existing probe destination returns exact `conflict/
  capability_probe_conflict`, preserves the complete fixture digest and Git
  worktree inventory, and creates neither target nor linked-admin leaf.
- `F-A1-EP03B-002`: the recursive-tree fixture creates distinct `Dir` and `dir`
  tree objects; real create returns `permanent_external/case_colliding_tree`
  before `.git/worktrees`, target, or linked-admin creation.
- `F-A1-EP03B-003`: a deterministic workspace-parent probe conflict after the
  adapter acquired the previously absent `.git/worktrees` parent returns
  `ambiguous_external_state`; the real durable application path records the
  failed create intent as ambiguous and the generation as `recovery_required`,
  with no target, linked-admin, or Git worktree registration.
- `F-A1-EP03B-004`: replacing the unchanged index path with a hardlink keeps its
  bytes intact but inspect returns `inspected_partial`, null registration
  identity, and a byte-stable fixture digest.
- `F-A2-EP03B-001`: directory acquisition now returns a closed success/failure
  result that retains `effectStarted=true` when mkdir succeeds but identity
  validation fails. Every capability-parent, workspace-parent, object-parent,
  linked-admin, target and tree caller handles that result explicitly. The
  deterministic real-filesystem/SQLite regression leaves the unproven empty
  parent in place, creates no admin or target leaf, returns
  `ambiguous_external_state/worktrees_directory_unavailable`, and persists the
  create intent/generation as `ambiguous`/`recovery_required`.

## Artifact and external-action boundary

One diagnostic generation from an earlier interrupted E2E invocation remains
inside the task's frozen `.task-artifacts` inventory. A later fresh E2E passed
and removed its own generation. No matching child worker remains. The residue
will not be manually deleted; only the standing-authorized, pathless
coordinator `prune-artifacts` transition may remove it after the result commit
and before exact-head gate receipts.

The production dependency audit has not run. It is a separately networked gate
and will be recorded exactly according to the frozen Git-flow gate definition;
no network result or support conclusion is inferred from local dependency-shape
checks.
