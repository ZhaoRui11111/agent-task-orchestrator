# Contract ownership inventory

This page is an inventory, not a semantic contract. The subject column only
helps readers find the file that defines a rule; it does not restate or modify
that rule. Follow the linked owner for normative language.

The repository has a governance and architecture-contract baseline, a minimal
executable toolchain and feasibility harness, an implemented Domain Core, and
implemented Phase 1 ProjectRegistry, local authorization, application service,
current schema-version-1 persistence, a versioned local product CLI, typed product facade,
reliable Manual execution loop, package-private non-composed Codex SDK backend,
reconcile-first Manual dispatcher, and a pure/
durable workspace foundation with a test Fake plus an exported, product-unwired
Windows Git backend, plus an injected Phase 3 product-library facade with exact
ProjectPolicy, completion, integration, and workspace-v2 ports and local
adapters. Entries marked "planned runtime contract" or a
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
| [Persistence contract](persistence-contract.md) | Current implemented foundation and future schema owner | Current SQLite runtime root, single current baseline, Phase 1 metadata/Domain/ProjectRegistry/authorization/application storage, execution attempts/sequences, Manual-loop and package-private Codex evidence/journals, Manual completion, explicit-Manual dispatcher, workspace, policy/gate/completion/integration/cleanup records, ingress, connections, transactions, backup/restore and corruption handling; product facades create no second writer; future tables require their own approved schema change |
| [Reliability protocol](reliability-protocol.md) | Current Manual/Codex-loop, dispatcher, workspace/Phase-3 product-library and planned later-runtime contract | Implemented claim semantic identity, attempts, leases, fencing, idempotency, intent/observation/receipt/finalization, Manual/package-private-Codex/gate/workspace/integration recovery and CAS, dispatcher fan-out, policy-gated completion, integration partial-success classification, owned cleanup, and typed product derivation; product-wired Codex, scheduler, and external-service publication remain planned |
| [Authorization contract](authorization-contract.md) | Current local authorization contract | Trusted bootstrap and identity, nineteen base, four claim-foundation, six Manual-loop, one dispatcher, five workspace, and twelve Phase 3 actions; explicit one-step non-grantable capability upgrades through versions 1 to 6; grants/epochs, narrowing policy, high-risk confirmations, lifecycle/effect handoff, and fail-closed application/dispatcher/workspace/Phase-3 product-library decisions; no authority for absent product routes or external services |
| [Adapter contracts](adapter-contracts.md) | Current Execution/Manual/Codex/ProjectPolicy/completion/integration/workspace contract | Implemented exact `ato.execution/v2`, `ato.project-policy/v1`, `ato.completion/v1`, `ato.integration/v1`, and `ato.workspace/v2`; production local Manual, package-private non-composed Codex SDK, policy, gate, Git-integration, and Windows Git workspace adapters; test-only Fakes; current operation envelopes, receipts, and error taxonomies; scheduler and product/CLI Codex/Phase 3 composition remain absent |
| [Scheduler contract](scheduler-contract.md) | Current Manual-dispatch subset and planned scheduler contract | Implemented explicit-Manual reconcile-first run, ownership/takeover and worker-death recovery; planned SchedulerBackend, duplicate scheduled delivery, missed-trigger, cadence, and clock/config behavior |
| [Completion and workspace contract](completion-workspace-contract.md) | Current Phase 3 completion/workspace/integration contract | Implemented gate identity/freshness, policy-gated completion, integration reservation and Git partial-success recovery, isolated workspace identity/status/recovery, Windows worktree creation, ownership manifest, authoritative inspection, and attestation-bound owned cleanup; default CLI wiring and platform support remain absent |
| [Observability contract](observability-contract.md) | Current bounded durable/display subset and planned runtime contract | Current durable application/Manual/package-private-Codex/dispatcher/workspace/policy/gate/completion/integration/cleanup records and closed current-v1 summaries; planned general operational event sink, diagnostic access, and broader redaction pipeline |
| [Versioning and compatibility contract](versioning-compatibility-contract.md) | Current schema/API/port-version owner and planned product compatibility contract | Current schema-version-1 identity, sole current `ato.api/v1`, closed `ato.execution/v2`, `ato.project-policy/v1`, `ato.completion/v1`, `ato.integration/v1`, and `ato.workspace/v2`, the authorized fresh-only development resets, future evolution, restore boundaries, and evidence-bound support claims |
| [v0.1 compatibility evidence matrix](../compatibility/v0.1.md) | Non-normative evidence view | Recorded evidence, gaps, and claim status for v0.1 targets; never a source of compatibility policy |
| [Threat model](../security/threat-model.md) | Current local security subset and planned later contract | Assets, actors, trust boundaries, abuse cases, implemented registry/authorization/application/Manual-loop/package-private-Codex/dispatcher/workspace/Phase-3 local-library mitigations, residual risks, negative-test obligations, and later-runtime non-claims |
| [Privacy and logging contract](../security/privacy-and-logging.md) | Current durable-record/audit/display subset and planned later contract | Data classes, implemented sanitized Phase 1, Manual-loop, package-private Codex, dispatcher, workspace/policy/gate/completion/integration/cleanup evidence, current product projections, prompt and secret handling, planned operational logging/retention/diagnostic disclosure, and default no telemetry |
| [Validation policy](validation-policy.md) | Current validation owner | Impact routing, binary evidence records, and repository gates |

## How other documents use the inventory

Architecture entry points and ADRs may explain rationale and link to an owner.
They must not become a second mutable copy of an owned state set, schema,
protocol, permission rule, security rule, compatibility policy, or validation
gate. The current repository rule is in
[Repository governance](repository-governance.md#single-authoritative-owner).
