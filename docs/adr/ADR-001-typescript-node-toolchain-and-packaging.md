# ADR-001: TypeScript/Node toolchain and packaging

**Status:** Accepted

This is an accepted design requirement for future work, not a statement that a toolchain, package, executable, or supported runtime exists today.

## Context

The planned product needs one implementation language and packaging direction that can support typed contracts, command-line delivery, testable module boundaries, and the intended Windows operating environment. Leaving the choice implicit would let successive plans establish incompatible build and distribution conventions.

## Decision

Use TypeScript on Node.js for the executable product and deliver it through an explicit, versioned Node package. Package boundaries must follow the repository's domain, application, persistence, ports, adapters, and interfaces direction. Exact runtime versions, package metadata, build settings, exports, and support claims are intentionally deferred to their implementation owners and evidence.

## Consequences

- The toolchain feasibility plan must establish the package and executable validation before any runtime capability is claimed.
- Typed boundaries become the default for product code, while generated or third-party artifacts remain subordinate to the owned contracts.
- A supported Node or operating-system range cannot be inferred from this ADR alone.

## Alternatives

- Unversioned JavaScript scripts were rejected because they would not establish the intended typed contract boundary.
- Choosing multiple first-class runtime stacks was rejected because it would duplicate packaging and validation ownership during bootstrap.
- Treating a local development command as a distributable package was rejected because development convenience is not compatibility evidence.

## Authoritative contract

[ARCHITECTURE.md](../../ARCHITECTURE.md) owns module direction and dependency constraints. The [versioning and compatibility contract](../reference/versioning-compatibility-contract.md) owns runtime and platform support claims. Future package metadata and toolchain configuration will become implementation owners only when introduced by a reviewed implementation plan.

## Required validation

The applicable evidence routes and capability-claim gate are owned by the [validation policy](../reference/validation-policy.md). Until the toolchain, package, compile checks, and operating-system evidence required there exist, this decision remains unimplemented.
