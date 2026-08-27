# Repository governance

## Authority chain

The repository uses this human-to-detail authority chain:

```text
README.md
  -> AGENTS.md
    -> ARCHITECTURE.md
      -> docs/README.md
        -> docs/reference/*
```

Each layer links to more detailed authority. A lower layer must not silently broaden permissions or contradict a higher layer.

## Capability truthfulness

Current capabilities, non-goals, proposals, active work, completed plans, superseded attempts, and immutable snapshots are different records.

- Current documentation describes only implemented and validated behavior.
- Proposals are labeled as proposals.
- Completed plans remain historical evidence and are not rewritten to hide a live finding.
- Superseded evidence remains distinguishable from current evidence.
- Immutable snapshots are replaced by a new snapshot or an explicit erratum, not edited in place.

## Single authoritative owner

A schema, version, path rule, state transition, permission rule, or protocol has one authoritative contract and one implementation owner. Interfaces and adapters consume that owner rather than copying its business rules.

## State, plans, evidence, and authorization

Task state, a development plan, a validation result, an audit record, and user authorization answer different questions. None substitutes for another.

In particular, readiness or plan approval does not imply permission for network access, secret access, push, pull-request creation, merge, release, deployment, or destructive cleanup.

## Task-owned scope

Every change identifies its owned paths and resources. Preserve pre-existing, dirty, generated, ignored, untracked, and out-of-scope content. Cleanup is valid only for resources whose ownership and current identity can be verified.

## External actions

Local edits, commits, pushes, pull requests, merges, releases, deployments, and cleanup are separate actions. Authorization for one does not automatically authorize the next.

Partial external success is recorded as actual state. Do not use reset, force, deletion, or rewritten history to pretend that a partially completed external transition rolled back atomically.

## Fail-closed rule

Do not continue a mutation when actor identity, repository identity, canonical path, expected revision, fencing token, receipt freshness, resource ownership, or authorization is uncertain.

## Maintainer automation

Maintainer-only skills may automate audits and planning. Public behavior, contribution requirements, and required validation remain expressible through repository documentation, scripts, tests, and CI without those skills.

## External project boundary

External repositories may be used for dogfood through explicit adapters and local policy configuration. Their domain rules, absolute paths, private instructions, exact validation commands, and unmerged proposals do not become generic core contracts.
