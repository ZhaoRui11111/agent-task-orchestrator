# EP-03F A1 implementation audit — attempt 1

- Reviewer: `/root/ep03d_a0`
- Mode: fresh, independent, read-only, non-fail-fast A1 with the Tier-2 persistence lens
- Reviewed at: `2026-09-05T07:23:30+08:00`
- Reviewed material base/HEAD: `c78b07e9c70f86fcec19feb40c4f2149b82e366a`
- Reviewed state: `git-sha1:b223a78a0e033550d0aab04c2d11631fa1e752a3`
- Approval contract: 52,724 canonical UTF-8 bytes; SHA-256 `B3888468FE1D3735571C413063F71661AE3CC420F78CDA13B9D22BFBA8D5D2BD`
- Readiness: **not ready**
- Findings: 9 HIGH, 3 MEDIUM, 0 LOW; all confirmed, in scope, task-diff-changing, and require fresh A2.

The reviewer did not implement or repair EP-03F and did not modify files, Git/index,
coordinator state, dependencies, credentials, network state, a real Codex account, or an
external Project. The complete task material, authorities, active plan, implementation,
migration, decoder, authorization, dispatcher, SDK, CLI, package, documentation, and
tests were reviewed. The frozen-state trace exited zero with no errors, warnings,
outside-scope paths, overlap, or pre-existing-dirty mismatch. An earlier transient scope
observation occurred while the parent restored an unnecessary scheduler-document edit;
the required rerun was bound to the stable state above and was clean.

Read-only validation evidence:

- `git diff --check`: passed; only line-ending warnings.
- `pnpm lint`: failed deterministically because the source-count invariant remained 60
  while the task inventory is 63.
- `pnpm typecheck`: passed.
- `pnpm docs:check`: passed (169 Markdown files, 268 links, 23 fragments, no forbidden references).
- `pnpm dependency:check`: passed for the exact offline dependency shape
  `@openai/codex-sdk@0.153.2`; this is not an online vulnerability result.
- `pnpm spike:codex`: passed its package/product-composition checks while preserving
  `administratorPolicyAttestation=not_run`, `externalE2E=not_run`, and `supportClaim=false`.
- Build, complete tests, package smoke, and mutable-fixture probes were not run by the
  read-only reviewer. No online audit or real-account E2E was run or claimed.

## Findings

### F-A1-EP03F-001 — HIGH — continuation confirmation bypass

`src/cli-api-runtime.ts`, `src/cli-api-parser.ts`, and
`src/codex-product-application.ts` allow an exact Codex continuation replay with absent
or arbitrary `--confirm`. A terminal/refused operation returns stored output before
confirmation, while an active operation can advance run/member/Task/execution/workspace/
intent state before T6 eventually checks confirmation. After C19 lookup and durable
family discrimination, every Codex continuation invocation must require byte-exact
`INVOKE CODEX CONTINUATION`; Manual must continue rejecting any confirmation. Test
absent/wrong confirmation at terminal, refused, and every active recovery stage with
zero mutation.

### F-A1-EP03F-002 — HIGH — targeted dispatcher owner is not restart-safe

`src/persistence/local-ingress.ts`, `src/codex-product-application.ts`, and
`src/dispatcher-application.ts` bind a targeted run to a process-random dispatcher
owner. Replay neither takes over nor reopens it, while claim/finalization require owner
equality. A restart after T2 or before summary therefore wedges the operation. Use the
existing safe takeover/reopen protocol (or an equivalently approved concurrency-safe
rule), retaining the exact product tuple and grants. Test close/reopen under a new local
ingress after T2, T4, T5, effect, and before summary, plus live-owner refusal.

### F-A1-EP03F-003 — HIGH — T6/pre-journal crash is permanently ambiguous

`src/codex-product-application.ts` and the current crash test leave an `effect_possible`
operation permanently `RECONCILIATION_REQUIRED` when the crash happened before the
backend turn was inserted. The reliability protocol makes absence of the pre-SDK turn
authoritative proof that the SDK boundary was not reached. Under the current fence,
fresh-authorized first-call/no-effect recovery must be possible; a present uncertain
turn remains inspect-only. Add failpoints immediately before and after turn insertion.

### F-A1-EP03F-004 — HIGH — T6 omits required grant-set evidence

The Codex effect-authorization model, schema, writer, and decoder persist only the
`codex.execution.invoke` grant. They do not persist or reconstruct the versioned exact
required-action-set digest and the dispatch/claim/start-or-continuation/workspace
conjunction. Persist the digest and each conjunct linkage/evaluation at T6 trusted time;
have the decoder reconstruct it and reject every missing, stale, or substituted conjunct.

### F-A1-EP03F-005 — HIGH — terminal result/core Act decoder is not semantic

`src/persistence/application-repository-state.ts` accepts open-ended failure codes and
mostly shape-checks success values. It does not reconstruct every public field from the
run/member/Task/execution/workspace/intent/observation rows, nor prove that the product
Act is the exact current core Act consumer with no later contradiction. Share one exact
semantic decoder with runtime replay validation and add surgical corruption cases for
every relationship.

### F-A1-EP03F-006 — HIGH — Codex home is not disjoint from all workspaces

`src/codex-product-configuration.ts` supports an `existingWorkspacePaths` input, but all
production calls omit it and persisted workspace generations lack a reconstructable
canonical path inventory. Bind current and historical workspace path/root identities to
activation and effect-time use, failing closed when global physical disjointness cannot
be proved. Cover nested roots, historical generations, and aliases.

### F-A1-EP03F-007 — HIGH — confirmation races reuse stale actor/time

Profile activate/deactivate and start/continuation T1 evaluate and retain trusted context
before interactive confirmation, then reuse it in the writer transaction. Reacquire
actor/principal/runtime and time immediately after confirmation, require continuity,
and evaluate/persist against the refreshed context. Test actor change, grant expiry, and
revocation during confirmation with zero mutation.

### F-A1-EP03F-008 — HIGH — historical observation depends on live Codex home

Public inspect/cancel fully revalidate the current Codex-home directory even though the
backend observation uses only durable journal/workspace evidence. A deactivated profile
whose home is unavailable or structurally changed can become unrecoverable. Separate
effect-time configuration checks from historical observation-time binding and test
unavailable, substituted, and changed homes with zero credential/model calls.

### F-A1-EP03F-009 — HIGH — profile authorization/lifecycle history is incomplete

The profile schema and decoder do not reconstruct one initial activation, exact creator/
actor/configuration/status linkage, or a contiguous alternating activation/deactivation
revision chain. Persist the missing reconstructable relation and make SQL nullability
match the result vocabulary. Reject missing, duplicate, substituted, skipped, or
impossible profile histories before writable use.

### F-A1-EP03F-010 — MEDIUM — duplicate `thread.started` is accepted

`src/codex-sdk-worker.ts` accepts a second identical `thread.started` before the turn.
Track whether the event was observed independently from a preloaded resume ID and reject
every duplicate, equal or changed, for start and resume.

### F-A1-EP03F-011 — MEDIUM — adapter/config failures become credential failures

The driver factories collapse resolver, profile/root/configuration, and constructor
exceptions to `null`; the backend then records all of them as credential unavailable.
Use a bounded redacted discriminated preparation result (or an equivalently exact
boundary) so credential absence, identity/config drift, and constructor/adapter failure
retain truthful public/durable taxonomy. Test throwing resolver/constructor and drift.

### F-A1-EP03F-012 — MEDIUM — lint source inventory is stale

`scripts/lint.mjs` still expects 60 production sources while the frozen repository
inventory and architecture test expect 63. Update the sole strict invariant consistently
and rerun lint plus the complete exact-head offline gate.

## Validation disposition

V1, V2, and static parts of V12/V13 passed the independent inspection. V3–V11,
V14–V17 are blocked by the findings above; V8 has a happy-path implementation but is
not restart-acceptable. V15/V16 fail at lint. The 37-command/41-error inventory,
package-private seam, Manual/scheduler noncomposition, completion separation, redaction
direction, and no-support/no-real-E2E claims otherwise remain intact. All twelve findings
are parent-confirmed, in scope, and require repair plus fresh independent A2.
