# ADR-009: Workspace ownership, integration reservation, path safety, and cleanup

**Status:** Accepted

The fresh-only Phase 3 library now implements ownership-bound workspace
creation/inspection/recovery/cleanup, durable integration reservation, local
fast-forward and configured local-file push, partial-success observation, and
inspect-only ambiguity recovery. These components require explicit trusted
injection and are not constructed by the default product runtime or CLI. This
ADR is not authorization to create a worktree for repository development and
is not a platform-support claim.

## Context

Workspace creation, Git integration, and cleanup mutate filesystem and repository state outside SQLite. Paths may escape containment through aliases or reparse behavior, concurrent integrations may race, and a partial Git action may succeed before local bookkeeping observes it.

## Decision

Require evidence-bound workspace ownership, isolated workspace topology, an
explicit integration reservation, contained regular-path and no-follow safety
checks, and cleanup that refuses uncertain ownership or identity. Recover Git
partial success by observation and reconciliation rather than assumed rollback.
The completion/workspace owner defines the exact topology, attestation,
reservation, and recovery rules; adapter shapes remain separately owned.

## Consequences

- Product worktree behavior must be exercised only in verified disposable fixtures until a real project is separately authorized.
- Cleanup is a guarded mutation, not a routine finally-block action.
- Git success, database success, and resource removal remain separately observable facts.

## Alternatives

- Reusing an arbitrary caller working directory was rejected because ownership and isolation would be unclear.
- A process-local integration mutex was rejected because reservation state must survive process loss and reject stale owners.
- Recursive best-effort deletion was rejected because path confusion, reparse traversal, or foreign ownership could destroy unrelated data.

## Authoritative contract

The [completion and workspace contract](../reference/completion-workspace-contract.md) solely owns gate identity, topology isolation, ownership receipts, integration reservation, Git partial-success observation, path containment, reparse handling, and cleanup refusal. Related abuse cases and residual risks are owned by the [threat model](../security/threat-model.md); port shapes are owned by the [adapter contracts](../reference/adapter-contracts.md).

## Required validation

Workspace adapter, Git partial-success, path/reparse, ownership, cleanup-refusal, concurrency, and operating-system evidence is routed by the [validation policy](../reference/validation-policy.md). This ADR neither creates nor authorizes a development worktree.
