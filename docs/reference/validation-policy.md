# Validation policy

This file is the sole owner of validation impact routing, binary evidence
records, and repository gates. Contracts and threat models define the behavior
or abuse case to validate; this policy decides the validation route and what
counts as evidence.

Validation is selected by impact rather than by a single fixed command. A
successful narrow check does not waive another applicable route.

## Impact routes

| Impact | Required route when that surface exists |
| --- | --- |
| Documentation or governance | Repository documentation gate, including exact-case local targets and same-file/cross-file fragments, plus authority review and capability-truthfulness review |
| Domain or state machine | Targeted unit tests plus property/state-machine tests for legal and illegal histories |
| ProjectRegistry or application service | Canonical path/identity and revision negatives, typed command/query parity with Domain, accepted/denied atomicity, restart readback, concurrent writers, injected failure, and public-boundary tests |
| Persistence, schema, migration, backup, restore, or doctor | Targeted repository tests, exact fresh-baseline and incompatible/noncurrent refusal matrix, canonical migration identity from uniform LF and CRLF transports, malformed/mixed-EOL pre-mutation refusal, concurrent-reader/writer tests, read-only diagnostic tests, and interruption or corruption recovery |
| Dispatcher, workspace lifecycle, publication, lease, or recovery | Contract tests, competing-worker tests, fencing and CAS tests, and failpoint recovery at every durable transition |
| Adapter or external side effect | Shared adapter contract suite plus E2E on every platform/API combination for which support will be claimed |
| CLI, MCP, or another public interface | Schema and negative-input tests plus application-service parity tests proving there is no second business-rule implementation |
| Authorization, filesystem, secret, privacy, or other security boundary | Authorization tests and the negative-test obligations owned by the [threat model](../security/threat-model.md#negative-test-obligations) |
| Repository task-artifact, test-residue, or prune authorization policy | Exact manifest/schema/ignore/tracked-overlap and standing-grant tests; deterministic single-`mkdir`/`EEXIST`, disappearance, root replacement, immediately bound generation replacement with both original and replacement bytes preserved, generation-only cleanup, fixed-root empty/nonempty, and injected removal-error transitions plus multi-process stress; a creator paused after root inspection must still succeed after nested SQLite proves it deferred fixed-root contraction; success-only path-based baseline addition/removal/replacement, parent global-quiescent fixed-root contraction from an absent baseline, failed-diagnostic retention, native recursive discovery, and unowned inherited-test-context refusal; creator-root containment and static Windows reparse negatives that explicitly do not promote the wrapper to a security boundary and distinguish its refusal from coordinator anchored alias unlink; standalone package/SQLite exact-root absence and reclaim-error propagation; then a fresh manifest-backed coordinator task proving partial-prune retry semantics when applicable, head-bound receipt, and root absence |
| Compatibility or support claim | Migration/contract evidence and an exact environment record meeting the [versioning and compatibility contract](versioning-compatibility-contract.md#evidence-bound-support-claims) |
| Cross-cutting or high risk | Every applicable targeted route followed by the full available repository gate |

When a route cannot run because its implementation, environment, account,
secret, or permission does not exist, its result is not passed. Record it as
not run with the missing prerequisite and do not make the dependent capability
or support claim.

## Binary evidence record

Every reported gate has one result: `passed`, `failed`, or `not_applicable`.
An omitted or blocked gate is not a passing result. Each record contains:

- the exact criterion and expected binary outcome;
- the Git commit or material-state identity to which the result applies;
- the exact command or manual procedure, including relevant working directory;
- the material environment dimensions needed to reproduce the result;
- the actual exit status and concise observed result;
- paths or identifiers for durable evidence, with sensitive content excluded;
- the reviewer or runner and observation time; and
- every applicable gate not run, its reason, its impact, and the action needed
  to run it.

Evidence becomes stale when its bound material state changes, or when a support
claim's material environment no longer matches. Manual review must identify the
reviewed files and criterion; an assertion such as "looks good" is not binary
evidence.

## Repository documentation gate

A documentation or governance change passes only when all applicable items
below pass against the candidate inventory:

- Every repository-relative Markdown link resolves to an existing committed or
  staged regular file. A directory, ignored local artifact, URL substitute, or
  case-mismatched path on a case-sensitive target does not satisfy the gate.
- A manual authority review finds one owner for every changed normative rule
  and no conflicting copy in an ADR, plan, example, evidence matrix, or entry
  point.
- A manual capability review finds no planned runtime, adapter, platform,
  security control, CI, test, integration, or support target described as
  implemented or supported without matching current evidence.
- `git diff --check` exits successfully for the complete candidate diff.
- The staged inventory contains only declared task-owned paths, including every
  intended new file and excluding every out-of-scope path.
- The staged inventory contains no runtime database, WAL/SHM file, log, backup,
  diagnostic bundle, workspace/worktree data, local project data, ignored
  planning artifact, credential-shaped file, or secret.
- Any pre-existing overlapping change has an explicit ownership receipt and is
  preserved or deliberately incorporated exactly as authorized.

The final inventory check occurs after staging and before the terminal commit.
A clean unstaged check cannot substitute for that staged-inventory result.

The optional maintainer doc-gardener reads the strict repository-local
`.doc-gardener.json`. Its additive exclusions are exactly `.local/**`,
`.worktrees/**`, `node_modules/**`, `dist/**`, and `.pnpm-store/**`; its only
explicit document role classifies `docs/plans/completed/**/*.md` and
`docs/plans/evidence/**/*.md` as historical evidence. It adds no ignore rule
for tracked repository documentation, leaves every unmatched tracked document
live-derived, and does not replace the repository documentation gate or create
a public dependency on a private skill. A maintainer report must expose
effective policy identity, roles, selection/coverage, issues, review
candidates, and unverified gaps; exit zero alone is not semantic freshness
proof.

## Current enforcement status

The repository contains an executable toolchain and feasibility harness whose
current entry points are owned by the
[toolchain contract](toolchain-contract.md), targeted Domain Core unit/seeded
state-machine/dependency-direction tests, ProjectRegistry path/identity tests,
finite authorization and application Domain-parity/atomicity tests, and
targeted persistence tests for the sole current schema-version-1 baseline,
incompatible/noncurrent refusal before mutation, its frozen canonical checksum
from LF and CRLF checkout transports, malformed
migration-source refusal before SQLite mutation, exact combined repository
mapping, concurrent reader/writer behavior, runtime-root negatives, lifecycle
authorization, backup, restore, read-only doctor, typed corruption, and
failpoint recovery. The typed execution owners add explicit no-auto-upgrade,
atomic claim, shared port-contract, real Manual journal, exact idempotency,
competing writer, lost-response, every-stage crash/restart, independent inspect,
verified-not-finalized, ambiguity, completion separation, reconciliation,
higher-fence continuation, stale-fence, corruption, and redaction evidence. The
dispatcher adds trigger/authorization atomicity, bounded
heartbeat/takeover, reconcile-before-seal ordering, immutable membership,
claim/start-intent atomicity, competing-worker, every-checkpoint restart,
summary completeness, corruption, and bounded-redaction evidence. The product CLI has strict
schema/boundary, security-negative, application-parity, source/build/installed
parity, end-to-end restart, current-v1 dispatch/inspect/resume/retry/cancel/
Manual-report/completion, typed product-facade derivation, and human/JSON
redaction test surfaces. Local lint,
typecheck, build, Node tests, documentation,
dependency-shape, package-consumption, SQLite, and Codex boundary checks can be
executed against a candidate when the frozen local dependency is installed.
The committed Windows workflow is a CI skeleton only; hosted enforcement
remains unverified until an actual run is observed. The Phase 1 application,
authorization, persistence lifecycle, product CLI, claim foundation, local
Manual-loop, explicit-Manual dispatcher, and sole current `ato.api/v1` product routes
are implemented test surfaces. The workspace foundation adds an exact pure-port
hostile-shape suite, generation/idempotency/concurrency tests, authorization and
cleanup-confirmation negatives, writer-boundary static analysis, every-write-
seam rollback, SQLite close/reopen at prepare/execute/observe/verify/finalize,
response-loss and ambiguity recovery, stale revision/fence refusal, combined
decoder corruption, redaction, and package-export evidence. The exported,
product-unwired Windows Git backend additionally has exact-host contract,
closed-command/environment, hostile-tree/path/reparse, direct-exclusive
manifest, response-loss, SQLite restart, and create/inspect/recover E2E tests;
cleanup is verified as an unconditional policy denial. This is implementation
evidence, not a platform-support claim. There is still no SchedulerBackend or
scheduled trigger, MCP, production Codex adapter, product-wired Git/filesystem
workspace route, ProjectPolicy,
CompletionBackend/gate, or support-matrix harness, so
those routes remain unimplemented and cannot be claimed as passing. Repository task-artifact checks cover only
maintainer workflow scratch and do not count as product persistence or
destructive-action support.
