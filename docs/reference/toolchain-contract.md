# Toolchain contract

This file is the sole normative owner of the repository's current executable
toolchain, package boundary, and repeatable validation entry points. It does
not define a product runtime, domain behavior, persistence schema, adapter, or
support promise.

## Frozen toolchain

The repository uses:

- Node.js `24.19.0`, selected by `.node-version` and the exact
  `package.json#engines.node` value;
- pnpm `11.19.0`, selected by the exact `packageManager` and
  `engines.pnpm` values; and
- TypeScript `5.9.3` as the only development dependency, with no production
  dependencies.

`pnpm-lock.yaml` is required and must resolve that exact TypeScript version
with registry integrity metadata. Dependency lifecycle scripts are disabled
for installation and are prohibited in this package. Automatic dependency
repair before a package script is disabled: installation is an explicit step,
so an offline validation command cannot silently become a registry operation.
The repository-local pnpm store and all installed or generated material remain
ignored. Dependency resolution and the advisory query use only
`https://registry.npmjs.org/`;
changing that registry is an authorization and dependency-policy change, not a
local convenience override.

## Module and distribution boundary

The package is private by default and uses Node ESM with TypeScript
`NodeNext` resolution. Build output targets `dist/` and contains declarations
and source maps. The normal library entry is the package root export, and the
normal console entry is the `ato` package binary. A package smoke test must
first reproduce the frozen dependency install in an empty disposable project
and generation-local store, then pack the declared distribution, install it
into a disposable consumer without registry access, import the library entry,
and invoke the console entry.

The current `src/` tree is intentionally limited to a toolchain status value
and a matching console projection. It must not acquire Phase 1 domain,
application, persistence, dispatcher, port, adapter, scheduler, MCP, or
orchestrator behavior as part of this scaffold.

## Validation entry points

The following package scripts are the public local entry points:

| Command | Current responsibility |
| --- | --- |
| `pnpm lint` | Repository hygiene, frozen configuration, source-boundary, and diff checks |
| `pnpm typecheck` | Strict TypeScript checking without output |
| `pnpm build` | Produce the ESM package and declarations |
| `pnpm test` | Run the Node test suite, including real local feasibility contracts |
| `pnpm docs:check` | Resolve exact-case repository-relative Markdown links and reject forbidden evidence artifacts |
| `pnpm dependency:check` | Verify the frozen dependency and lockfile shape without using the network |
| `pnpm package:smoke` | Pack and consume the declared package boundary offline |
| `pnpm spike:sqlite` | Run the local Windows SQLite feasibility procedure |
| `pnpm spike:codex` | Check the recorded Codex public-contract evidence and core isolation boundary |
| `pnpm verify:offline` | Run every local gate above that does not require a registry vulnerability query |
| `pnpm dependency:audit` | Query the configured package registry vulnerability service for production dependencies |

`pnpm install --frozen-lockfile --ignore-scripts --store-dir=.pnpm-store
--registry=https://registry.npmjs.org/` followed by `pnpm verify:offline` is
the local equivalent of the committed Windows CI skeleton before its separate
online audit step. The explicit flags keep linked-worktree execution inside the
checkout even when package-manager project config discovery differs from a
normal root checkout. A command is evidence only for the exact material state
and environment on which it ran.

## CI and dependency maintenance

`.github/workflows/ci.yml` is a least-privilege Windows skeleton that installs
the frozen toolchain, performs a frozen install, runs the local-equivalent
gate, and then runs the separately network-dependent audit. Its presence does
not prove that hosted CI has run successfully.

`.github/dependabot.yml` requests weekly npm-ecosystem updates. An update is a
candidate change, not an approval: it must preserve the exact-version policy,
be reviewed, and pass all impact-selected validation. Dependency
vulnerabilities are reported through the private path in `SECURITY.md`.
Neither an online audit nor an update service may be described as passed when
network access or hosted execution was not available.

## Data and evidence boundary

Runtime databases, WAL or SHM files, logs, backups, package archives,
repository-local dependency stores, installed dependencies, prompts, personal
paths, thread or execution identifiers, credentials, and temporary spike
artifacts must not enter the committed inventory. Feasibility records contain
only sanitized environment dimensions and reproducible procedures.
