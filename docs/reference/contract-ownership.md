# Contract ownership inventory

This page is an inventory, not a semantic contract. The subject column only
helps readers find the file that defines a rule; it does not restate or modify
that rule. Follow the linked owner for normative language.

The repository has a governance and architecture-contract baseline, a minimal
executable toolchain and feasibility harness, an implemented Domain Core, and
implemented Phase 1 ProjectRegistry, local authorization, application service,
and schema-v3 persistence foundation. Entries marked "planned runtime
contract" or a planned portion of a mixed contract are requirements for future implementation, not claims that an
orchestrator runtime, adapter, supported platform, or product security control
exists.

## Inventory

Each artifact appears exactly once in this inventory.

| Artifact | Role | Subject locator |
| --- | --- | --- |
| [Repository governance](repository-governance.md) | Current repository-governance owner | Authority, capability truthfulness, task-owned development scope, and separation of local edits, commits, and external actions |
| [Local agent Git workflow](local-agent-git-flow.md) | Current repository-development contract | Maintainer task branches, linked worktrees, coordinator state, integration reservation, exact-head gates, FF-only integration, push retry, recovery, and owned cleanup; not a product runtime contract |
| [Toolchain contract](toolchain-contract.md) | Current repository-toolchain contract | Exact Node, pnpm, and TypeScript selections; ESM/package entry boundaries; executable validation commands; CI skeleton; and dependency maintenance |
| [Contract ownership inventory](contract-ownership.md) | Current inventory owner | The mapping from contract subject to authoritative artifact; no domain or runtime rule |
| [Domain contract](domain-contract.md) | Current implemented Domain Core contract | Project binding, Task state, hierarchy, dependency, eligibility, waiting, and Task revision |
| [Persistence contract](persistence-contract.md) | Current implemented foundation and staged future owner | Current SQLite runtime root, Phase 1 metadata/Domain/ProjectRegistry/authorization/application storage, ingress, connections, transactions, migrations, backup/restore and corruption handling; future tables only when their implementing phase appends them |
| [Reliability protocol](reliability-protocol.md) | Planned runtime contract | Operation identity, claims, leases, fencing, CAS, intents, receipts, publication, recovery, retries, and fan-out outcomes |
| [Authorization contract](authorization-contract.md) | Current Phase 1 local authorization contract | Trusted bootstrap, finite Project/Task/dependency action vocabulary, grants, narrowing policy, high-risk confirmation, and fail-closed application decisions; no external or execution authority |
| [Adapter contracts](adapter-contracts.md) | Planned runtime contract | Port direction, current port versions, operation envelopes, receipts, and adapter error taxonomy |
| [Scheduler contract](scheduler-contract.md) | Planned runtime contract | Reconcile-first dispatch and duplicate, missed-trigger, and worker-death behavior |
| [Completion and workspace contract](completion-workspace-contract.md) | Planned runtime contract | Gate freshness, isolated workspace topology, worktree ownership, integration reservation, Git partial success, path safety, and cleanup refusal |
| [Observability contract](observability-contract.md) | Planned runtime contract | Correlation, structured operational events, diagnostic access, and application of redaction to operational events |
| [Versioning and compatibility contract](versioning-compatibility-contract.md) | Current schema-version owner and planned product compatibility contract | Current staged schema versions; planned API/adapter evolution; forward migration; downgrade by restore; and evidence-bound support claims |
| [v0.1 compatibility evidence matrix](../compatibility/v0.1.md) | Non-normative evidence view | Recorded evidence, gaps, and claim status for v0.1 targets; never a source of compatibility policy |
| [Threat model](../security/threat-model.md) | Current Phase 1 security subset and planned later contract | Assets, actors, trust boundaries, abuse cases, implemented registry/authorization/application mitigations, residual risks, negative-test obligations, and later-runtime non-claims |
| [Privacy and logging contract](../security/privacy-and-logging.md) | Current Phase 1 audit subset and planned later contract | Data classes, implemented sanitized application audit, prompt and secret handling, planned operational logging/retention/diagnostic disclosure, and default no telemetry |
| [Validation policy](validation-policy.md) | Current validation owner | Impact routing, binary evidence records, and repository gates |

## How other documents use the inventory

Architecture entry points and ADRs may explain rationale and link to an owner.
They must not become a second mutable copy of an owned state set, schema,
protocol, permission rule, security rule, compatibility policy, or validation
gate. The current repository rule is in
[Repository governance](repository-governance.md#single-authoritative-owner).
