# ADR-010: Threat model, privacy, and prompt/secret/log handling

**Status:** Accepted

This is an accepted design requirement for future work, not a claim that security controls, privacy guarantees, or safe external integrations are implemented today.

## Context

The orchestrator will consume repository content, prompts, tool output, paths, credentials, operational records, and external responses across multiple trust boundaries. Those inputs may be hostile or sensitive, and logs or diagnostics can accidentally become a second disclosure channel.

## Decision

Treat threat modeling, data classification, prompt and secret handling, log redaction, retention, diagnostic disclosure, and default no telemetry as first-class contracts. Repository and external content remain untrusted input; authorization and validation remain distinct from trust. The security, privacy, and observability owners define the exact assets, boundaries, mitigations, classifications, redaction, and disclosure rules.

## Consequences

- Later features must include threat-driven negative tests and cannot add telemetry or sensitive diagnostics by implication.
- Logs, prompts, receipts, and error messages must be designed as potential data-exposure surfaces.
- Accepted mitigations document required design but do not establish a current security assurance or release-readiness claim.

## Alternatives

- Adding security review only after implementation was rejected because protocol and storage choices create early trust boundaries.
- Treating repository text or tool output as trusted instructions was rejected because those channels can carry prompt injection.
- Enabling telemetry by default and relying on later filtering was rejected because collection itself changes the privacy boundary.

## Authoritative contract

The [threat model](../security/threat-model.md) solely owns assets, actors, trust boundaries, abuse cases, mitigations, residual risks, and negative-test obligations. [Privacy and logging](../security/privacy-and-logging.md) solely owns classification, prompt/secret handling, redaction, retention, disclosure, and default no telemetry. The [observability contract](../reference/observability-contract.md) owns operational-event structure and redaction requirements.

## Required validation

Security-boundary, authorization, redaction, disclosure, and threat-driven negative evidence is governed by the [validation policy](../reference/validation-policy.md). No control is represented as effective until matching implementation and evidence exist.
