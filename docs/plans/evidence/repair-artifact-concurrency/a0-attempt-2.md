# A0 attempt 2

- Reviewer: `/root/a0_artifact_concurrency`
- Reviewed at: `2026-08-30 13:19:01+08:00`
- Approval SHA-256: `B63E6ABCAFBDDFAFB2A642BCFDA2F9226EB9ECCCC94F527C0EBFCFBBCE2755F7`
- Reviewed material base: `039f81b7ae01708a74bda2f40ec0a543978f46c7`
- Result: `revision_required`

The fresh reviewer confirmed that attempt-1 findings `F-A0-01` and
`F-A0-02` were substantively closed by generation-only worker cleanup,
single-attempt root creation, no retry, quiescent higher-level reclamation,
deterministic seam evidence, and supplementary process stress.

Four new `MEDIUM contract_gap` findings were accepted by the parent:

- `F-A0-03`: the toolchain owner and current feasibility descriptions were
  missing from task scope, and the snapshot comparator versus route-level
  root reclaimer distinction was not exact.
- `F-A0-04`: one allowed-action sentence retained the rejected bounded-retry
  and no-delete wording.
- `F-A0-05`: package-smoke and SQLite acceptance checked zero members rather
  than proving the exact root absent and reclaim errors observable.
- `F-A0-06`: recovery overstated manifest-prune authority for residue outside
  or hidden from the exact frozen root.

The approval contract is revised to include and truth-sync the authoritative
toolchain/current feasibility documentation, narrow the exact filesystem
authorization, require standalone consumer root-absence/error evidence, and
limit manifest prune to residue still visible inside the exact frozen root.
External, hidden, or unknown residue fails closed for explicit human handling;
deterministic fixtures may not create sibling residue outside their owned
fixture topology. Fresh independent A0 is required.
