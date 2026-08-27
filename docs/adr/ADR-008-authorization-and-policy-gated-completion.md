# ADR-008: Authorization and policy-gated completion

**Status:** Accepted

This is an accepted design requirement for future work, not a statement that authorization checks, project policies, review gates, or completion automation are implemented today.

## Context

A task can be structurally ready while an actor still lacks permission to mutate a resource. Likewise, an execution result does not prove that project-specific validation, review, or integration requirements are satisfied. Collapsing those facts would turn readiness or backend success into unintended authority.

## Decision

Keep domain readiness, explicit authorization, project policy, validation evidence, and completion as separate decisions. Every mutation must pass the owned authorization and policy gates against current resource identity, and completion must consume fresh evidence bound to the applicable project state. Exact grants, checks, gate identity, and freshness rules belong only to their live owners.

## Consequences

- Ready tasks may legitimately remain unexecuted or incomplete when authority or policy evidence is absent.
- Interfaces and adapters cannot infer permission from an approved plan, successful validation, or backend outcome.
- Project-specific requirements enter through policy and completion ports rather than generic-core conditionals.

## Alternatives

- Treating task eligibility as execution authorization was rejected because it broadens permission without an actor grant.
- Treating backend success as task completion was rejected because policy and evidence may still be unsatisfied.
- Embedding one repository's review workflow in the generic state machine was rejected because it would make project policy a core special case.

## Authoritative contract

The [authorization contract](../reference/authorization-contract.md) solely owns grants and pre-mutation fail-closed decisions. The [completion and workspace contract](../reference/completion-workspace-contract.md) owns completion-gate identity and freshness. The [domain contract](../reference/domain-contract.md) owns readiness, and the [adapter contracts](../reference/adapter-contracts.md) own policy and completion port shapes.

## Required validation

Authorization, negative-path, policy, completion, and evidence-freshness routes are owned by the [validation policy](../reference/validation-policy.md). No permission or completion guarantee follows from this ADR without those implementations and gates.
