# EP-03A A0 attempt 1

- Report status: `complete`
- Readiness: `changes_required`
- Reviewer: `/root/ep03a_a0`
- Independence: fresh independent read-only reviewer; no proposal drafting or implementation role
- Reviewed at: `2026-09-01 23:04:47+08:00`
- Approval SHA-256: `F2192ADFB31033B3E488B19BFB409F3DF45E819DB4C35943BE2CA5349FB90E10`
- Approval contract bytes: `26272`
- Reviewed material base: `fc42a2ead9698e2e25341b014526d4b348fc016c`
- Trace state: `git-sha1:c3014a570dcfffacb70a57026ae40a298edbfd30`

The reviewer independently canonicalized the approval contract as sorted-key,
compact UTF-8 JSON and reproduced the stored byte count and uppercase digest.
The task branch and reviewed base matched, only the task-owned proposal was
untracked, and no EP-03B or EP-03C plan existed. The repository authority,
architecture, lifecycle, persistence, authorization, reliability, workspace,
adapter, observability, privacy, threat, compatibility, validation, toolchain,
and Git-flow contracts were reviewed under the full Tier-2 persistence lens.
No product test, file mutation, Git mutation, coordinator transition, or
external action was performed by the reviewer.

## Findings

### F-A0-01 — HIGH — task scope incomplete

Stage 5 could not be implemented and validated inside the approval envelope.
`src/application-policy.ts` owns the current terminal upgrade, while
`docs/reference/cli-contract.md` owns the thirty-action and `1 -> 2 -> 3 -> 4`
public facts. `test/cli-phase2-e2e.test.mjs`,
`test/dispatcher-security.test.mjs`, and
`test/execution-claim-foundation.test.mjs` contain hard-coded current
vocabulary assertions. The five paths had to enter task scope, with their
changes constrained to the existing command grammar and exact stage-5
semantics.

### F-A0-02 — HIGH — durable transition contract incomplete

The proposal did not freeze a closed workspace-generation status set or its
legal transitions. That left invalid-transition, terminal readback, recovery,
replacement, cleanup refusal, current-generation uniqueness, ambiguity, and
revision/CAS ownership non-binary. The approval contract had to define those
meanings without importing EP-03B Git inventory, and the execution contract had
to bind writer/readback and crash recovery to the state machine.

### F-A0-03 — MEDIUM — stage-5 provenance drift

The user authorized a finite vocabulary update for the five EP-03A operations,
but did not prescribe the number 5 or its mechanics. Retaining active stages
1 through 4 and adding contiguous stage 5 is a proposal design decision. The
approval contract had to distinguish that design provenance and explain why
only cleanup among the new actions is high-risk.

### F-A0-04 — MEDIUM — prior baseline identity imprecise

Validation V6 called Git prefix `fc42a2e` the prior checksum/baseline. The prior
migration SHA-256 is
`518E84129E6753E7D0E5078223DCCB43E155AA2FD2120DD2A4C3F5F633FCEBFA`; the Git
material base is the separate full commit
`fc42a2ead9698e2e25341b014526d4b348fc016c`. The refusal criterion had to name
the migration registry identity and checksum exactly.

## Parent disposition

All four findings were confirmed and in scope. This non-ready attempt is
superseded by an approval-contract revision; it grants no implementation
readiness. The proposal must receive a fresh independent A0 against the new
canonical digest before activation.
