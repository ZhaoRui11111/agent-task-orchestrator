# Architecture decision records

This directory records accepted architecture decisions for agent-task-orchestrator. Acceptance means that implementation work must satisfy the decision; it does not by itself prove that a capability is implemented, tested, or supported. The repository currently has the qualified local explicit-Manual Phase 2 product runtime described in [ARCHITECTURE.md](../../ARCHITECTURE.md), but no scheduler, external execution/workspace integration, supported platform, or release.

ADRs preserve context, the selected direction, and rejected alternatives. They do not own mutable state, protocol, security, compatibility, or validation details. Those rules remain with the live owners inventoried by the [contract ownership matrix](../reference/contract-ownership.md).

| ADR | Decision |
| --- | --- |
| [ADR-001](ADR-001-typescript-node-toolchain-and-packaging.md) | TypeScript/Node toolchain and packaging |
| [ADR-002](ADR-002-project-and-task-domain-semantics.md) | Project and Task domain semantics |
| [ADR-003](ADR-003-sqlite-lifecycle-policy.md) | SQLite, migration, backup, and corruption policy |
| [ADR-004](ADR-004-durable-claim-and-concurrency-control.md) | Claim, lease, fencing, idempotency, and revision/CAS |
| [ADR-005](ADR-005-external-effect-reconciliation.md) | Intent, receipt, reconciliation, and partial-success recovery |
| [ADR-006](ADR-006-versioned-port-contracts.md) | Versioned port contracts and adapter error taxonomy |
| [ADR-007](ADR-007-dispatcher-and-scheduler-lifecycle.md) | Dispatcher process and scheduler lifecycle |
| [ADR-008](ADR-008-authorization-and-policy-gated-completion.md) | Authorization and policy-gated completion |
| [ADR-009](ADR-009-workspace-ownership-and-safe-integration.md) | Workspace ownership, integration reservation, path safety, and cleanup |
| [ADR-010](ADR-010-threat-privacy-and-sensitive-data-model.md) | Threat model, privacy, prompt/secret/log handling |
| [ADR-011](ADR-011-data-and-interface-compatibility.md) | Data/interface versioning and compatibility |
| [ADR-012](ADR-012-observability-diagnostics-and-telemetry.md) | Structured observability, redaction, diagnostics, and default no telemetry |
