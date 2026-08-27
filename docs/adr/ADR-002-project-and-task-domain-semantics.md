# ADR-002: Project and Task domain semantics

**Status:** Accepted

This is an accepted design requirement for future work, not a statement that Project or Task runtime behavior is implemented today.

## Context

Task orchestration needs a stable domain model that does not change when persistence, execution, Git, or user-interface adapters change. Parent/child organization, prerequisite relationships, lifecycle state, and dispatch eligibility answer different questions and must not be improvised independently by each interface.

## Decision

Adopt a project-bound Project/Task domain core. Model parent hierarchy separately from the dependency graph, and place lifecycle, cycle prevention, eligibility, waiting classification, and task revision semantics in that core rather than in SQLite, Codex, Git, CLI, or MCP adapters. The exact states, transitions, predicates, and revision rules are defined only by the live domain owner.

## Consequences

- Interfaces and adapters must invoke the domain owner instead of reproducing its rules.
- Later domain work must prove hierarchy, graph, transition, and eligibility behavior independently of infrastructure.
- This ADR selects the model boundary but does not itself define a runnable state machine.

## Alternatives

- Combining parent hierarchy and dependencies into one edge type was rejected because navigation and execution prerequisites have different semantics.
- Defining task rules in repository queries or CLI commands was rejected because those copies would diverge.
- Allowing adapters to invent backend-specific task states was rejected because adapter outcomes must map into the shared domain contract.

## Authoritative contract

The [domain contract](../reference/domain-contract.md) is the sole owner of Project binding, Task states and transitions, terminal behavior, hierarchy, dependency and cycle rules, eligibility, waiting taxonomy, and task revision. [ARCHITECTURE.md](../../ARCHITECTURE.md) owns the dependency direction around that domain.

## Required validation

The domain and state-machine evidence route is owned by the [validation policy](../reference/validation-policy.md). A later implementation must supply the required targeted, property, and state-machine evidence before these semantics may be described as implemented.
