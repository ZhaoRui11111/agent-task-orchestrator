# EP-02D independent A2 attempt 1

This immutable read-only audit record is preserved because the reviewed
material state was not closure-safe. Later repairs or A2 attempts do not replace
or rewrite this result.

- Reviewer: `/root/ep02d_a2_closure`
- Reviewed at: `2026-08-31 14:14:24+08:00`
- Approval SHA-256:
  `EE9F8E080D30D29881B3098C5722E6947023059F0C59EE65A11458AA0E67840A`
- Reviewed material state:
  `git-sha1:f20da5e7cd02ba30173a66c6fdc9294bb76dbc73`
- Base and HEAD: `0700d65e9c0db78626aa31baa56f15f009fef41e`
- Result: one MEDIUM finding; not closure-safe.

## Independence and scope

Fresh independent, read-only, non-fail-fast schema-v3 A2. The reviewer did not
participate in EP-02D implementation or repair and made no file, index,
Git/coordinator, ExecPlan, runtime, test-artifact, permission, network, or
external-state mutation.

The review covered the complete repaired material state and all six A1 findings;
repository guidance; the active plan and preserved evidence; authoritative
governance, Domain, authorization, persistence, reliability, adapter,
dispatcher/scheduler, completion/workspace, observability, CLI, toolchain,
versioning, validation, privacy, threat and Git-flow contracts; and the
harness-exec-plan schema-v3 A2 and Tier-2 persistence guidance. Direct source
review covered trusted ownership, dispatcher replay/takeover/fencing, CLI and
product bounds, every-prefix migration, product recovery, source/build/installed
package parity, redaction, compatibility and Phase 3 exclusions.

Fresh read-only trace, scope, state and audit initialization reproduced the
approval digest, exact base and material identity, empty index, exact task scope,
`errors=[]`, `warnings=[]` and all six required A1 closure IDs. `git diff
--check` exited zero. Existing passing validation was corroborating context only;
the reviewer ran no test.

## Finding disposition

F-EP02D-A1-001, F-EP02D-A1-003, F-EP02D-A1-004, F-EP02D-A1-005 and
F-EP02D-A1-006 are closed at the reviewed state. F-EP02D-A1-002 is closed in
implementation and exact 64/65 plus 128/129 tests, but not in the authoritative
CLI contract.

### F-EP02D-A2-001 — MEDIUM

The normative ato.api/v2 bound paragraph in
`docs/reference/cli-contract.md` says every Phase 2 ID, reference and code uses
the 128-byte grammar. That contradicts the approved and implemented 64-byte
limit for `--reason-code` and Manual outcome `--code`.

This finding is confirmed, in scope, changes the task diff and routes to a fresh
A2. The narrow repair must retain the 128-byte grammar for IDs and references,
state the 64-byte execution-code grammar for only those two code fields, preserve
ato.api/v1, ato.execution/v1 and every implementation behavior, rerun relevant
documentation/CLI/full gates, bind the repaired material state and obtain a
fresh independent A2 in the same audit lineage.

No other non-speculative owner, replay, takeover, migration-prefix, recovery,
package-parity, redaction, v1/v2, schema-v7, or Phase 3 boundary defect was found.
