# Repository governance

This file governs work on this source repository. Product-runtime semantics are
owned by the files in the
[contract ownership inventory](contract-ownership.md); this file does not
define a runtime Task state, database schema, dispatch protocol, or adapter
behavior.

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

A schema, version, path rule, state transition, permission rule, or protocol has
one authoritative contract and one implementation owner. The
[contract ownership inventory](contract-ownership.md) locates those owners.
Interfaces, adapters, ADRs, plans, examples, and evidence consume an owner
rather than copying its mutable rules.

An owner may delegate a check to another owner by linking to it. A summary or
evidence table does not acquire normative authority, and a conflict is a failed
governance condition rather than permission to choose either copy.

## State, plans, evidence, and authorization

Task state, a development plan, a validation result, an audit record, and user authorization answer different questions. None substitutes for another.

In particular, readiness or plan approval does not imply permission for network access, secret access, push, pull-request creation, merge, release, deployment, artifact pruning, or destructive cleanup.

The runtime grant model and runtime pre-mutation checks are defined only by the
[authorization contract](authorization-contract.md). Repository-development
authorization continues to follow `AGENTS.md` and the user's current request.

## Task-owned scope

Every change identifies its owned paths and resources. Preserve pre-existing, dirty, generated, ignored, untracked, and out-of-scope content. Cleanup is valid only for resources whose ownership and current identity can be verified.

The repository's ignored `.local/` tree is local planning or working data. It
is not a public contract, required contributor input, validation substitute, or
commit candidate. A plan may cite the existence of local evidence without
copying private contents into a committed contract.

## External actions

Local edits, commits, pushes, pull requests, merges, releases, deployments, and cleanup are separate actions. Authorization for one does not automatically authorize the next.

The repository's two standing exceptions are owned by the
[local agent Git workflow](local-agent-git-flow.md). A coordinator-managed
maintainer task may invoke the exact manifest-bound, pathless
`prune-artifacts` transition described there after its result commit,
including for nonempty task scratch, and may perform the exact ordinary
`origin/master` push after gated FF-only integration. These are explicit,
narrow, independently revocable grants, not inferences from task state, plan,
commit, or validation. Neither grant authorizes coordinator `cleanup`, and no
adjacent action inherits either grant.

Partial external success is recorded as actual state. A mid-prune stop may
leave part of the exclusive artifact namespace removed without a receipt; the
same frozen-root operation is re-inventoried and retried rather than described
as rollback. Do not use reset, force, unrelated deletion, or rewritten history
to pretend that a partially completed transition rolled back atomically.

## Fail-closed rule

For work on this repository, do not continue a mutation when the acting user's
authorization, repository identity, canonical task-owned path, current Git
state, or resource ownership is uncertain. Do not infer permission from a plan,
test result, audit, prior commit, or adjacent authorized action.

Runtime fail-closed decisions are not defined here. They belong to the
[authorization contract](authorization-contract.md), with semantic evidence
provided by the linked domain, reliability, and workspace owners.

## Maintainer automation

Maintainer-only skills may automate audits and planning. Public behavior, contribution requirements, and required validation remain expressible through repository documentation, scripts, tests, and CI without those skills.

## External project boundary

External repositories may be used for dogfood through explicit adapters and local policy configuration. Their domain rules, absolute paths, private instructions, exact validation commands, and unmerged proposals do not become generic core contracts.

Reading or mutating an external repository requires authorization independent
of readiness, implementation approval, a local commit, or an adapter's
technical ability to perform the action.
