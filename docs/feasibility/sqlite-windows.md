# Windows SQLite feasibility record

This is non-normative historical EP-00B spike evidence. It did not introduce a
runtime schema and still does not prove support. The EP-01B production
persistence foundation and its separate validation do not retroactively turn
this spike into implementation evidence. Current requirements remain owned by the
[persistence contract](../reference/persistence-contract.md) and
[reliability protocol](../reference/reliability-protocol.md).

## Procedure

`pnpm spike:sqlite` uses the SQLite library bundled with the frozen Node
runtime on the local Windows filesystem. It creates one uniquely owned
generation under the ignored `.task-artifacts/` boundary and checks:

- foreign-key enforcement and integrity checking;
- WAL mode, bounded busy behavior, and a concurrent snapshot reader/writer;
- competing worker-thread revision claims with exactly one winner, bounded
  pre-readiness failure observation, and clean worker termination;
- online backup to an exact two-member, no-follow private stage followed by
  standalone `journal_mode=DELETE` normalization, manifest/hash validation,
  create-if-absent publication outside that stage, explicit
  expected/new/readback identity binding, integrity, and data readback;
- refusal of incomplete, extra-member, reparse-backed, losing, stale-CAS, and
  corrupt backup candidates; and
- fresh-process recovery of a persisted intent whose external effect exists
  but whose receipt does not, classified as ambiguous without replay.

The script removes only its exact owned generation. Its JSON output excludes
temporary paths, prompts, identifiers, and database contents. A mock or a run
on another platform cannot satisfy the Windows evidence criterion.

The original EP-00B terminal evidence predates the repository artifact
manifest and truthfully records the historical `.ep00b-tmp/` location used by
that commit. The current procedure uses `.task-artifacts/`; this rename does not
turn the feasibility script into a production persistence implementation.

## Evidence status

Executions on 2026-08-28 passed the repaired complete procedure on Windows
kernel `10.0.22631`, `x64`, NTFS, Node.js `24.19.0`, and bundled SQLite
`3.53.3`, including the post-A1 candidate's full local gate. An earlier 20-run
stress loop belongs to the pre-A1 implementation and is retained only as
historical evidence, not as closure evidence for the repaired candidate. The
exact observations are in the
[EP-00B evidence log](../plans/evidence/EP-00B/validation-evidence.md). This is
real feasibility evidence, but by itself it is not evidence of the current
product schema, production lifecycle, release, or supported platform. The
terminal task-head receipt remains a separate post-commit gate.
