# ADR-007: Dispatcher process and scheduler lifecycle

**Status:** Accepted

This is an accepted design requirement for future work, not a statement that a dispatcher, daemon, worker, or scheduled trigger exists today.

## Context

Dispatch must tolerate duplicate triggers, missed triggers, worker death, host restart, and tasks that become eligible without a single originating process remaining alive. A scheduler and a dispatcher also have different responsibilities: one requests attention, while the other reconciles durable work.

## Decision

Use a reconciliation-driven dispatcher whose durable state, not process lifetime, determines recoverable work. Scheduler triggers wake reconciliation rather than directly owning task execution, and dispatcher lifecycle handling must compose with durable claims and receipts. The live scheduler and reliability owners define exact duplicate, missed-trigger, worker-death, retry, and recovery semantics.

## Consequences

- Starting another dispatcher or receiving another trigger must be an expected condition handled through the durable protocol.
- Process supervision can improve availability but cannot substitute for durable ownership and reconciliation.
- Trigger cadence, process topology, and platform support remain implementation and evidence questions.

## Alternatives

- Having the scheduler launch each task directly was rejected because trigger delivery would become execution ownership.
- Treating a singleton process as the concurrency boundary was rejected because crashes and overlapping starts would leave no durable proof.
- Relying on an in-memory queue as authoritative state was rejected because restart would discard unresolved work.

## Authoritative contract

The [scheduler contract](../reference/scheduler-contract.md) solely owns trigger reconciliation, duplicate and missed-trigger behavior, and worker-death semantics. The [reliability protocol](../reference/reliability-protocol.md) owns durable dispatcher claims, recovery, retries, and observable outcomes. Process-facing shapes remain in the [adapter contracts](../reference/adapter-contracts.md).

## Required validation

Dispatcher recovery, scheduler contract, concurrency, failpoint, and operating-system evidence is governed by the [validation policy](../reference/validation-policy.md). Acceptance of this ADR is not evidence that any scheduling path runs.
