# Observability contract

## Status and authority

This file is the sole normative owner of planned correlation, structured
operational events, diagnostic access, and the application of redaction to
operational events. No logger, diagnostic command, event exporter, or telemetry
pipeline exists today. Current schema-version-1 application, Manual-loop,
package-private Codex turn/terminal journal, dispatcher request/
decision/audit, reconciliation, member, no-execution member-denial, and summary
rows, plus current policy receipts, completion-gate transition evidence,
completion decisions, integration reservation/transition evidence, cleanup
attestations, the workspace transition-event relation, and closed current
`ato.api/v1` responses, implement only a
bounded durable/display evidence subset; they are not log files or a general
event sink.

Data classification, allowed disclosure, content transformations, retention,
and default no telemetry are owned by the
[privacy and logging contract](../security/privacy-and-logging.md). Durable audit
rows are source-of-truth records owned by the
[persistence contract](persistence-contract.md), not reconstructed from logs.

## Correlation model

- Each current user/explicit-Manual ingress creates one `correlation_id`; a
  future scheduler ingress must do the same. Nested work
  propagates it unchanged across application, persistence, dispatcher, and
  adapter boundaries.
- `causation_id` identifies the immediately preceding event or command.
- Structured events include applicable stable IDs for actor, Project, Task,
  execution, run, trigger, operation/intent, receipt, workspace/generation,
  policy, gate, integration reservation, cleanup attestation, and authorization
  decision.
- Missing optional IDs are explicit nulls. Logs never substitute Task title,
  filesystem path, prompt excerpt, or external response text for a stable ID.
- Adapter calls carry correlation and operation identity, and adapter errors
  return them unchanged.

## Structured operational event envelope

Operational output is one versioned structured event per record. The exact
envelope is:

- `event_schema_version`;
- unique `event_id`, `correlation_id`, and nullable `causation_id`;
- UTC `occurred_at`, severity `debug|info|warn|error|security`, and stable
  `event_name`;
- component and operation name;
- nullable actor, Project, Task, execution, run, trigger, intent, receipt,
  workspace, and gate IDs;
- stable outcome and reason codes;
- bounded numeric measurements and retry/latency fields;
- `privacy_classification`, `redaction_applied`, and redaction-policy version;
  and
- a schema-specific allowlisted `attributes` object.

The initial event-name families are `domain.command`, `authorization.decision`,
`persistence.transaction`, `migration.transition`, `backup.transition`,
`dispatch.run`, `execution.claim`, `lease.transition`, `operation.transition`,
`adapter.call`, `workspace.transition`, `gate.verdict`, `integration.transition`,
`security.refusal`, and `diagnostic.access`.

Events describe observed facts. They do not claim an external effect succeeded
unless a verified receipt/finalization exists, and they do not claim a Task
completed based on an execution-turn event.

## Current dedicated transition evidence

The current workspace/Phase 3 library does not implement the general
operational event envelope or a sink. It persists dedicated append-only
`workspace_events`, `completion_gate_events`, and `integration_events`
relations as authoritative transition evidence, while the generic application
audit records bounded policy/completion/integration command outcomes.

The workspace event-kind set is `workspace.operation.prepared`,
`workspace.operation.denied`, `workspace.operation.executing`,
`workspace.operation.observed`, `workspace.operation.verified`,
`workspace.operation.finalized`, and `workspace.operation.reconciled`.

Each row has exactly event, operation, nullable intent, event-kind, closed
outcome/reason, actor, correlation, nullable causation, nullable workspace/
generation/revision, nullable observation number, nullable opaque evidence
reference, and trusted creation time. It contains no severity, component,
arbitrary attributes, message, path, branch, Task/source body, environment,
credential, raw adapter result/error, SQL, stack, or export destination.
Evidence references are null or 1–128-character opaque identifiers matching
`[A-Za-z0-9][A-Za-z0-9._:-]*`; paths, URLs with credential material, and free
text are invalid. Events are inserted in the same short transaction as their
durable transition and are verified by the combined decoder; they cannot
authorize a later operation or substitute for observation, verified receipt,
or finalization.

Completion-gate events use the same closed prepared/denied/executing/observed/
verified/finalized/reconciled lifecycle under a gate operation and intent.
Integration events add reservation lifecycle facts (`reserved`, `renewed`,
`taken_over`, `released`, `expired`, or `ambiguous`) and the same closed
operation lifecycle. They contain only bound opaque identities, closed
outcome/reason codes, revisions/fences/counts/times, and nullable bounded
evidence references. Policy receipts, verified gate receipts, generic and
subtyped completion decisions, integration receipts/finalizations, and cleanup
attestations are source-of-truth records rather than reconstructed events.

The package-private Codex path likewise implements no operational event stream.
Its source-of-truth subset is the exact execution intent/authorization/
observation/verified-receipt/finalization chain plus `codex_backend_turns` and
immutable terminal `codex_backend_operations`. Those rows retain only opaque
backend/thread/operation/receipt identities, tuple revisions/fence/workspace
bindings, closed lifecycle and `turn.completed|turn.failed` signals, timestamps,
hashes, and bounded evidence references. The SDK thread ID is sensitive
authoritative state: it is not copied into application audit, CLI output,
compatibility evidence, or a general log. SDK item events, prompts, model/tool
text, command/path values, usage detail, and raw error bodies are discarded at
the driver boundary rather than converted into events.

No current CLI or diagnostic surface exports any of these rows. Adding a logger,
general event envelope, retention worker, query/export API, telemetry sink, or
remote disclosure remains a separate planned implementation and authorization
decision.

## Operational-event redaction

Before an event reaches any sink, the event writer MUST:

1. validate the named event schema and discard unknown attributes;
2. attach the data class prescribed by the privacy owner to every permitted
   attribute;
3. apply that owner's omit, replace, pseudonymize, truncate, and normalization
   transformations;
4. remove raw prompts, Task/source bodies, environment values, credential
   material, URL query/user-info, command output, and raw external error bodies;
5. bound strings, arrays, nesting, and numeric cardinality; and
6. mark the redaction-policy version and whether any value was transformed.

If schema validation or redaction fails, the original event is not emitted. A
minimal `security.refusal` record containing only stable IDs and a fixed reason
code may be emitted through a known-safe schema. Redacted operational logs are
diagnostic hints, never a substitute for an immutable receipt, inventory, or
authorization decision.

## Diagnostic access

- Reading diagnostics requires `diagnostic.read`; generating or disclosing a
  bundle requires the separate `diagnostic.export` action.
- Diagnostic generation is local and explicit. It creates a private staged
  bundle, applies operational redaction, validates a manifest, and publishes it
  through the reliability publication protocol.
- The manifest lists event time range, included schemas and counts, product and
  contract versions, environment dimensions, redaction-policy version, omitted
  data classes, and file inventory. It contains no secret value.
- The default bundle includes redacted events, configuration shape without
  values, migration/compatibility metadata, and receipt IDs. It excludes raw
  prompts, Task/source contents, full filesystem paths, environment values,
  credentials, database pages, and raw adapter payloads.
- Before export, the caller is shown the manifest, local bundle path, data
  classes, destination, and retention consequence. Local generation is not
  authorization to upload, attach, or otherwise disclose it.
- Every read, generation, and export attempt emits an authorization decision and
  `diagnostic.access` audit/event record, including denial.

No remote observability or telemetry endpoint is configured by this contract.
The privacy owner defines the default no-telemetry rule and retention periods.
