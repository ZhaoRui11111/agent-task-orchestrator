# EP-03D A1 attempt 1 — implementation findings

Reviewer: `/root/ep03d_a0`

Reviewed at: `2026-09-04 14:32:47+08:00`

Reviewed state: `git-sha1:1ece0a6e4ccca28d9cc29fe6bea77a5031533f1e`

Reviewed material base: `9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33`

Approval SHA-256: `F97C483DA2434F96F242254EB3EBBE27DF53E11B9DBE6E77B1885F62B3E884A0`

Independence: fresh independent A1 reviewer who did not participate in EP-03D implementation or repair and did not reuse an A0 conclusion as the A1 conclusion. The review was strictly read-only and made no file, Git/index, coordinator-state, artifact, dependency, cache, network, credential, real-account, or external-Project change. It did not read, compare, or derive evidence from the superseded `ep-03d` task or worktree.

Scope: complete current plan and authoritative contracts plus all 53 tracked modified and 12 untracked task paths at the reviewed state. The review covered the sole `ato.execution/v2`, retained Manual convergence, the package-private/non-composed Codex boundary, authorization vocabulary 6, workspace/cwd/HEAD/input/fence binding, thread/resume/predecessor lineage, intent-before-effect, out-of-transaction adapter calls, independent observation and reconciliation, restart ambiguity, inspect/cancellation truthfulness, SDK event/error grammar, fresh decode/digest/backup/migration invariants, package exports, dependencies, and support non-claims.

Evidence: a current trace exited zero with `ok=true`, approval bytes 19,964, the recorded approval digest, approval/current material base and HEAD all equal to the reviewed base, the reviewed state above, and empty errors, warnings, outside-scope paths, overlap, and pre-existing dirty paths. The reviewer read the repository and skill authorities and inspected the complete diff. Supplied validation evidence showed a serial 593/593 suite plus lint over 295 files/56 sources, typecheck, build, docs, dependency check, package smoke, SQLite and Codex probes, and diff check passing; the Codex probe truthfully retained `externalE2E=not_run` and `supportClaim=false`. Two authorized dependency-audit attempts ended with npm-registry transport timeout code 23/exit 1 and no vulnerability result, so dependency audit was not treated as passed.

## Findings and parent disposition

### F-A1-EP03D-001 — HIGH — cross-backend double ownership

The start preparation checked only the selected backend family, the fixture performed a prior Manual effect before a Codex start on the same execution, and the combined decoder had no cross-family exclusivity invariant. One execution/attempt/fence could therefore acquire both Manual and Codex durable owners. Parent disposition: confirmed, in scope, changes the task diff, `a2_required`. Repair rejects either-family ownership from both start paths, rejects cross-family persisted overlap, and replaces the fixture's Manual effect with a proven no-effect reconciliation.

### F-A1-EP03D-002 — HIGH — reliable Codex successor orchestration absent

The injected Codex service intentionally exposes start, inspect, cancel, and reconciliation but does not allocate resume/retry successor executions; the backend/journal continuation is covered below that service. Parent disposition: not confirmed for the approved EP-03D deliverable and out of scope, no task-diff change, `not_applicable`. D4/M3/V6 require package-private backend-level same-thread continuation, while allocation of a new fenced execution and current ready successor workspace is explicitly reserved for EP-03F product composition. Implementing the proposed reliable successor allocator here would broaden the approved execution and authorization boundary.

### F-A1-EP03D-003 — HIGH — incomplete workspace physical proof

The Codex verifier duplicated a subset of Git checks and did not verify the complete workspace-owner manifest, exact administration/registration inventory, or durable repository identity. Parent disposition: confirmed, in scope, changes the task diff, `a2_required`. Repair delegates physical inspection to the sole `windows-git-local` workspace owner, binds the configured Project `rootKey`, compares the current durable ready receipt's repository identity before and after inspection, and adds manifest and registration corruption regressions.

### F-A1-EP03D-004 — MEDIUM — historical inspect rejected then masked

The journal inspect path reused the origin mutation's exact-current tuple after a waiting transition advanced revisions; presentation could then return the old turn view without fresh evidence. Parent disposition: confirmed, in scope, changes the task diff, `a2_required`. Repair separates the immutable turn tuple from the current inspect semantic tuple and requires new observation/receipt/finalization evidence; an injected inspection refusal now proves old success cannot masquerade as fresh evidence.

### F-A1-EP03D-005 — MEDIUM — terminal cancellation degraded to ambiguity

The backend returned ambiguity even when durable state already proved `turn_succeeded` or `failed`, and the reliable reflection rule required a nonexistent cancellation operation row. Parent disposition: confirmed, in scope, changes the task diff, `a2_required`. Repair returns the existing `already_terminal` no-effect receipt, leaves the terminal turn unchanged, and finalizes fresh cancellation evidence without moving a successful Task to waiting.

### F-A1-EP03D-006 — MEDIUM — intent SQL guard omitted immutable fields

The intent transition trigger omitted `backend_kind` and the new workspace tuple. Parent disposition: confirmed, in scope, changes the task diff, `a2_required`. Repair adds backend and every workspace identity to the trigger with null-safe comparisons and adds structural plus runtime legal-transition-with-substitution regressions.

### F-A1-EP03D-007 — MEDIUM — decoder trusted terminal receipt digest

The combined decoder bound the stored value into the application digest but did not reconstruct the Codex terminal receipt projection. Parent disposition: confirmed, in scope, changes the task diff, `a2_required`. Repair centralizes the canonical start/resume terminal receipt projection, recomputes its SHA-256 from durable Act request/intent/turn/operation facts, and rejects substituted receipt identity or digest.

The six confirmed HIGH/MEDIUM repairs require one fresh independent A2 over the post-repair exact material state. This report preserves F-A1-EP03D-002 as the reviewer's finding while recording the parent's separate scope disposition.
