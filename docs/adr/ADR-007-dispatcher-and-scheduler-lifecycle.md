# ADR-007: Dispatcher process and scheduler lifecycle

**Status:** Accepted

The explicit-Manual dispatcher and library-level scheduled-delivery ingress now
implement this decision. No concrete scheduler adapter, platform registration,
daemon/service, real scheduled task, or support claim exists today.

## Context

Dispatch must tolerate duplicate triggers, missed triggers, worker death, host restart, and tasks that become eligible without a single originating process remaining alive. A scheduler and a dispatcher also have different responsibilities: one requests attention, while the other reconciles durable work.

## Decision

Use a reconciliation-driven dispatcher whose durable state, not process lifetime, determines recoverable work. Scheduler triggers wake reconciliation rather than directly owning task execution, and dispatcher lifecycle handling must compose with durable claims and receipts. The scheduler library records each delivery, authorizes `dispatch.run`, creates one canonical run for each exact scheduled tuple, and attaches duplicates; the live scheduler and reliability owners define duplicate, missed-trigger, worker-death, retry, and recovery semantics.

## Consequences

- Starting another dispatcher or receiving another trigger must be an expected condition handled through the durable protocol.
- Process supervision can improve availability but cannot substitute for durable ownership and reconciliation.
- Trigger cadence, process topology, a concrete platform adapter, real scheduler
  registration, and platform support remain implementation and evidence
  questions.

## Alternatives

- Having the scheduler launch each task directly was rejected because trigger delivery would become execution ownership.
- Treating a singleton process as the concurrency boundary was rejected because crashes and overlapping starts would leave no durable proof.
- Relying on an in-memory queue as authoritative state was rejected because restart would discard unresolved work.

## Authoritative contract

The [scheduler contract](../reference/scheduler-contract.md) solely owns trigger reconciliation, duplicate and missed-trigger behavior, and worker-death semantics. The [reliability protocol](../reference/reliability-protocol.md) owns durable dispatcher claims, recovery, retries, and observable outcomes. Process-facing shapes remain in the [adapter contracts](../reference/adapter-contracts.md).

## Required validation

Dispatcher recovery, scheduler contract, concurrency, failpoint, and operating-system evidence is governed by the [validation policy](../reference/validation-policy.md). Library/Fake evidence proves the durable ingress boundary only; it is not evidence that a real platform scheduler runs.
