# ADR-011: Data/interface versioning and compatibility

**Status:** Accepted

This is an accepted design requirement for future work, not a statement that any schema, API, adapter version, platform, or upgrade path is currently supported.

## Context

Persisted data and public or adapter interfaces outlive individual processes and can be read by different software revisions. Compatibility claims that are implicit, unbounded, or detached from evidence make recovery and consumer behavior unpredictable.

## Decision

Version durable data, public interfaces, and adapter contracts explicitly, with governed forward migration and downgrade-by-restore rather than assumed bidirectional mutation. Bind platform and public-API support claims to reproducible evidence. The live compatibility owner defines the precise version spaces, change rules, migration direction, and evidence requirements.

## Consequences

- Each incompatible change needs an owned transition rather than an undocumented parser fallback.
- A newer writer may require migration, while downgrade behavior cannot be inferred from forward readability.
- A compatibility matrix reports evidence; it does not create normative support merely by listing a platform or API.

## Alternatives

- Inferring compatibility from package semantic version alone was rejected because stored data and port contracts have distinct lifecycles.
- Maintaining indefinite permissive readers without an explicit retirement rule was rejected because hidden compatibility paths accumulate ambiguity.
- Claiming support from documentation or a mock integration was rejected because compatibility is evidence-bound.

## Authoritative contract

The [versioning and compatibility contract](../reference/versioning-compatibility-contract.md) solely owns schema, API, and adapter versioning, forward migration, downgrade-by-restore, and evidence-bound support claims. The [v0.1 compatibility matrix](../compatibility/v0.1.md) is non-normative evidence only; schema mechanics remain in the [persistence contract](../reference/persistence-contract.md).

## Required validation

Migration, interface-schema, adapter-contract, compile, and platform evidence routes are owned by the [validation policy](../reference/validation-policy.md). Compatibility remains unclaimed wherever current evidence is absent.
