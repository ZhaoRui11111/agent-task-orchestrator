# EP-03E A1 attempt 1

```json
{
  "report_status": "complete",
  "reviewer": "Codex /root/ep03d_a0 — fresh independent A1 attempt 1",
  "independence": "Fresh independent read-only implementation audit. The reviewer did not draft, implement, or repair EP-03E and did not reuse an A0 conclusion as the A1 conclusion. No file, Git/index, coordinator, dependency, network, credential, scheduler, or external state was modified.",
  "scope": "Complete EP-03E material inventory relative to the approved base, including scheduler port/application/dispatcher ingress, authorization vocabulary, schema, repository writers/readers/combined decoder/digest, backup/restore/doctor implications, package exports/scripts/tests, feasibility evidence, and authoritative architecture/authorization/adapter/scheduler/reliability/persistence/privacy/versioning/toolchain documentation.",
  "readiness": "not_ready",
  "a2_required": true,
  "reviewed_at": "2026-09-04 20:13:56+08:00",
  "approval_sha256": "761096EA9D5E7AC7347B0B8B9B5B68AF4F48C44AB0FDCB44F75E739202858981",
  "reviewed_material_base": "e2b5da560577ec91590531d64249eefef6da3a4e",
  "reviewed_head": "e2b5da560577ec91590531d64249eefef6da3a4e",
  "reviewed_state_id": "git-sha1:f1b691377bff40c4cafdff5cf68ea0015b91270d",
  "parent_disposition": "complete",
  "findings": [
    "F-A1-EP03E-001",
    "F-A1-EP03E-002",
    "F-A1-EP03E-003",
    "F-A1-EP03E-004",
    "F-A1-EP03E-005",
    "F-A1-EP03E-006",
    "F-A1-EP03E-007",
    "F-A1-EP03E-008",
    "F-A1-EP03E-009",
    "F-A1-EP03E-010"
  ]
}
```

## Evidence

- One fresh `exec_plan.py trace --json` returned `ok=true`, exact base/HEAD
  `e2b5da560577ec91590531d64249eefef6da3a4e`, state
  `git-sha1:f1b691377bff40c4cafdff5cf68ea0015b91270d`, and no error,
  warning, outside-scope path, overlap, or pre-existing-dirty mismatch.
- The reviewer independently ran the scheduler application/contract/dispatcher/
  port focused tests: 25 passed, 0 failed/skipped/todo. The targeted vocabulary
  v7 atomicity test passed, and `git diff --check` exited zero.
- A direct point-of-use reproduction changed high-risk confirmation to false
  after `prepared`; the stale captured confirmation still produced an allowed
  Act and one backend call.
- A direct hostile-result reproduction returned a Proxy whose descriptor trap
  threw `RAW_ADAPTER_SECRET`; the raw value escaped `invokeSchedulerBackend`.
- The offline umbrella gate was not run because the locked
  `@openai/codex-sdk`/`@openai/codex` 0.153.2 package content was unavailable
  locally and network installation was not authorized. This was recorded as
  environment failure/not run, not as a pass or implementation exemption.
- The reviewer found no issue with the exact 50-action vocabulary v7, state
  digest v3, distinct read-only inspect lifecycle, unique scheduled tuple,
  pure package export boundary, test-only Fake, or explicit absence of a
  concrete scheduler adapter/default operation route/real scheduler E2E/support
  claim.

## Findings

### F-A1-EP03E-001 — HIGH — stale confirmation authorizes the Act effect

`mutate` captured the Prepare-time `confirmHighRisk` result and
`executePending` reused it in the later Act transaction without obtaining a
fresh confirmation. Register/remove could therefore call the backend after
confirmation ceased to be current. Closure requires fresh confirmation
immediately before Act, durable no-effect denial on false/throw, zero backend
calls, and register/remove restart/replay tests.

### F-A1-EP03E-002 — MEDIUM — remove Act denial cannot commit no-effect state

The remove denial branch attempted a forbidden `active -> active` registration
update, rolling back the decision, failed intent, finalization, and event. It
left a pending intent that replayed as `PERSISTENCE_FAILURE`. Closure requires
a schema/decoder-consistent no-update denial path with durable terminal replay.

### F-A1-EP03E-003 — MEDIUM — hostile result traps escape the port boundary

Result-envelope discrimination accessed untrusted `.ok`/property descriptors
outside the protected decoder, and `invokeSchedulerBackend` caught only method
invocation. A hostile Proxy could leak raw adapter data and skip the mandatory
bounded observation after a possible effect. Closure requires trap-safe exact
result parsing and direct/application-level Proxy/accessor redaction tests.

### F-A1-EP03E-004 — HIGH — delivery omits current Project revalidation

Scheduled ingress checked configuration/registration rows but not the current
enabled Project or exact resource/config revisions. A disabled or revised
Project could still create a tuple/run. Closure requires revalidation in the
accepting transaction and disable/revision/concurrent-change negatives.

### F-A1-EP03E-005 — HIGH — scheduler source and Manual adapter are conflated

One dispatcher option supplied both inbound scheduler identity and later
`manual-local` execution identity, while the durable dispatcher target was not
bound to a trusted receiver. Closure requires separate scheduler-source and
receiving-target configuration, exact target/source checks, and an end-to-end
scheduled run proving Manual member identity remains unchanged.

### F-A1-EP03E-006 — HIGH — restart orders observations by opaque ID

Readers ordered by `observation_id`, and recovery took the last item even though
only `observationNumber` is monotonic. Reverse-sorting IDs could strand an
`observed` intent behind earlier ambiguous evidence. Closure requires sequence
ordering/selection plus a crash-after-reconciled-observed restart regression.

### F-A1-EP03E-007 — HIGH — receipts may substitute registration identity

Inspect/remove present-state receipts were not required to match the request's
external registration identity, allowing a backend to replace the authoritative
projection. Closure requires persisting and reusing the bound identity, mapping
mismatch to bounded integrity/ambiguity without replacement, and direct plus
reconciliation substitution tests.

### F-A1-EP03E-008 — HIGH — decoder omits Act decision semantics

The combined decoder checked Act stage cardinality but not its actor, action,
scope, grant/revision, result/reason, policy, or temporal semantics. Closure
requires full request/grant lifecycle validation and Act-only corruption tests.

### F-A1-EP03E-009 — MEDIUM — decoder accepts impossible lifecycle projections

The decoder did not fully bind active intent state to registration status,
revision, and `lastIntentId`, nor reapply operation-specific receipt semantics
after digest verification. Closure requires exact lifecycle projection and
receipt-semantic validation, including pending-remove-before-Act, lineage, and
recomputed-digest corruption tests.

### F-A1-EP03E-010 — LOW — high-risk enumeration omits scheduler mutations

The authorization contract's exhaustive high-risk list omitted
`scheduler.register` and `scheduler.remove` despite implementation and later
text requiring them. Closure requires adding both while keeping inspect and
inbound `dispatch.run` separate.

Parent disposition: complete. All findings were independently confirmed. A2 is
required for F-A1-EP03E-001 through F-A1-EP03E-009; the LOW documentation
finding must also be corrected before terminal readiness.
