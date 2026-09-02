# EP-03B A0 attempt 1 — revision required

Reviewer: `/root/ep03a_a0_5`

Reviewed at: `2026-09-02 13:33:40+08:00`

Reviewed material base: `d0ed2d85c2908e36f8b97a450366ee85ab72368f`

Approval contract: 30,253 canonical UTF-8 bytes, SHA-256 `1A7CBBE7008C58D75415CA58F7CFE9BB2B89A555097609FDE8CD8F141BF709C3`

Independence: fresh independent strictly read-only reviewer; no EP-03B proposal drafting or design role, implementation, product testing, file mutation, Git/ExecPlan/Git-flow mutation, authorization decision, or external action.

Scope: the complete schema-v3 proposal and both contracts; repository authority; EP-03A terminal chain; current workspace port/application/ProjectRegistry/package boundaries; the complete adapter, authorization, completion/workspace, reliability, security, privacy, validation, toolchain, CLI and Git-flow contracts; the Tier-2 persistence lens; and the proposed Windows anchor, Git, ownership, cleanup, public-export, fixture and support-claim boundaries.

Evidence: independent canonicalization reproduced the exact byte count and digest. Fresh trace returned `ok=true`, no errors/warnings/outside-scope/dirty overlap, exact base/HEAD `d0ed2d85c2908e36f8b97a450366ee85ab72368f`, and state `git-sha1:50ca36738c05826581c1ce3e97f82527f3029a94`. EP-03A terminal resolution and chain check matched the same commit. No test or mutation was run by the reviewer.

Parent disposition: all three findings are confirmed, in scope, and approval-contract material. The proposal remains inactive; this attempt is superseded by a contract revision and fresh A0.

## Findings

### F-A0-01 — HIGH — incomplete mutation-namespace anchoring

The proposal prohibited neither equality nor ancestor overlap between the Project and workspace roots. Its current-directory anchor protected only the named current directory and ancestors, not target descendants, `.git`/gitfile, a separate Git common directory, the common `worktrees` administration namespace, or object/alternate/promisor topology. It therefore could not prove the existing contained-path/no-follow and never-outside-root criteria.

Minimum closure: freeze bidirectional root non-overlap; support only an explicitly closed repository layout; anchor every Git mutation namespace for the whole effect window; avoid Git checkout writes to unanchored target descendants or provide a provable no-follow materializer; reject gitfile/separate-common-dir/alternate/promisor and every unsupported topology before mutation; add zero-effect negatives for every excluded or swapped component.

### F-A0-02 — HIGH — no restart-verifiable physical ownership binding

The proposal claimed full creator/run/execution/fence ownership, but the current receipt does not echo those members, the application verifies only its existing receipt echo subset, and no restart-readable physical evidence protocol was defined. Path plus detached registration plus HEAD could therefore be externally recreated and misclassified as owned.

Minimum closure: authorize the narrow port/application reset needed for one immutable generation ownership binding; atomically write a bounded physical ownership manifest inside an anchored Git administration namespace; on inspect/recover compare the current durable generation binding, the physical manifest, and current Git/filesystem observations; reject missing, truncated, substituted, stale-fence, rebuilt, or foreign evidence. Neither marker nor receipt alone is authority.

### F-A0-03 — MEDIUM — OS-temporary fixtures outside canonical scope

The proposal permitted real fixture mutations in an unspecified OS temporary root while `external_paths=[]`.

Minimum closure: remove that alternative and constrain every real fixture generation to the repository-owned ignored `.task-artifacts` mechanism with its existing ownership/prune boundary.
