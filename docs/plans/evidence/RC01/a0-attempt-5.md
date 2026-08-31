# RC01 A0 attempt 5

Fresh independent reviewer: `/root/rc01_a0_final`
Reviewed at: `2026-08-31 18:10:54+08:00`
Approval SHA-256: `32C8084030FF12B0C94312FEF21A20E5AA3D78EF49FD9CED401E3901CA3D2FFE`
Reviewed material base: `c95de33b104282292a0cd9203e66e5a1112cb3bd`
Readiness: `ready_for_activation`

## Independence and scope

Fresh independent read-only schema-v3 A0 of the then-current approval revision. The reviewer audited an earlier RC01 approval revision but did not draft the proposal, participate in either subsequent scope revision, make substantive design or disposition decisions, implement RC01, edit repository/Git/coordinator/runtime/external state, run mutation-capable tests, or grant authority.

The review covered the complete then-current proposal and A0/contract-revision history; repository and harness guidance; Tier-2 persistence requirements; adjacent persistence, authorization, reliability, CLI, versioning, toolchain, validation and ownership contracts; current dirty migration/open paths; the new baseline inventory; application writer/reader compatibility paths; backup/restore/doctor boundaries; and every test caller then known to consume historical migration prefixes, physical grant partitions, grant-epoch links and lifecycle digest versions.

## Evidence

The single authorized trace exited 0 with `errors=[]`, `warnings=[]`, `outside_scope=[]`, `overlap=[]`, `pre_existing_dirty=[]`, exact base/HEAD `c95de33b104282292a0cd9203e66e5a1112cb3bd`, state `git-sha1:656267217a938a6baeb6d3051e8b22552875ee76`, and only task-owned dirty implementation. Independent canonicalization produced 19,789 approval bytes and exact SHA-256 `32C8084030FF12B0C94312FEF21A20E5AA3D78EF49FD9CED401E3901CA3D2FFE`; removing only `dispatcher-security.test.mjs` reproduced prior digest `33803D9D06453006078C89C1D7A9A1D1D239A44532987808F27E3E59AA131674`. Complete adjacent-symbol enumeration found no other omitted implementation or test caller. The single-table epoch/grant model, digest version 4, explicit vocabulary 4-to-7 progression, refusal-before-mutation, RC02 backup/restore-format boundary and RC03-RC05 non-goals were coherent; all V1-V10 criteria remained binary and complete. No substantive finding remained.

## Parent disposition

The report activated RC01 and was complete for approval digest `32C8084030FF12B0C94312FEF21A20E5AA3D78EF49FD9CED401E3901CA3D2FFE`. Later current-document inspection found that `docs/reference/adapter-contracts.md` still described the implemented Manual adapter as backed by a schema-v6 journal. Because that current-status contract must change for RC01 documentation truthfulness but was outside the approved task paths, the parent archived this otherwise-ready report as stale, added exactly that file, and requires a fresh independent A0.
