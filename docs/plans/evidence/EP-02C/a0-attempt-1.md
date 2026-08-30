# EP-02C A0 attempt 1

- Reviewer: `/root/ep02a_a0`
- Report status: `complete`
- Readiness: `revision_required`
- Reviewed at: `2026-08-31 03:10:22+08:00`
- Approval SHA-256: `E959478285459F71142482BD2EC3B9BFD3DB94EDFB75AB025855F987F54B6214`
- Reviewed material base: `544bf159f5dfe3517ec7d2535894422888c8a7e9`
- Parent disposition: all four MEDIUM findings confirmed in-scope; approval contract revised before activation.

## Independence and scope

This was a fresh independent read-only EP-02C A0. The reviewer did not rely on prior EP-02A/EP-02B audit conclusions, did not draft or implement this proposal, and made no file, Git, ExecPlan, coordinator, permission, network, test-artifact or external-state mutation.

The review covered the unique schema-v3 EP-02C proposal, repository guidance, predecessor and accepted material-base transition, authorization and scope, Tier-2 schema-v7 persistence, trigger/run ownership, reconcile-summary-seal ordering, immutable candidate fan-out, claim/start-intent atomicity, worker recovery, terminal summary completeness, redaction, public/non-goal boundaries, milestones, validations and risks.

## Evidence

The reviewer completely reread `AGENTS.md`, `ARCHITECTURE.md`, `docs/plans/README.md`, the complete proposal, the harness ExecPlan schema/A0/Tier-2 persistence instructions, and the authorization, Domain, persistence, reliability, scheduler, adapter, versioning, observability, CLI, toolchain, validation, privacy, threat-model and local Git-flow owners plus relevant implementation facts.

Independent compact sorted-key UTF-8 canonicalization produced 31,942 bytes and SHA-256 `E959478285459F71142482BD2EC3B9BFD3DB94EDFB75AB025855F987F54B6214`. Fresh trace returned schema v3 proposal, `errors=[]`, `warnings=[]`, accepted base transition, approval base `544bf159f5dfe3517ec7d2535894422888c8a7e9`, current base/HEAD `fcbd537bfcc0ba41f037031790a3f487c05e7378`, and empty outside-scope, overlap, pre-existing-dirty and material-path sets. Terminal resolution uniquely identified EP-02B at `544bf159f5dfe3517ec7d2535894422888c8a7e9`. Git ancestry and the preserved creation-stage chain check were exact; the accepted base delta changed only the schema-v6 checksum value in `docs/reference/persistence-contract.md`, and the new value matched released migration bytes, registry, tests and immutable EP-02B evidence.

Current implementation evidence showed schema 6, 29 actions, no `dispatch.run`, no dispatcher source, no migration 0007 and no EP-02D file. The proposal otherwise covered reconcile-summary-seal order, candidate/member CAS, claim plus both execution decisions and prepared start intent in one transaction, no adapter call in a writer transaction, stale-owner/fence recovery, durable completeness, bounded redaction and the library-only/no-scheduler/no-public-CLI boundary.

## Findings and closure

### F-EP02C-A0-001 — MEDIUM — contract gap

`approval_contract.scope.task_paths` omitted `AGENTS.md`, `CHANGELOG.md` and `docs/reference/contract-ownership.md`, each of which truthfully described dispatcher/fan-out as unimplemented. The omission prevented V14 and authority-order consistency from closing. The parent added exactly those three files to task scope, limited to truthful schema-v7 library Manual Dispatcher status and retained all scheduler, daemon, public CLI, adapter, platform and later-phase non-claims.

### F-EP02C-A0-002 — MEDIUM — contract gap

The initial C4/V3/D1 language did not choose between a delta-only vocabulary-7 epoch and the repository's existing complete-origin-inventory epoch model, and did not define vocabulary-7 renewal. The parent froze one confirmed 6-to-7 upgrade and every vocabulary-7 renewal as a new contiguous epoch with exactly thirty fresh origin grants: 23 existing Phase-2A actions in the legacy owner with v7 links, six Manual actions in the v6 owner with v7 links, and one `dispatch.run` grant in the v7 owner, all sharing the epoch lifetime and global identity/partition checks.

### F-EP02C-A0-003 — MEDIUM — contract gap

The initial C3/V2/D1/persistence language promised dispatcher-aware backup/restore without a new lifecycle digest provenance. The parent added immutable lifecycle digest version 4 with one physical owner and an exact projection consisting of version 3 plus vocabulary-7 lineage and every dispatcher trigger/decision/audit/run/reconciliation/membership/member/summary record. Versions 1, 2 and 3 retain byte-semantic readers; migration creates no digest row; V2 now tests historical readback, v4 drift invalidation and recorded-projection selection across backup, restore, recovery and doctor.

### F-EP02C-A0-004 — MEDIUM — contract gap

The initial C6/V5/D4 language did not define run-lease units or bounds. The parent froze an immutable per-run safe-integer duration of 30 through 3,600 seconds, trusted-ingress owner identity, expiry equal to trusted UTC now plus the stored duration, strictly forward no-input/no-banking renewal, and first-eligible takeover at `now >= expiry`, with exact lower/upper, clock and stale-owner validation.

All four findings changed approval material, so this attempt is superseded and a fresh independent A0 is required before activation.
