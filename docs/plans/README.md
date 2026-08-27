# Development plan lifecycle

Repository development plans are governance artifacts. They are not runtime tasks and their lifecycle does not extend the product Task state machine.

## States

- `proposal`: a design or execution approach that has not been accepted as current work.
- `active`: an accepted, self-contained plan being implemented.
- `completed`: historical evidence describing work that was completed and validated.

Create state directories only when the first plan of that state is added. A plan must state its status explicitly and must not be cited as proof of current capability without matching implementation and validation.

When work is explicitly ordered as a plan chain, a predecessor reaches its terminal local commit before the successor is created or activated. The successor records and validates the predecessor relationship; a ready review or completed working-tree diff is not a substitute for that commit.

## When a plan is expected

A self-contained plan is appropriate for material changes to architecture, contracts, data semantics, persistence, concurrency, permissions, security, destructive operations, compatibility, or irreversible external state.

Ordinary documentation corrections and small, local implementation changes do not require ceremony merely because they can be listed as steps.

## Required content

An active high-risk plan should include:

- Objective and non-goals.
- Current evidence and authoritative references.
- Affected owners and invariants.
- Authorization boundaries.
- Exact implementation milestones.
- Impact-based validation and binary acceptance gates.
- Recovery or rollback strategy where meaningful.
- Decisions, discoveries, and resulting evidence.

Maintainer skills may help create or audit a plan, but the plan remains understandable and executable without those skills.

## Evidence and terminal persistence

Validation records identify the command or review method, a binary criterion, the actual result, and the repository state they evaluated. Independent activation and implementation reviews remain separate from the implementer and from parent disposition.

If a plan requires a terminal commit, completion readiness is checked before staging, the staged inventory contains only task-owned paths, and the completed plan is included in that commit. Commit authorization never implies push or any later external action.
