# ADR-005: Intent, receipt, reconciliation, and partial-success recovery

**Status:** Accepted

This is an accepted design requirement for future work, not a statement that external-effect recovery or exactly-once execution is implemented today.

## Context

Launching an execution, publishing files, integrating Git changes, or invoking another system cannot be committed atomically with SQLite. A crash or timeout can therefore leave the durable database and the external resource describing different stages of one operation.

## Decision

Represent each SQLite-external effect as a persisted intent followed by an observed receipt, independent verification, and compare-and-swap finalization. Reconciliation must recover ambiguous and partial success from durable evidence, including privately staged output before publication. The reliability owner defines the exact protocol and observable outcomes.

## Consequences

- Application flows must expose recoverable stages rather than hide an external mutation inside a database transaction.
- A timeout, transport error, or missing response cannot by itself prove that an external effect did not occur.
- The protocol provides a basis for truthful recovery but does not promise universal exactly-once behavior.

## Alternatives

- Performing an external action and then best-effort writing the database was rejected because a crash between the two creates unclassified state.
- Marking success before the external action was rejected because the durable state could advertise work that never happened.
- Automatically deleting partial resources was rejected because ownership, identity, and external success may be uncertain.

## Authoritative contract

The [reliability protocol](../reference/reliability-protocol.md) solely owns intent, receipt, verification, finalization, staging/publication, terminal evidence, fan-out outcomes, and ambiguous or partial-success recovery. Resource-specific observations remain behind the relevant [adapter contracts](../reference/adapter-contracts.md).

## Required validation

The crash, failpoint, reconciliation, and adapter-contract evidence routes are owned by the [validation policy](../reference/validation-policy.md). Fake or contract evidence must not be represented as proof of a real external integration.
