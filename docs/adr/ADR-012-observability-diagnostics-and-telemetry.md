# ADR-012: Structured observability, redaction, diagnostics, and default no telemetry

**Status:** Accepted

This is an accepted design requirement for future work, not a statement that structured events, diagnostics, redaction controls, or telemetry settings are implemented today.

## Context

Durable, multi-stage operations need enough evidence to diagnose claims, retries, reconciliation, fan-out, and partial success. Unstructured or overbroad logs make correlation difficult and can expose prompts, secrets, paths, or personal data.

## Decision

Use correlated structured operational events and controlled diagnostic access, apply contract-owned redaction before disclosure, and keep telemetry disabled by default. Observability must explain durable outcomes without becoming an alternate state authority or sensitive-data archive. The live observability and privacy owners define exact fields, access, redaction, retention, and disclosure behavior.

## Consequences

- Later workflows must emit diagnosable evidence at owned protocol boundaries while preserving the authoritative database and receipts.
- Operators may need explicit diagnostic actions instead of unrestricted log access.
- Any future remote telemetry capability requires separate design, authorization, privacy review, and validation; it is not implied here.

## Alternatives

- Free-form logging as the only diagnostic record was rejected because reliable correlation and machine checks would be inconsistent.
- Logging complete prompts, environment values, or backend payloads for convenience was rejected because diagnostics would amplify disclosure risk.
- Enabling remote telemetry by default was rejected because it would silently expand external data flow and authorization scope.

## Authoritative contract

The [observability contract](../reference/observability-contract.md) solely owns correlation, structured operational events, diagnostic access, and event redaction. [Privacy and logging](../security/privacy-and-logging.md) solely owns data classification, retention, disclosure, prompt/secret handling, and default no telemetry. Durable outcome evidence remains owned by the [reliability protocol](../reference/reliability-protocol.md).

## Required validation

Structured-event schema, correlation, redaction, negative disclosure, diagnostics, and applicable security evidence is governed by the [validation policy](../reference/validation-policy.md). No observability or privacy behavior is implemented by this record alone.
