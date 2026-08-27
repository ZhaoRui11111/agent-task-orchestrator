# Development plan lifecycle

Repository development plans are governance artifacts. They are not runtime tasks and their lifecycle does not extend the product Task state machine.

## States

- `proposal`: a design or execution approach that has not been accepted as current work.
- `active`: an accepted, self-contained plan being implemented.
- `completed`: historical evidence describing work that was completed and validated.

Create state directories only when the first plan of that state is added. A plan must state its status explicitly and must not be cited as proof of current capability without matching implementation and validation.

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
