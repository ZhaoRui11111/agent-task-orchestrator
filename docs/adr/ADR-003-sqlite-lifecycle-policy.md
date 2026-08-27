# ADR-003: SQLite, migration, backup, and corruption policy

**Status:** Accepted

This is an accepted design requirement for future work, not a statement that a database, migration, backup, restore, or repair capability exists today.

## Context

The planned orchestrator needs durable local state across process death and host restart. Its storage lifecycle must address concurrent access, evolution, backup, restore, corruption, and incompatible versions without making application code or individual repositories invent persistence rules.

## Decision

Use SQLite as the authoritative embedded persistence store and govern it through an explicit schema and migration lifecycle with backup, corruption, recovery, and downgrade policy. The live persistence owner alone defines connection policy, transaction boundaries, migration identity, runtime location, and failure handling; this ADR does not duplicate those rules.

## Consequences

- Persistence feasibility must be demonstrated on the claimed operating systems before support is asserted.
- Later schema changes must participate in the owned migration and compatibility lifecycle.
- Backup or successful database opening must not be treated as proof of logical integrity unless the authoritative contract and validation evidence say so.

## Alternatives

- Ad hoc JSON or file-per-task persistence was rejected because it would make atomic multi-record invariants and migration recovery harder to own.
- Requiring a separately administered database service was rejected for the intended local-first deployment shape.
- In-place schema changes without identity or recovery evidence were rejected because interrupted upgrades would become ambiguous.

## Authoritative contract

The [persistence contract](../reference/persistence-contract.md) solely owns SQLite schema and access policy, migrations, backups, corruption and downgrade handling, runtime placement, and recovery semantics. The [versioning and compatibility contract](../reference/versioning-compatibility-contract.md) owns evidence-bound compatibility claims.

## Required validation

Persistence, migration, concurrency, and crash-recovery evidence is governed by the [validation policy](../reference/validation-policy.md). No SQLite lifecycle behavior is implemented merely by accepting this ADR.
