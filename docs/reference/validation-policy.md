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
| Documentation or governance | Repository documentation gate, authority review, and capability-truthfulness review |
| Domain or state machine | Targeted unit tests plus property/state-machine tests for legal and illegal histories |
| Persistence, schema, migration, backup, or restore | Targeted repository tests, fresh/upgrade/downgrade matrix, concurrent-reader/writer tests, and interruption or corruption recovery |
| Dispatcher, publication, lease, or recovery | Contract tests, competing-worker tests, fencing and CAS tests, and failpoint recovery at every durable transition |
| Adapter or external side effect | Shared adapter contract suite plus E2E on every platform/API combination for which support will be claimed |
| CLI, MCP, or another public interface | Schema and negative-input tests plus application-service parity tests proving there is no second business-rule implementation |
| Authorization, filesystem, secret, privacy, or other security boundary | Authorization tests and the negative-test obligations owned by the [threat model](../security/threat-model.md#negative-test-obligations) |
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

## Current enforcement status

The repository contains an executable toolchain and feasibility harness whose
current entry points are owned by the
[toolchain contract](toolchain-contract.md), plus targeted Domain Core unit,
seeded property/state-machine, and dependency-direction tests. Local lint,
typecheck, build, Node tests, documentation, dependency-shape,
package-consumption, SQLite, and Codex boundary checks can be executed against
a candidate. The committed Windows workflow is a CI skeleton only; hosted
enforcement remains unverified until an actual run is observed. There is still
no product runtime harness for persistence, dispatcher, adapters, scheduler,
MCP, or a support matrix, so those routes remain not implemented and cannot be
claimed as passing.
