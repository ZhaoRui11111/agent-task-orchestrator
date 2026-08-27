# ADR-006: Versioned port contracts and adapter error taxonomy

**Status:** Accepted

This is an accepted design requirement for future work, not a statement that any port, adapter, backend, or external integration is implemented or supported today.

## Context

Execution, workspace, scheduling, project policy, and completion behavior will vary by environment. Without explicit inbound/outbound shapes and stable failure meanings, backend details would leak into the application and domain layers.

## Decision

Put replaceable integrations behind directionally explicit, versioned port contracts. Define operation shapes, evidence-bearing receipts, and a shared adapter error taxonomy at that boundary so application behavior does not depend on vendor-specific exceptions. The live adapter owner defines the exact ports, versions, payloads, receipts, and mappings.

## Consequences

- Manual, Codex, Git, scheduler, policy, and completion implementations must satisfy contract tests rather than change core semantics.
- Adding a backend may extend an owned adapter implementation but cannot silently redefine domain outcomes or authorization.
- Version support and compatibility require evidence beyond the existence of a TypeScript interface.

## Alternatives

- Calling vendor SDKs directly from domain or application logic was rejected because it would invert dependency ownership.
- Allowing each adapter to expose unrelated error classes was rejected because recovery and outcome mapping would become backend-specific.
- Using an unversioned structural type as a permanent compatibility promise was rejected because changes would be indistinguishable from accidental drift.

## Authoritative contract

The [adapter contracts](../reference/adapter-contracts.md) solely own port direction, contract versions, operation shapes, receipts, and the adapter error taxonomy. The [versioning and compatibility contract](../reference/versioning-compatibility-contract.md) owns compatibility and support policy for those versions.

## Required validation

Adapter contract tests, negative mappings, and relevant operating-system evidence are routed by the [validation policy](../reference/validation-policy.md). Each concrete adapter remains unsupported until its own applicable evidence exists.
