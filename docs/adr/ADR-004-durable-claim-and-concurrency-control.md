# ADR-004: Claim, lease, fencing, idempotency, and revision/CAS

**Status:** Accepted

This is an accepted design requirement for future work, not a statement that durable dispatch or concurrency control is implemented today.

## Context

Workers can overlap, pause, restart, lose ownership, or act on stale task state. Process-local locks and optimistic assumptions cannot establish who may advance a durable operation after those events.

## Decision

Use durable claims and renewable leases with fencing, semantic idempotency, and revision-bound compare-and-swap for concurrent task operations. Operation identity and policy binding must survive process boundaries. The reliability protocol owns the exact acquisition, renewal, expiry, conflict, and finalization rules, while the domain contract owns task revision itself.

## Consequences

- Every mutating worker path must be designed around stale-owner refusal rather than process-local exclusivity.
- Retries must reuse or reconcile semantic operation identity instead of assuming that a repeated call is new work.
- The exact token, revision, timeout, and storage representation cannot be inferred from this ADR.

## Alternatives

- Holding a file or process mutex for an entire operation was rejected because ownership would not remain trustworthy across process death.
- Timestamp-only last-writer-wins updates were rejected because stale workers could overwrite newer decisions.
- Treating backend retry behavior as idempotency was rejected because infrastructure retries do not define application semantic identity.

## Authoritative contract

The [reliability protocol](../reference/reliability-protocol.md) solely owns claim, lease, fencing, idempotency, operation identity, policy binding, and revision/CAS behavior. The [domain contract](../reference/domain-contract.md) solely owns task revision semantics.

## Required validation

The concurrency, fencing, idempotency, failpoint, and recovery evidence routes are owned by the [validation policy](../reference/validation-policy.md). This decision may be claimed as implemented only after those applicable gates pass.
