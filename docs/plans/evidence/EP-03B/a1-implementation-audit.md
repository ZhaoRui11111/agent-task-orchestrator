# EP-03B A1 implementation audit

- Report status: `complete`
- Reviewer: `/root/ep03b_a1_1`
- Reviewed at: `2026-09-02T18:21:20+08:00`
- Reviewed material state: `git-sha1:fa5b42e105bbc2280f621cd0303765b582698203`
- Approval SHA-256: `42CE09525A869C8A91E8DD8DDF9025D254CE2240C497486D0F50158265F349E6`
- Material base: `d0ed2d85c2908e36f8b97a450366ee85ab72368f`
- Independence: fresh independent non-implementer strict read-only A1 review.
- Parent disposition: `a2_required`
- Closes: none

The reviewer inspected the complete approved EP-03B diff, the active plan and
prior evidence, the authoritative adapter/reliability/authorization/
persistence/security contracts, the concrete adapter and its focused tests.
The review made no repository, Git, coordinator, fixture, product, network,
credential, external-repository, release or deployment mutation. The parent
then independently reproduced each cited implementation path and accepted all
four findings as in-scope defects. No finding grants additional authority or
changes the approved architecture; each requires a local repair, focused
regression evidence and a fresh independent A2 at the repaired exact state.

## Findings and parent reproduction

### F-A1-EP03B-001 — HIGH — production lacks a real mutation capability probe

Production validates paths, versions and current-directory identities but does
not itself prove that the configured filesystem prevents renaming a current
directory or its ancestor before the first registration leaf is acquired. The
existing dummy-process test is validation-only and cannot attest the configured
Project/workspace mutation namespaces. The parent confirmed that the production
worker chain reaches `.git/worktrees` and then the linked-admin acquisition
without such a probe. Repair must add a fail-closed, per-operation production
capability attestation bound to each configured root/filesystem and mutation
window, plus a failed-probe regression proving zero target, admin or Git
registration mutation.

Parent classification: `confirmed=true`, `in_scope=true`,
`changes_task_diff=true`, `disposition=a2_required`.

### F-A1-EP03B-002 — MEDIUM — directory-only case collision mutates before refusal

`parseTree` retained only folded directory names in a `Set`. Consequently,
paths such as `Dir/a.txt` and `dir/b.txt` could pass preflight even though they
name the same directory on Windows, and the second spelling would be refused
only after the mutation worker had created the first directory. The parent
reproduced this from the folded-directory loop. Repair must retain the original
spelling for every folded directory prefix, reject a mismatch during preflight,
and prove zero registration/target/admin mutation.

Parent classification: `confirmed=true`, `in_scope=true`,
`changes_task_diff=true`, `disposition=a2_required`.

### F-A1-EP03B-003 — MEDIUM — created worktrees namespace loses effect status

`workerStageObjects` may create `.git/worktrees`, but it returned only the
downstream worker's `effectStarted` value. A later linked-admin conflict could
therefore be classified as `effectStarted=false` even though the adapter had
already mutated the Project namespace. The parent reproduced the discarded
`worktrees.created` fact and the downstream no-effect return. Repair must
propagate the logical OR of every upstream namespace acquisition/capability
probe effect and every downstream effect, and prove that a deterministic
post-parent failure becomes `ambiguous_external_state` and durable
`recovery_required`.

Parent classification: `confirmed=true`, `in_scope=true`,
`changes_task_diff=true`, `disposition=a2_required`.

### F-A1-EP03B-004 — MEDIUM — hardlinked unchanged index is accepted as complete

`inspectPhysical` checked only that the linked-admin `index` resolved as a
regular file. It did not require a stable single-link file identity, so an
unchanged-byte hardlink could satisfy the complete observation. The parent
confirmed that `identityFor(index, "file")` omits the link-count invariant.
Repair must require a stable regular file with `nlink === 1` and add a negative
inspection regression that returns `inspected_partial` without mutation.

Parent classification: `confirmed=true`, `in_scope=true`,
`changes_task_diff=true`, `disposition=a2_required`.
