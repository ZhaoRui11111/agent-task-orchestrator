# EP-03B A0 attempt 2 — revision required

Reviewer: `/root/ep03a_a0_5`

Reviewed at: `2026-09-02 13:54:40+08:00`

Reviewed material base: `d0ed2d85c2908e36f8b97a450366ee85ab72368f`

Approval contract: 35,564 canonical UTF-8 bytes, SHA-256 `30CA5FB6D674F9F20E37BD97EC0AEAE82414F44DA7B530AD7B94B23D1B65905B`

Independence: fresh attempt-2 independent strictly read-only reviewer; no role in the contract revision, implementation, product testing, file mutation, Git/ExecPlan/Git-flow mutation, authorization decision, or external action.

Evidence: independent canonicalization reproduced the exact byte count and digest. Fresh trace returned `ok=true`, no errors/warnings/outside-scope/dirty overlap, exact base/HEAD `d0ed2d85c2908e36f8b97a450366ee85ab72368f`, and state `git-sha1:2b9993ff254aa4fd56a543a6515ceb1abaddfae2`; terminal resolution and chain check remained exact. The reviewer confirmed attempt-1's root non-overlap, closed repository topology, no-checkout regular-file materializer, immutable binding, physical manifest/three-way recovery, mutable-revision-floor distinction, `.task-artifacts` fixture boundary, schema/product/cleanup/EP-03C boundary, and support non-claim. No product test or mutation was run.

Parent disposition: all three new findings are confirmed, in scope, and approval-contract material. The proposal remains inactive; this attempt is superseded by a second contract revision and fresh A0.

## Findings

### F-A0-04 — HIGH — linked-admin first-write window is not anchored

`git worktree add --no-checkout` creates and writes the linked-worktree administration child before that new directory can be held as a current-directory guard. Anchoring only the common `worktrees` parent cannot prove the child was not swapped to a reparse target during registration, so later ambiguity cannot satisfy the never-outside-root criterion.

Minimum closure: do not let Git create that namespace. From an already anchored `worktrees` parent, the trusted owner must use an atomic create-if-absent directory operation, enter/verify/hold the exact deterministic admin identity before any control-file write, create every registration control leaf with exclusive no-follow semantics, and then use Git only to validate/read the constructed registration. Freeze the admin naming/collision rules, target `.git` leaf handling, interruption classes, and zero-outside-write negatives.

### F-A0-05 — HIGH — manifest rename is not a no-replace CAS

An absent check followed by ordinary Windows rename can overwrite a competing final leaf. Reopening the caller's bytes would then hide the foreign evidence, contradicting the no-adoption rule.

Minimum closure: remove temporary-to-final rename. Atomically acquire the final manifest identity with create-if-absent/no-replace (`O_CREAT|O_EXCL`/`wx`) on a verified host, keep that descriptor, write/fsync/close, and accept only exact canonical bytes on reopen. `EEXIST`, identity drift, interrupted/truncated content, or missing capability is conflict/partial/ambiguity and is never overwritten or repaired.

### F-A0-06 — MEDIUM — version owner conflicts with same-major reset

The proposal adds a required `ato.workspace/v1` field while `docs/reference/versioning-compatibility-contract.md` says EP-03A closed that exact v1 shape and required-field changes require v2. The sole version owner was outside task scope.

Minimum closure: add that owner to scope and record the user's explicit unreleased fresh-only same-major exception, the absence of old readers/supported consumers/full persisted wire receipts, rejection of the old shape, and v1 closure after this reset; or use v2 and reassess the full envelope. Binary validations must compare the version owner with adapter and compatibility evidence.
