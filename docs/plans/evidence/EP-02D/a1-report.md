# EP-02D independent A1 report

This is the immutable fresh independent A1 report for material state
`git-sha1:cd8a5c296f676650afadc955b1618000064ec83d`. The reviewer was
`/root/ep02d_a1`; review completed at `2026-08-31 12:35:11+08:00`.

The reviewer reproduced approval digest
`9DB4EC14F569B53AAAA73A6E5FF80171F6C5D3B58B1F3B42AF2B8257F25B5011`,
base/HEAD `0700d65e9c0db78626aa31baa56f15f009fef41e`, the complete 39-path
material inventory, empty index, exact scope, and no trace warning or error.
The audit was fresh, non-implementer, non-repairer, read-only and non-fail-fast;
it made no file, Git/index, coordinator, ExecPlan, permission, network,
test-artifact, runtime-state, or external-state mutation.

The parent independently reproduced and confirmed every finding below as
in-scope and material. Findings 001 through 005 require fresh A2 after repair.
Finding 006 is limited to an exact two-line mechanical parent delta.

## F-EP02D-A1-001 — MEDIUM — concurrency and recovery

`src/persistence/local-ingress.ts` derives one deterministic actor/root owner,
so every CLI process for the runtime presents the same worker. After process
death and lease expiry, `dispatch resume` skips different-owner takeover,
same-owner takeover is refused, and the expired owner cannot heartbeat or
reconcile. Competing processes are not distinct fencing principals.

Closure requires a fresh bounded worker-instance owner per product
process/service, cryptographically bound to the validated actor/root but not
deterministic from them alone; exact durable replay must use the existing run
identity/read seam rather than impersonating the dead worker. Real-ingress
tests must prove post-expiry takeover, stale-worker rejection and duplicate-free
exact-key replay.

## F-EP02D-A1-002 — MEDIUM — public contract incompatibility

The approved v2 grammar accepted `--reason-code` and Manual outcome `--code`
through 128 bytes while the closed `ato.execution/v1` boundary rejects both
above 64. Documented-valid input therefore failed after runtime access; widening
the lower layer would violate its closed contract.

Closure preserves `ato.execution/v1` and narrows only those two v2 public fields
to 1..64, retaining 1..128 for other operational IDs and references. The
corrected approval contract requires fresh A0 before parser, facade, public
contract and exact 64/65 plus 128/129 boundary repairs.

## F-EP02D-A1-003 — MEDIUM — V10 validation gap

The Phase-2 CLI E2E uses only a fresh runtime. It does not prove the required
product workflow, explicit upgrades, restart, historical readback and exact
schema-v7 migration behavior from every shipped schema prefix.

Closure requires table-driven product CLI migration/restart evidence for every
shipped prefix, frozen historical rows/checksums, exact schema 7/no schema 8,
and the required Phase-1 setup plus Manual workflow after explicit upgrades.

## F-EP02D-A1-004 — MEDIUM — V11 validation gap

The product tests do not invoke `dispatchResume` or cover product-level
dispatch/turn response loss, intent/observation/verified-not-finalized crash
boundaries, stale takeover, pending-member recovery, Manual-report/completion
replay, old-fence late write, or unresolved ambiguity.

Closure requires reopening every existing lower-layer durable state through the
real product facade or v2 CLI and proving exact replay, no duplicate verified
effect, pending-member completion, takeover/fence CAS, report/completion replay,
and explicit waiting/ambiguity rather than success.

## F-EP02D-A1-005 — MEDIUM — V13 delivery parity gap

Package smoke exercises the packed facade directly, but source/build/installed
console parity covers only doctor and malformed input. It does not prove a
successful or denied Phase-2 CLI operation, human v2 output, restart or replay
across all three delivered boundaries.

Closure requires one deterministic disposable trusted-runtime Phase-2 CLI
scenario through source, built and packed-installed `ato`: sequential upgrades,
dispatch/inspect/report/separate completion across restart and exact replay,
current-authorization denial, malformed input, JSON/human output and public
exits, while retaining package inventory, redaction and artifact hygiene.

## F-EP02D-A1-006 — LOW — documentation consistency

The adapter contract retains the obsolete `local_manual_operator` path name
after removal of the literal identity predicate, and the toolchain contract says
“both explicit three sequential capability upgrades.” Closure is limited to
replacing those phrases with the current OS/runtime-derived actor/principal/root
boundary and “three sequential,” followed by docs validation and
`git diff --check` at the shared repaired material state.

No other non-speculative finding was reported. The reviewer did not treat
existing lower-layer tests as product-boundary proof.
