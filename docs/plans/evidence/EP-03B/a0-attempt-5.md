# EP-03B A0 attempt 5

This is immutable evidence for the approval revision with canonical
`approval_contract` SHA-256
`D0A7B6BBFB78E9CBF8A8DB58AA7C46BCFB5983A4190FD20FD51414D4A3593652`.
It is not the current activation approval. The parent accepted both findings,
revised the contract, and requires a different fresh A0.

## Review record

- `report_status`: `complete`
- `reviewer`: `/root/ep03b_a0_5`
- `independence`: fresh independent strictly read-only reviewer; the reviewer
  did not draft the proposal, make its substantive design decisions, implement
  the change, edit repository state, or grant authority.
- `scope`: complete schema-v3 proposal, all EP-03B evidence, repository
  authorities, Tier-2 persistence lens, current trace, relevant contracts,
  source and tests, and closure of F-A0-01 through F-A0-08.
- `readiness`: `revision_required`
- `reviewed_at`: `2026-09-02 17:11:12+08:00`
- `approval_contract_bytes`: `41546`
- `approval_sha256`:
  `D0A7B6BBFB78E9CBF8A8DB58AA7C46BCFB5983A4190FD20FD51414D4A3593652`
- `reviewed_material_base`:
  `d0ed2d85c2908e36f8b97a450366ee85ab72368f`
- `parent_disposition`: `revision_required`

The reviewer independently reproduced the canonical bytes and digest. Fresh
trace returned `ok=true`, no errors, warnings, outside-scope paths, overlaps,
or pre-existing dirty paths; base and HEAD were the reviewed material base,
the material state was
`git-sha1:bb41b32407eb17d5888f86b709f1db56fce4a7c4`, and the next action was
`run_a0`. EP-03A terminal resolution and the EP-03A to EP-03B chain check both
accepted that predecessor.

## Findings

### F-A0-09 — MEDIUM fact drift

The sole topology owner at
`docs/reference/completion-workspace-contract.md` already named the compact
target/admin layout but retained a bullet requiring a nonexistent `run root`
to be independently resolved. C5/D2, the implementation, and the fixture have
no run-root path level; run lineage is present only in
`ownershipBindingSha256`. This conflicts with the repository fail-closed
authority rule.

Required closure: replace that bullet with the actual configured workspace
root, exact `ato-workspaces` parent, and exact generation containment/identity
hierarchy; keep run identity only in the ownership digest.

### F-A0-10 — HIGH contract gap

C5 froze an exact 240 UTF-16-code-unit target bound, while the sole topology
owner did not own that value and V4/V5/V6 did not require binary boundary
evidence. The implementation had `MAX_PATH_LENGTH = 240` and exact
`workspace_target_too_long` / `workspace_admin_too_long` refusals, but the
workspace Git tests did not exercise the boundary. The safety-critical limit
could therefore regress while every frozen validation still passed.

Required closure: make the completion/workspace contract own the exact target
and admin UTF-16 limit and canonical generation text; revise a material-bound
validation to require below-bound, exact-bound, and above-bound target/admin
cases, pre-mutation refusal, and zero outside-root writes; add the matching
tests after fresh activation.

## Other conclusions and exclusions

F-A0-01 through F-A0-08 were otherwise materially closed. The compact target
and admin names match implementation and fixture; the complete immutable
Project/Task/run/member/membership/execution/attempt/fence/workspace/generation/
creator/base/adapter lineage remains bound through the ownership digest;
manifest, receipt, and live observation are matched; cleanup is denied before
root/worker/Git access; product/CLI wiring and support claims remain absent; and
the SQLite schema/persistence boundary remains unchanged.

The reviewer performed no file edit, test, build, dependency resolution,
fixture effect, network or credential access, external repository access,
ignored-artifact inspection/cleanup, Git/coordinator mutation, or external
write.
