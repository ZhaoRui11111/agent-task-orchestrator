# Observability contract

## Status and authority

This file is the sole normative owner of planned correlation, structured
operational events, diagnostic access, and the application of redaction to
operational events. No logger, diagnostic command, event exporter, or telemetry
pipeline exists today.

Data classification, allowed disclosure, content transformations, retention,
and default no telemetry are owned by the
[privacy and logging contract](../security/privacy-and-logging.md). Durable audit
rows are source-of-truth records owned by the
[persistence contract](persistence-contract.md), not reconstructed from logs.

## Correlation model

- Each user or scheduler ingress creates one `correlation_id`; nested work
  propagates it unchanged across application, persistence, dispatcher, and
  adapter boundaries.
- `causation_id` identifies the immediately preceding event or command.
- Structured events include applicable stable IDs for actor, Project, Task,
  execution, run, trigger, operation/intent, receipt, workspace/generation,
  gate, and authorization decision.
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
