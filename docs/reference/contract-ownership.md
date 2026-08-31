# Contract ownership inventory

This page is an inventory, not a semantic contract. The subject column only
helps readers find the file that defines a rule; it does not restate or modify
that rule. Follow the linked owner for normative language.

The repository has a governance and architecture-contract baseline, a minimal
executable toolchain and feasibility harness, an implemented Domain Core, and
implemented Phase 1 ProjectRegistry, local authorization, application service,
current schema-version-1 persistence, a versioned local product CLI, typed product facade,
reliable Manual execution loop, and reconcile-first Manual dispatcher. Entries marked "planned runtime contract" or a
planned portion of a mixed contract are requirements for future implementation, not claims that an
external orchestrator integration, adapter, supported platform, or product security control
exists.

## Inventory

Each artifact appears exactly once in this inventory.

| Artifact | Role | Subject locator |
| --- | --- | --- |
| [Repository governance](repository-governance.md) | Current repository-governance owner | Authority, capability truthfulness, task-owned development scope, and separation of local edits, commits, and external actions |
| [Local agent Git workflow](local-agent-git-flow.md) | Current repository-development contract | Maintainer task branches, linked worktrees, coordinator state, integration reservation, exact-head gates, FF-only integration, push retry, recovery, and owned cleanup; not a product runtime contract |
| [Toolchain contract](toolchain-contract.md) | Current repository-toolchain contract | Exact Node, pnpm, and TypeScript selections; ESM/package entry boundaries; executable validation commands; CI skeleton; and dependency maintenance |
| [CLI/API contract](cli-contract.md) | Current local product-interface contract | Exact sole current `ato.api/v1` 33-command grammar, bounded input, confirmation phrases, output schemas, redaction, 37 stable public errors, and exit codes; no business-rule ownership |
| [Contract ownership inventory](contract-ownership.md) | Current inventory owner | The mapping from contract subject to authoritative artifact; no domain or runtime rule |
| [Domain contract](domain-contract.md) | Current implemented Domain Core contract | Project binding, Task state, hierarchy, dependency, eligibility, waiting, and Task revision |
| [Persistence contract](persistence-contract.md) | Current implemented foundation and future schema owner | Current SQLite runtime root, single current baseline, Phase 1 metadata/Domain/ProjectRegistry/authorization/application storage, execution attempts/sequences, Manual-loop evidence/journal/completion, and explicit-Manual dispatcher records, ingress, connections, transactions, backup/restore and corruption handling; product facade reads do not create a second writer; future tables require their own approved schema change |
| [Reliability protocol](reliability-protocol.md) | Current Manual-loop/dispatcher/product-facade and planned later-runtime contract | Implemented claim semantic identity, attempts, leases, fencing, idempotency, intent/observation/receipt/finalization, Manual recovery/retry/CAS, dispatcher fan-out outcomes, and typed product derivation; external publication remains planned |
| [Authorization contract](authorization-contract.md) | Current local authorization contract | Trusted bootstrap and identity, nineteen Phase 1, four claim-foundation, six Manual-loop, and one dispatcher action; explicit one-step non-grantable capability upgrades; grants/epochs, narrowing policy, trusted Manual confirmations, lifecycle handoff, and fail-closed application/dispatcher/product decisions; no authority for unimplemented external effects |
| [Adapter contracts](adapter-contracts.md) | Current Execution/Manual and planned other-port contract | Implemented `ato.execution/v1`, production local Manual adapter/control boundary, current port versions, operation envelopes, receipts, and adapter error taxonomy; other ports remain planned |
| [Scheduler contract](scheduler-contract.md) | Current Manual-dispatch subset and planned scheduler contract | Implemented explicit-Manual reconcile-first run, ownership/takeover and worker-death recovery; planned SchedulerBackend, duplicate scheduled delivery, missed-trigger, cadence, and clock/config behavior |
| [Completion and workspace contract](completion-workspace-contract.md) | Planned runtime contract | Gate freshness, isolated workspace topology, worktree ownership, integration reservation, Git partial success, path safety, and cleanup refusal |
| [Observability contract](observability-contract.md) | Current bounded-display subset and planned runtime contract | Current durable records and closed redacted current-v1 summaries; planned correlation, structured operational events, diagnostic access, and application of redaction to operational events |
| [Versioning and compatibility contract](versioning-compatibility-contract.md) | Current schema/API/port-version owner and planned product compatibility contract | Current schema-version-1 identity, sole current `ato.api/v1`, independent closed `ato.execution/v1`, the authorized unreleased v1 reset, future evolution, restore boundaries, and evidence-bound support claims |
| [v0.1 compatibility evidence matrix](../compatibility/v0.1.md) | Non-normative evidence view | Recorded evidence, gaps, and claim status for v0.1 targets; never a source of compatibility policy |
| [Threat model](../security/threat-model.md) | Current local security subset and planned later contract | Assets, actors, trust boundaries, abuse cases, implemented registry/authorization/application/Manual-loop/dispatcher mitigations, residual risks, negative-test obligations, and later-runtime non-claims |
| [Privacy and logging contract](../security/privacy-and-logging.md) | Current durable-record/audit/display subset and planned later contract | Data classes, implemented sanitized Phase 1, Manual-loop, dispatcher and current product projections, prompt and secret handling, planned operational logging/retention/diagnostic disclosure, and default no telemetry |
| [Validation policy](validation-policy.md) | Current validation owner | Impact routing, binary evidence records, and repository gates |

## How other documents use the inventory

Architecture entry points and ADRs may explain rationale and link to an owner.
They must not become a second mutable copy of an owned state set, schema,
protocol, permission rule, security rule, compatibility policy, or validation
gate. The current repository rule is in
[Repository governance](repository-governance.md#single-authoritative-owner).
