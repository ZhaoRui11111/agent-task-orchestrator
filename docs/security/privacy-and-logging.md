# Privacy and logging contract

## Status and authority

This file is the sole normative owner of data classification, prompt and secret
handling, log-content redaction, retention, diagnostic disclosure, and default
no telemetry. The current schema-version-1 application owners implement sanitized append-only
Phase 1, claim, reliable Manual-loop, package-private Codex turn/terminal,
explicit-Manual dispatcher, and dedicated
workspace/ProjectPolicy/gate/completion/integration/cleanup audit/evidence
subsets, and the local product CLI/read-only doctor implement
the closed display subset described below. No runtime logger, secret provider,
diagnostic bundle exporter, retention job, or telemetry implementation exists
today; the corresponding sections remain requirements for later implementations.

The [observability contract](../reference/observability-contract.md) owns event
schemas and where redaction is applied. This file owns what data may appear and
the required transformation/disclosure policy.

## Data classes

| Class | Examples | Default handling |
| --- | --- | --- |
| `public` | Product/contract version, documented stable error code | May appear in operational events. |
| `operational` | Opaque Task/execution/operation IDs, timings, counts, verdict codes | Local structured logs after allowlist and bounds. |
| `sensitive` | Task body, prompt, source content, filesystem/repository path, branch/ref, external account/thread ID, personal data, config value, raw tool output | Persist only in its authoritative store when necessary; omit or pseudonymize in logs and default diagnostics. |
| `secret` | Token, password, private key, cookie, credential, authorization header, secret environment value | Never persist in Task/audit/receipt/log/diagnostic content; pass only by opaque credential reference at the authorized boundary. |

Unknown data is treated as `sensitive`; credential-shaped or explicitly marked
secret data is treated as `secret`.

## Prompt and secret handling

- Task bodies, prompts, source content, and tool output are untrusted sensitive
  data, not instructions to core authorization or logging.
- Only the minimum content required for an explicitly selected execution
  operation may be sent to its configured backend, after the user/action/policy
  checks. Backend disclosure is a functional external action, not telemetry.
- Prompts and source excerpts never appear in operational logs, audit payloads,
  receipt summaries, compatibility evidence, or default diagnostics. Their
  authoritative application storage, if required, is access-controlled and
  explicitly classified.
- Credentials are resolved from an external OS/process credential source at the
  last responsible adapter boundary. Persistence stores a credential reference
  name at most, never the value.
- Secrets are not accepted through Task text, CLI/MCP free text, policy config,
  command arguments, receipt payloads, or diagnostic options. A detected secret
  is rejected or omitted and produces only a fixed redacted reason code.
- A secret may be disclosed to an external backend only when that backend
  operation explicitly requires it and a separate current authorization names
  the credential reference and destination. It is never sent to a model merely
  because prompt content requests it.

## Log redaction rules

### Current application audit

The implemented `application_audit` record is database audit history, not a
general logger. Application code chooses an allowlisted event kind, result,
stable reason, trusted actor/correlation IDs, opaque target kind/ID/revision,
and trusted timestamp. Its bounded canonical details object contains only the
exact action, stable reason, target kind, and nullable target revision.

Execution claim, inspection, renewal, and takeover use the same record shape
with an opaque `execution` target and fixed action/result/reason metadata. Lease
owner, idempotency key, Project/runtime path, Task body, raw identity, expiry,
prompt, backend output, and arbitrary exception text are not audit details. The
typed library result is likewise bounded to documented opaque execution/Task
identity, attempt/fence/revision/expiry state, and fixed error codes/messages;
it is not a general diagnostic surface.

The reliable Manual loop uses separate closed
`execution_operation_audit` events and bounded intent, observation, verified
receipt, finalization, execution-terminal, Manual turn/operation, and Manual
completion records. Their allowlists contain only opaque operational IDs,
closed lifecycle/action/result/reason codes, positive revisions/fences/counts,
timestamps, integrity hashes, and nullable bounded evidence references. The
trusted outcome control accepts only identifier-safe code/reference tokens; raw
adapter payload/error text is never persisted. `turn_succeeded` is recorded as
a turn fact, while the distinct completion decision retains only its exact
authorization/confirmation/evidence lineage.

The durable intent failure projection is limited to the closed adapter
category, bounded code, retryable/ambiguous booleans, nullable canonical retry
time, and integer retry count. Raw adapter messages, payloads, stacks, SQL, and
Task/source content are discarded before that projection.

The package-private Codex path reuses the authoritative Task body only as
bounded ephemeral effect input after recomputing its exact
`task-sha256:<lowercase-64-hex>` reference. It does not duplicate those bytes,
the working-directory path, repository content, environment, credential, SDK
item event, model/tool text, command, output, usage detail, or raw error in an
intent, journal, receipt, audit row, result, feasibility record, or default
diagnostic. The driver drops all item events. A completed event contributes only
a digest of its closed terminal/usage projection; the usage values themselves
are not persisted. `codex_backend_turns` retains the sensitive SDK thread ID
only because same-thread continuity and restart verification require that
authoritative identity. It remains inside typed persistence and is absent from
application audit, the current product/CLI, compatibility evidence, and logs.
No current supported route resolves a credential or discloses input to Codex.

The dispatcher stores only opaque trigger/request/run/resource/member/
execution/intent identities, owner and revision facts, timestamps, bounded
counts, and closed action/result/disposition/outcome/reason codes. Caller
idempotency text is replaced by a stable digest identity before persistence.
Task bodies, Project paths, prompts, environment values, credentials, raw
adapter payload/errors, SQL, stacks, and arbitrary caller text are neither
dispatcher records nor library result fields. A malformed value fails before
trusted ingress/state access; an unrecognized persisted enum or code is typed
corruption rather than displayable text.

The workspace/Phase 3 library stores only opaque Project/Task/run/member/
execution/workspace/operation/policy/gate/reservation/attestation identities,
positive revisions/generation/attempt/fence/inventory counts, closed lifecycle/
action/state/outcome/reason/verdict codes, timestamps, canonical integrity
digests, and nullable bounded opaque evidence references. Its dedicated
workspace, gate, and integration transition-event rows have exact fixed field
sets and no attributes object. Evidence references must be 1–128-character
tokens using only ASCII letters, digits, `.`, `_`, `:`, and `-`, beginning with
a letter or digit. Raw canonical path, repository/registration/branch/ref text,
Task/source content, environment, credential, backend message/payload, command
output, SQL, and stack values are not copied into durable audit/event or typed
application result fields.

Policy configuration enters through a trusted exact-key adapter configuration;
the durable policy receipt retains only bound policy/contract/adapter/config
identities, closed decision/facts, an integrity digest, and validity. Completion-
gate records retain command and evidence-root identities as digests plus a
bounded reference, never the command line, environment, stdout, stderr, or
evidence file content. Integration records retain exact object/ref state needed
for verification but no remote credential or raw Git output. Cleanup
attestations retain canonical bound facts and a digest for point-of-use
verification, not a caller-selected deletion path.

An exact backend receipt may contain bounded path/Git observations for semantic
verification, but the application retains only its digest and redacted closed
facts. Test Fakes remain unexported. The Windows Git workspace backend writes
one closed canonical ownership manifest only inside its bound Git
administrative directory; that manifest contains the immutable ownership-
binding digest, closed versions and object IDs, and hashes of filesystem
identities, never a Task body, credential, environment, raw canonical path, or
command output. The local completion and Git integration adapters likewise
emit no log or telemetry stream. All Phase 3 adapters are library-injected and
are not wired to the default product or CLI.

Task body, Project canonical path, prompts, source/repository content, tool or
Agent output, free text, raw commands, environment values, credentials, and
secrets are never copied into audit details. Accepted application operations
and fully bound authorization denials append audit in the same transaction as
their request and decision; SQLite triggers reject audit update or deletion.
Failures before a safe typed/bound envelope produce no audit row rather than
persisting unclassified input. Fully bound Manual-loop denials persist only the
closed execution request/decision/audit unit and cause no adapter or Task
mutation.

### Current CLI and doctor display

The local `ato` human and sole current `ato.api/v1` outputs use
closed allowlisted result shapes and fixed public errors. They never serialize
Task body, cancellation reason, full Project/runtime path or filesystem
identity, actor/principal/worker owner, request/correlation/decision/audit/
lifecycle/restore identity, backend/thread/intent/receipt/finalization identity,
confirmation or idempotency text, application-state digest, secret,
environment value, raw adapter payload/error, SQL/page/error, cause, or stack.
Required bounded operational Project, Task, execution, dispatcher-run, grant,
and backup IDs may appear only in the documented workflow result shapes.

The current execution projection exposes only execution/Task revisions, attempt and
fence numbers, closed lifecycle, observation number, and the exact bounded
waiting view. Its dispatcher projection exposes only run status, revisions,
lease times, bounded membership counts, and terminal status. Failures return
only the stable public code and fixed message. Read-only doctor
returns only its six closed health fields; it does not export rows, paths,
manifests, raw migration evidence, or diagnostic files. Both modes emit exactly
one line to stdout and no raw stderr diagnostics. Exact serialization belongs to
the [CLI/API contract](../reference/cli-contract.md).

The following broader redaction rules apply when an operational logger is
implemented; the current foundation does not claim that logger or its HMAC key
lifecycle.

Redaction is allowlist-first. For each structured event schema:

- `secret` values and their keys/headers are omitted and replaced only by the
  fixed marker `<redacted>` when field presence is operationally required;
- sensitive stable identities are HMAC-pseudonymized with a local rotating key;
  raw filesystem paths retain only a non-reversible root label and basename
  class, not path components;
- URLs drop user-info, query, and fragment; command lines retain only a stable
  command/gate ID; environment records retain names only when allowlisted and no
  values;
- external errors map to stable taxonomy/reason codes; raw bodies, stack input,
  request/response headers, and tool output are omitted;
- free text is omitted by default; an allowlisted redacted summary is bounded to
  512 UTF-8 bytes and has control characters normalized; and
- arrays, objects, and repeated identifiers are bounded before serialization.

Known sentinel secret values are checked after transformation in tests. Pattern
scanning is defense in depth, not proof that arbitrary text is safe. If the
redactor cannot classify or transform a field, the original event is dropped
and only a fixed minimal refusal event may be emitted.

## Retention

- Secret values have zero persistent retention.
- Structured operational log files rotate daily and are retained for 14 days,
  subject to an earlier user deletion or a 100 MiB total cap; oldest complete
  files are removed first.
- Diagnostic bundles are not generated by default. A generated local bundle has
  a disclosed expiry no later than 7 days and is removed only through
  ownership-safe cleanup.
- Primary Task state, audit history, intents, receipts, grants, policy/gate/
  completion/integration records, workspace generations, cleanup attestations,
  and transition events are not log data. They remain with the
  primary database and its authorized backup/restore
  lifecycle; v0.1 performs no automatic semantic-history purge.
- External execution/service retention is governed by that provider and must be
  disclosed before use; the orchestrator does not claim to delete provider-side
  copies.

Retention deletion never follows links, removes an unknown file, or weakens an
audit/database invariant. Failure to prove ownership leaves the item and reports
the failure.

## Diagnostic disclosure

The implemented `ato doctor` surface is limited to the fixed classification
above. Any future diagnostic bundle includes only the redacted, manifest-listed
fields allowed by the
[observability owner](../reference/observability-contract.md#diagnostic-access).
Raw prompts, source/Task bodies, environment values, credentials, database
pages, raw adapter payloads, and full paths are excluded.

Local generation, local reading, and disclosure/export are separate actions.
Before export, the user receives the destination, manifest, data classes,
retention consequence, and omissions, and must authorize that exact disclosure.
No bundle is uploaded automatically, and a request for troubleshooting does not
imply permission to disclose it.

## Default no telemetry

The default configuration has no analytics, crash-report, tracing, log-shipping,
usage-metrics, or diagnostic-upload endpoint and starts no telemetry network
request. Functional calls to an explicitly configured execution, Git, or other
adapter remain separate authorized operations.

Any future telemetry requires a new reviewed contract, explicit opt-in,
destination and field disclosure, retention/deletion policy, security review,
and separate network/publication authorization. Absence of opt-in is denial.
