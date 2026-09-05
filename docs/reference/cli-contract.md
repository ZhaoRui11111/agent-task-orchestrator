# CLI and API contract

## Status and authority

This file is the sole normative owner of the implemented local `ato` command
tree, argument grammar, confirmation phrases, sole current `ato.api/v1` output,
public error codes, and process exit codes. The CLI is an interface owner. It
does not own Project, Task, dependency, authorization, migration, backup,
restore, or doctor judgments.

Every Project, Task, dependency, grant, status, and policy operation invokes the
typed application service. Backup and restore consume the application service's
typed lifecycle authorization and then invoke the persistence lifecycle owner.
Doctor invokes the persistence-owned read-only classifier. Phase 2 and Codex
commands invoke typed product owners, which derive non-public durable tuples and
call the existing dispatcher, workspace, or reliable execution owners. The CLI does not open
SQLite, parse SQL, copy Domain rules, inspect arbitrary files, or accept an actor
or authority from command content.

The stable `src/cli-api.ts` interface facade contains explicit exports only.
Its physical model, parser, presentation, and runtime modules do not create new
business owners: the parser owns pure grammar and pre-effect refusal, the
presentation module owns bounded public mapping/rendering, and the runtime
module alone selects trusted local ingress, opens/closes the product runtime,
and performs a parsed command. `src/cli.ts` remains the byte-stable console
entrypoint and contains no product judgment.

This is a local single-user surface, not a released compatibility or
platform-support promise. The sole current `ato.api/v1` exposes the local
explicit-Manual control/recovery subset plus the closed authorized Codex subset
documented below. It exposes no scheduler, scheduled trigger, daemon, MCP, or Phase 3 adapter route,
workspace/policy/gate/integration operation command, network service, secret
operation, release, deployment, repair, cleanup, or arbitrary shell/filesystem
operation. The independently exported injected Phase 3 and scheduler libraries
do not extend this command tree.

## Invocation and global grammar

The package binary is `ato`. Source and build-tree development invocations use
`node src/cli.ts` and `node dist/cli.js`; packed installation exposes the same
binary and contract.

Global options are optional leading name/value pairs and may appear only before
the command:

| Option | Values | Default |
| --- | --- | --- |
| `--format` | exactly `human` or `json` | `human` |
| `--api-version` | exactly `ato.api/v1` | `ato.api/v1` |
| `--runtime-root` | a bounded absolute trusted local runtime root | the trusted per-user application-data root |

Each global may occur at most once. Options use two tokens; `--name=value`,
short options, aliases, response files, positionals, globals after the command,
unknown fields, repeated fields, and missing or extra values are invalid. One
invocation has at most 64 arguments and 32,768 total UTF-8 bytes. Every token is
well-formed NFC Unicode and contains no Unicode control or format character.

An explicit runtime root is at most 1,024 UTF-8 bytes and must be the exact
trusted per-user application-data root or one direct child. The root is derived
from the OS account home, not `HOME`, `USERPROFILE`, `LOCALAPPDATA`, or another
environment value. The persistence path owner then applies canonical identity,
no-reparse, source/Project non-overlap, and descendant ownership checks. A
Windows package-virtualized mapping is accepted only by this local-ingress path
when both logical and resolved roots remain under that same OS account home;
other aliases fail closed. Environment or command content cannot select a
different trust root or a lifecycle descendant.

## Command tree

The sole current `ato.api/v1` contains exactly 37 command IDs. The following
table contains its 24 base and lifecycle IDs; the thirteen product-facade IDs are
listed in [Current product commands](#current-product-commands).
Required options are shown without brackets; bracketed options are optional.

| Command ID | Invocation after globals |
| --- | --- |
| `doctor` | `doctor` |
| `status` | `status` |
| `init` | `init --expires-at TIME --confirm "INITIALIZE LOCAL RUNTIME"` |
| `authorization.renew` | `authorization renew --expires-at TIME --confirm "RENEW LOCAL CAPABILITIES"` |
| `authorization.list` | `authorization list --limit N [--after-grant-id ID]` |
| `authorization.show` | `authorization show --grant-id ID --expected-grant-revision REV` |
| `authorization.issue` | `authorization issue --action ACTION --scope runtime --not-before TIME --expires-at TIME --confirm "ISSUE LOCAL GRANT"` |
| `authorization.issue` | `authorization issue --action ACTION --scope project --project-id ID --expected-resource-revision REV --expected-config-revision REV --not-before TIME --expires-at TIME --confirm "ISSUE LOCAL GRANT"` |
| `authorization.revoke` | `authorization revoke --grant-id ID --expected-grant-revision REV --confirm "REVOKE LOCAL GRANT"` |
| `authorization.evaluate` | `authorization evaluate --project-id ID --expected-resource-revision REV --expected-config-revision REV --action ACTION` |
| `project.register` | `project register --project-id ID --root PATH --confirm "REGISTER LOCAL PROJECT"` |
| `project.show` | `project show --project-id ID --expected-resource-revision REV` |
| `project.update` | `project update --project-id ID --expected-resource-revision REV --expected-config-revision REV --confirm "UPDATE LOCAL PROJECT"` |
| `project.disable` | `project disable --project-id ID --expected-resource-revision REV --expected-config-revision REV --confirm "DISABLE LOCAL PROJECT"` |
| `task.create` | `task create --project-id ID --expected-project-resource-revision REV --task-id ID --body TEXT [--supersedes-task-id ID]` |
| `task.show` | `task show --project-id ID --expected-project-resource-revision REV --task-id ID --expected-task-revision REV` |
| `task.update-body` | `task update-body --project-id ID --expected-project-resource-revision REV --task-id ID --expected-task-revision REV --body TEXT` |
| `task.set-parent` | `task set-parent --project-id ID --expected-project-resource-revision REV --task-id ID --expected-task-revision REV --parent-id ID` |
| `task.clear-parent` | `task clear-parent --project-id ID --expected-project-resource-revision REV --task-id ID --expected-task-revision REV` |
| `task.mark-ready` | `task mark-ready --project-id ID --expected-project-resource-revision REV --task-id ID --expected-task-revision REV` |
| `task.cancel` | `task cancel --project-id ID --expected-project-resource-revision REV --task-id ID --expected-task-revision REV --reason TEXT` |
| `dependency.add` | `dependency add --project-id ID --expected-project-resource-revision REV --task-id ID --expected-task-revision REV --dependency-id ID --expected-dependency-revision REV` |
| `dependency.remove` | `dependency remove --project-id ID --expected-project-resource-revision REV --task-id ID --expected-task-revision REV --dependency-id ID --expected-dependency-revision REV` |
| `backup.create` | `backup create` |
| `restore` | `restore --generation-id UUID --confirm "RESTORE LOCAL BACKUP" --acknowledge-data-loss "DISCARD CURRENT LOCAL DATA"` |

There is no alias for a command or option. In particular there is no Task
`running` or `completed` command.

## Typed bounds

- Project and Task-family IDs are 1 through 128 UTF-8 bytes after the global NFC
  and control-character rules.
- Grant IDs and cursors match `[A-Za-z0-9][A-Za-z0-9._:-]{0,127}`.
- Backup generation IDs are lowercase RFC 4122 version-4 UUIDs.
- Revisions are canonical positive safe decimal integers: no sign, leading zero,
  exponent, fraction, coercion, or value above JavaScript's safe-integer range.
- Times are canonical UTC strings reproduced exactly by `Date#toISOString`.
  Initialization expiry is after current trusted time and no more than 31 days
  later. Renewal expiry is more than 7 and no more than 31 days later. Delegated
  grant `not-before` is not earlier than current trusted time and precedes expiry;
  the authorization owner applies the stricter source-grant bound.
- `authorization list --limit` is a canonical safe decimal integer in `1..100`.
  A canonical integer outside that interval is `RESULT_LIMIT_EXCEEDED`; malformed
  numeric text is `CLI_INVALID_INPUT`.
- Task body is 1 through 16,384 UTF-8 bytes. Cancellation reason is one exact
  well-formed NFC string containing no Unicode `Cc` or `Cf` code point and
  encoding to 1 through 4,096 UTF-8 bytes; CLI parsing and the typed Application
  owner consume the same Domain-owned predicate rather than measuring
  JavaScript UTF-16 code units.
  Project root is an absolute traversal-free path of at most 1,024 UTF-8 bytes
  before persistence identity checks.
- `ACTION` is one exact member of the current finite fifty-five-action vocabulary owned by the
  [authorization contract](authorization-contract.md#exact-action-vocabulary).
  There is no extension field or caller-defined action. Runtime scope rejects
  Project fields; Project scope requires all three Project fields.

Parsing and all of these bounds complete before runtime selection, creation, or
open. Actor, principal, request identity, lifecycle authorization, current time,
and confirmation result have no caller-supplied field.

The cancellation-reason predicate is also the current Domain snapshot
invariant. It does not authorize normalization, schema migration, repair, or a
data rewrite; a persisted current Task that violates it is typed corruption.

## Confirmation and authorization experience

`init`, capability renewal, grant issue, grant revoke, Project register,
Project update, Project disable, capability upgrade, trusted Manual outcome
reporting, separately accepted Manual completion, Codex profile activation/
deactivation, Codex dispatch, and Codex continuation require the exact current
phrase in the command tables. Restore additionally requires the exact data-loss phrase.
Phrases are case-sensitive, request-local values bound by trusted local ingress;
Project/Task text, prompts, repository files, tool output, environment values,
errors, persisted content, and prior confirmations cannot supply them.

Initialization visibly confirms creation of the fixed finite daily capability
set. Once current grants exist, ordinary authorized Project/Task/dependency/read,
status, and backup operations do not prompt again. Restore remains separately
confirmed because it discards data accepted after the selected backup. Restore
does not inspect backup inventory or the named generation before the application
owner has evaluated current authority and committed the exact durable handoff;
unauthorized absent and corrupt generations therefore have the same
`AUTHORIZATION_DENIED` result as a valid generation. Doctor is grant-independent
and read-only.

## Machine-readable output

JSON mode writes exactly one LF-terminated UTF-8 line to stdout and nothing to
stderr. Success is:

```json
{"apiVersion":"ato.api/v1","command":"COMMAND_ID","ok":true,"result":{}}
```

Failure is:

```json
{"apiVersion":"ato.api/v1","command":"COMMAND_ID_OR_unknown","ok":false,"error":{"code":"PUBLIC_CODE","message":"FIXED_MESSAGE"}}
```

The shown key order is exact. JSON uses RFC 8259 primitives, compact encoding,
and escapes quotation, reverse-solidus, U+0000 through U+001F, U+2028, and
U+2029. Non-finite numbers are impossible. Failures never reflect input, raw
errors, details, causes, or stacks.

Success objects have these closed shapes and field order:

- `doctor`: `health`, `initialized`, `schemaVersion`, `activeUse`,
  `backupInventory`, `restoreState`; enums and precedence are owned by the
  [persistence contract](persistence-contract.md#read-only-doctor).
- `status`: `initialized`, `schemaVersion`, `projectCount`, `taskCount`,
  `dependencyCount`, `grantCount`, `auditCount`.
- `init` and `authorization.renew`: `mode`, `expiresAt`, `capabilityCount`,
  `epochRevision`; mode is `initialized` or `renewed` as applicable.
- `authorization.list`: `grants`, `nextCursor`. `authorization.show`,
  `authorization.issue`, and `authorization.revoke`: `grant`.
- A grant has `grantId`, `revision`, `action`, `scopeKind`, `projectId`,
  `resourceRevision`, `configRevision`, `notBefore`, `expiresAt`, `status`;
  status is `revoked`, `not_yet_valid`, `expired`, or `active` in that precedence.
- `authorization.evaluate`: `action`, `policy`, `projectId`, `resourceRevision`.
- Every Project command: `projectId`, `enabled`, `configRevision`,
  `resourceRevision`. This complete public projection is produced by the
  application owner's terminal transaction and serialized directly; the CLI
  performs no second registry/Domain read or cross-owner interpretation.
- Every Task/dependency command: `projectId`, `taskId`, `status`, `revision`,
  `parentId`, `dependencyIds`, `supersedesTaskId`.
- `backup.create`: `generationId`, `kind`, `sourceSchemaVersion`, `createdAt`,
  `verified`.
- `restore`: `backupGenerationId`, `targetSchemaVersion`, `restoredAt`,
  `dataLossAcknowledged`.
- `codex.profile.activate`, `codex.profile.inspect`, and
  `codex.profile.deactivate`: `profileId`, `projectId`,
  `projectResourceRevision`, `projectConfigRevision`, `profileRevision`,
  `status`, `destination`, `credentialConfigured`, `configurationSha256`,
  `replayed`.
- `codex.dispatch-run`: `runId`, `status`, `memberId`, `profileId`,
  `profileRevision`, `destination`, `baseReference`, `taskId`, `taskState`,
  `taskRevision`, `executionId`, `executionRevision`, `attemptNumber`,
  `fencingToken`, `workspaceId`, `workspaceGeneration`, `workspaceRevision`,
  `workspaceStatus`, `lifecycle`, `replayed`.

Task body, cancellation reason, Project/runtime path or filesystem identity,
actor/principal, request/correlation/decision/audit/lifecycle/restore identifier,
state digest, secret, environment value, raw SQL/page/error, and unclassified
content are never serialized. Operational Project, Task, grant, and backup IDs
needed for the requested local workflow remain bounded output.

Grant listing contains only the current bound actor's grants, ordered by binary
`grantId`, strictly after the optional cursor, with at most `limit` entries.
`nextCursor` is the last returned ID only when another matching entry exists.

## Human-readable output

Human mode also writes one LF-terminated UTF-8 line to stdout and nothing to
stderr. Success is `OK COMMAND_ID key=<compact-json-value> ...` in the same field
order as JSON. Failure is
`ERROR COMMAND_ID code="PUBLIC_CODE" message="FIXED_MESSAGE"`. There is one ASCII
space between fields, strings remain JSON-quoted and escaped, null is `null`, and
arrays/objects are compact JSON. There is no ANSI formatting or interactive
prompt.

## Public errors and exit codes

The following table is exhaustive. Exit `0` is success only.

| Exit | Code | Fixed message |
| --- | --- | --- |
| 2 | `CLI_INVALID_INPUT` | `The command input is invalid.` |
| 2 | `CLI_UNSUPPORTED_VERSION` | `The requested API version is unsupported.` |
| 3 | `RUNTIME_NOT_INITIALIZED` | `The local runtime is not initialized.` |
| 3 | `RUNTIME_ALREADY_INITIALIZED` | `The local runtime is already initialized.` |
| 3 | `CAPABILITY_RENEWAL_NOT_DUE` | `Local capabilities are not eligible for renewal.` |
| 4 | `AUTHORIZATION_DENIED` | `Current explicit authorization denied the operation.` |
| 4 | `CONFIRMATION_REQUIRED` | `The exact current confirmation is required.` |
| 4 | `SCOPE_EXPANSION_DENIED` | `The requested authorization scope exceeds current authority.` |
| 5 | `PROJECT_NOT_FOUND` | `The Project was not found.` |
| 5 | `TASK_NOT_FOUND` | `The Task was not found.` |
| 5 | `GRANT_NOT_FOUND` | `The grant was not found.` |
| 5 | `BACKUP_NOT_FOUND` | `The backup generation was not found.` |
| 5 | `EXECUTION_NOT_FOUND` | `The execution was not found.` |
| 5 | `DISPATCH_RUN_NOT_FOUND` | `The dispatcher run was not found.` |
| 5 | `CODEX_PROFILE_NOT_FOUND` | `The Codex profile was not found.` |
| 6 | `STALE_REVISION` | `The expected revision is stale.` |
| 6 | `DOMAIN_REJECTED` | `The requested Task operation was rejected.` |
| 6 | `PROJECT_ALREADY_REGISTERED` | `The Project is already registered.` |
| 6 | `PROJECT_REGISTRY_REJECTED` | `The Project registry rejected the operation.` |
| 6 | `RESULT_LIMIT_EXCEEDED` | `The requested result limit is invalid.` |
| 6 | `OPERATION_CONFLICT` | `The operation conflicts with current state.` |
| 6 | `STALE_FENCE` | `The execution or dispatcher ownership fence is stale.` |
| 6 | `LEASE_EXPIRED` | `The execution or dispatcher lease has expired.` |
| 6 | `RECONCILIATION_REQUIRED` | `Durable reconciliation is required before the operation can continue.` |
| 6 | `CODEX_PROFILE_INACTIVE` | `The Codex profile is not active.` |
| 7 | `RUNTIME_UNSAFE` | `The local runtime identity or topology is unsafe.` |
| 7 | `RUNTIME_ACTIVE` | `The local runtime is active.` |
| 7 | `SCHEMA_UNSUPPORTED` | `The runtime schema is unsupported.` |
| 7 | `MIGRATION_INVALID` | `The runtime migration history is invalid.` |
| 7 | `STATE_CORRUPT` | `The runtime state is corrupt.` |
| 7 | `BACKUP_INVALID` | `The backup generation is invalid.` |
| 7 | `PERSISTENCE_UNAVAILABLE` | `Local persistence is unavailable.` |
| 7 | `ADAPTER_FAILURE` | `The Manual execution adapter failed.` |
| 7 | `CODEX_CREDENTIAL_UNAVAILABLE` | `The configured Codex credential is unavailable.` |
| 7 | `CODEX_ADAPTER_FAILURE` | `The Codex execution adapter failed.` |
| 8 | `DATA_LOSS_ACK_REQUIRED` | `The exact data-loss acknowledgement is required.` |
| 8 | `RESTORE_CONFLICT` | `Restore conflicts with current state.` |
| 8 | `RESTORE_BLOCKED` | `Restore is blocked.` |
| 8 | `RESTORE_RECOVERY_REQUIRED` | `Restore requires manual recovery.` |
| 8 | `AMBIGUOUS_EXTERNAL_STATE` | `The external execution state is ambiguous.` |
| 9 | `INTERNAL_ERROR` | `The operation failed internally.` |

Parser failures select format deterministically from valid leading global pairs.
An unsupported API major is rejected before application evaluation. The mapper
is exhaustive over typed application and persistence failures; any unclassified
or impossible value becomes `INTERNAL_ERROR`, and internal text is discarded.

## Capability boundary

`ato.api/v1` is provisional and implemented only by this local development
package. It does not create a release or support claim. The current tree retains
the closed local explicit-Manual Phase 2 product and adds one explicit Codex
route that may disclose Task content only after its profile, workspace,
authorization, confirmation, and Act boundary. Unknown fields remain rejected;
changing a field's meaning, requiredness, error meaning, authorization, or state
effect after this unreleased baseline requires a new API major under the
[versioning contract](versioning-compatibility-contract.md#public-api-evolution).
`task.cancel` cannot bypass an active execution or act as verified interruption;
the dedicated cancellation route retains request/observation/finalization rules.

## Current product commands

The following thirteen product-facade IDs complete the sole current 37-command
`ato.api/v1` tree. Omitting `--api-version` and passing the exact pair
`--api-version ato.api/v1` are identical. A retired `ato.api/v2` or any other
unsupported major for a recognized command returns `CLI_UNSUPPORTED_VERSION`
in an `ato.api/v1` failure envelope before runtime-root selection, trusted
ingress, doctor, runtime creation/loading, persistence, authorization, or Domain
evaluation. Unknown majors and commands never fall back, coerce, or guess
another major. `authorization issue` and `authorization evaluate` accept exactly
the current finite fifty-five actions. The independently exported exact
`ato.project-policy/v1`, `ato.completion/v1`, `ato.integration/v1`, and
`ato.workspace/v2` ports, their local adapters, and the injected Phase 3
product-library facade add no command ID, public result, or error to this closed
tree. The independently exported exact `ato.scheduler/v1` port and injected
scheduler application owner likewise add no scheduler operation route.

The thirteen product-facade IDs are exhaustive:

| Command ID | Invocation after globals |
| --- | --- |
| `authorization.upgrade` | `authorization upgrade --expires-at TIME --confirm "UPGRADE LOCAL CAPABILITIES"` |
| `dispatch.run` | `dispatch run --idempotency-key ID --lease-duration-seconds N` |
| `dispatch.resume` | `dispatch resume --run-id ID` |
| `execution.inspect` | `execution inspect COMMON` |
| `execution.resume` | `execution resume COMMON --continuation-reference ID --required-action-receipt-id ID [--confirm "INVOKE CODEX CONTINUATION"]` |
| `execution.retry` | `execution retry COMMON --continuation-reference ID --required-action-receipt-id ID [--confirm "INVOKE CODEX CONTINUATION"]` |
| `execution.request-cancel` | `execution request-cancel COMMON --reason-code ID` |
| `manual.outcome-report` | `manual outcome-report COMMON --report-id ID --outcome OP --code ID [--evidence-reference ID] --confirm "RECORD MANUAL OUTCOME"` |
| `execution.accept-manual-completion` | `execution accept-manual-completion COMMON --confirm "ACCEPT MANUAL COMPLETION"` |
| `codex.profile.activate` | `codex profile activate --project-id ID --expected-project-resource-revision REV --expected-project-config-revision REV --profile-id ID --expected-profile-revision REV0 --workspace-root-key ID --workspace-root PATH --codex-home-key ID --codex-home PATH --git-executable PATH --idempotency-key ID --confirm "ACTIVATE CODEX PROFILE"` |
| `codex.profile.inspect` | `codex profile inspect --project-id ID --expected-project-resource-revision REV --expected-project-config-revision REV --profile-id ID --expected-profile-revision REV` |
| `codex.profile.deactivate` | `codex profile deactivate --project-id ID --expected-project-resource-revision REV --expected-project-config-revision REV --profile-id ID --expected-profile-revision REV --idempotency-key ID --confirm "DEACTIVATE CODEX PROFILE"` |
| `codex.dispatch-run` | `codex dispatch-run --project-id ID --expected-project-resource-revision REV --expected-project-config-revision REV --profile-id ID --expected-profile-revision REV --task-id ID --expected-task-revision REV --base-reference SHA1 --idempotency-key ID --lease-duration-seconds N --confirm "INVOKE CODEX TASK"` |

`COMMON` is exactly, in any option order after the command:

```text
--project-id ID
--expected-project-resource-revision REV
--expected-project-config-revision REV
--task-id ID
--expected-task-revision REV
--execution-id ID
--expected-execution-revision REV
--expected-attempt-number REV
--expected-fencing-token REV
--idempotency-key ID
```

Every current product ID and reference is ASCII
`[A-Za-z0-9][A-Za-z0-9._:-]{0,127}`. The `--reason-code` and Manual outcome
`--code` values use the closed execution-code bound
`[A-Za-z0-9][A-Za-z0-9._:-]{0,63}`. `REV` is a canonical positive safe integer.
`REV0` is zero only for a first profile activation and otherwise is a positive
safe integer naming the current deactivated revision. Profile IDs,
workspace-root keys, Codex-home keys, and all other product IDs use the same
1..128 ASCII operational bound. `PATH` in the Codex commands is absolute NFC,
control-free, and at most 4,096 UTF-8 bytes before identity inspection. `SHA1`
is exactly lowercase 40-hex. `N` is a canonical whole safe integer from `30` through `3600`.
`OP` is exactly `activate`, `wait`, `succeed`, `fail`, or
`confirm_cancelled`. Upgrade `TIME` is canonical UTC, strictly more than seven
and no more than thirty-one days after the trusted current time. There are no
aliases, implicit fields, alternate confirmation phrases, or extension maps.
The optional continuation confirmation must be absent for Manual and must equal
`INVOKE CODEX CONTINUATION` for Codex as determined from durable state.

### Product-command ownership and effects

The current OS/runtime ingress alone supplies actor, principal, runtime-root
identity, Manual dispatcher owner, and execution lease owner. Command text
cannot supply them. `authorization.upgrade` performs exactly one eligible,
confirmed contiguous vocabulary transition (`1` to `2`, `2` to `3`, `3` to
`4`, `4` to `5`, `5` to `6`, `6` to `7`, or `7` to `8`) and never dispatches work. Migration and renewal never upgrade a
vocabulary.

The product facade reads the current schema-version-1 state, validates the complete
caller CAS tuple, derives backend/thread/input/policy/deadline/observation,
receipt, and finalization data, then invokes the existing owner. `dispatch.run`
and `dispatch.resume` invoke only the reconcile-first Manual dispatcher; the
CLI never enumerates candidates or computes completeness. Execution operations
invoke the Manual or Codex reliable owner only after durable backend
discrimination. After hostile parsing and trusted actor/runtime validation,
resume/retry first lookup the exact Codex product idempotency tuple before live
profile/Task/execution reads and before Manual fallback. Exact match resumes the
recorded stage; mismatch is `OPERATION_CONFLICT`; absence alone permits ordinary
backend discrimination. `codex.dispatch-run` creates exactly one targeted
member and never changes Manual or scheduled candidate selection. An exact
terminal replay returns only the stored bounded result without another effect.

Profile activation/inspection/deactivation expose no credential value, path,
filesystem identity, constructor internals, or administrator-policy claim.
Codex dispatch persists Prepare before checking credential availability and
binds a fresh confirmed Act to the exact pending intent before credential
resolution or Task disclosure. Its fixed destination is `openai-codex-api` and
the only credential reference is `process-env:CODEX_API_KEY`; neither value is a
caller option. Execution inspect and request-cancel derive every Codex profile,
thread, workspace, and backend field from durable state.

Manual `succeed` records `turn_succeeded` and leaves the Task `running`. Only a
separate current `execution.completion.accept` authorization, exact `ACCEPT
MANUAL COMPLETION` confirmation, and derived verified receipt/finalization may
move that Task to `completed`. Cancellation remains request, observation, and
verified interruption rather than a blind terminal write.

### Product-command success objects and redaction

Base and lifecycle results retain their exact shapes. Product results have these
exact field orders:

- `authorization.upgrade`: `mode`, `expiresAt`, `capabilityCount`,
  `epochRevision`.
- `dispatch.run` and `dispatch.resume`: `runId`, `status`, `ownerRevision`,
  `runRevision`, `heartbeatAt`, `leaseExpiresAt`, `membershipRevision`,
  `expectedMemberCount`, `pendingMemberCount`, `terminalMemberCount`,
  `terminalStatus`, `replayed`.
- Every execution or Manual command: `executionId`, `taskId`, `taskState`,
  `taskRevision`, `executionRevision`, `attemptNumber`, `fencingToken`,
  `lifecycle`, `observationNumber`, `waiting`, `replayed`.
- Codex profile and dispatch results use the exact shapes listed in
  [Machine-readable output](#machine-readable-output); execution continuation,
  inspect, and cancellation retain the same execution projection as Manual.

`waiting` is null or exactly `reason`, `phase`, `requiredAction`,
`lastErrorCode`, `lastErrorSummary`, `retryable`, `retryCount`, `retryAfter`,
`executionId`, `workspaceRevision`, `waitingTaskRevision` in that order.

These results omit actor/principal/owner, Project/runtime paths,
input/policy/backend/thread/intent/receipt/finalization identifiers, Task body,
confirmation and idempotency text, prompt/source/environment/credential values,
raw adapter payload/error, SQL, stack, and arbitrary text. JSON and human modes
retain the envelope, one-line stdout, empty-stderr, escaping, and field-order
rules above.

### Product-facade error mapping

The one public table above includes all 41 current codes, including the seven
execution/dispatcher-specific and four Codex-specific codes. Application and persistence mappings remain exhaustive;
capability-upgrade ineligibility is `AUTHORIZATION_DENIED`. Reliable-loop
`INVALID_INPUT` maps to `CLI_INVALID_INPUT`; `AUTHORIZATION_DENIED`,
`CONFIRMATION_REQUIRED`, `PROJECT_NOT_FOUND`, `TASK_NOT_FOUND`, and
`STALE_REVISION` map to the same public codes; `PROJECT_DISABLED`,
`TASK_NOT_ELIGIBLE`, and `EXECUTION_TERMINAL` map to `DOMAIN_REJECTED`;
`EXECUTION_NOT_FOUND`, `STALE_FENCE`, `LEASE_EXPIRED`,
`RECONCILIATION_REQUIRED`, `ADAPTER_FAILURE`, and
`AMBIGUOUS_EXTERNAL_STATE` map to the same current codes;
`IDEMPOTENCY_CONFLICT` maps to `OPERATION_CONFLICT`;
`PROJECT_IDENTITY_CHANGED` maps to `PROJECT_REGISTRY_REJECTED`; and
`PERSISTENCE_FAILURE` maps to `PERSISTENCE_UNAVAILABLE`.

Codex `CODEX_PROFILE_NOT_FOUND`, `CODEX_PROFILE_INACTIVE`,
`CODEX_CREDENTIAL_UNAVAILABLE`, and `CODEX_ADAPTER_FAILURE` map to their same
public codes. Its common authorization, confirmation, Project/Task, revision,
fence, lease, reconciliation, idempotency, identity, and persistence failures
map to the existing corresponding public codes; impossible values remain
`INTERNAL_ERROR`.

Dispatcher `INVALID_INPUT` maps to `CLI_INVALID_INPUT`;
`AUTHORIZATION_DENIED` and `STALE_REVISION` map to the same public codes;
`RUN_NOT_FOUND` maps to `DISPATCH_RUN_NOT_FOUND`; `IDEMPOTENCY_CONFLICT` and
`LEASE_NOT_EXPIRED` map to `OPERATION_CONFLICT`; `STALE_OWNER` maps to
`STALE_FENCE`; `LEASE_EXPIRED` maps unchanged; `RUN_NOT_RECONCILED`,
`RUN_NOT_SEALED`, `MEMBER_NOT_FOUND`, `MEMBER_NOT_PENDING`, and
`RECONCILIATION_INCOMPLETE` map to `RECONCILIATION_REQUIRED`;
`PROJECT_IDENTITY_CHANGED` maps to `PROJECT_REGISTRY_REJECTED`;
`INTEGRITY_FAILURE` maps to `STATE_CORRUPT`; and `PERSISTENCE_FAILURE` maps to
`PERSISTENCE_UNAVAILABLE`. Any impossible value becomes `INTERNAL_ERROR`; no
internal message is reflected.
