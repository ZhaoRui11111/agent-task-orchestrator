# Toolchain contract

This file is the sole normative owner of the repository's current executable
toolchain, package boundary, and repeatable validation entry points. It does
not define the Domain Core's behavior, authorization semantics, persistence
semantics, product CLI behavior, an execution runtime, adapter, or support
promise. Domain, authorization, persistence, and CLI behavior are owned by the
[domain contract](domain-contract.md),
[authorization contract](authorization-contract.md),
[persistence contract](persistence-contract.md), and
[CLI/API contract](cli-contract.md), respectively.

## Frozen toolchain

The repository uses:

- Node.js `24.19.0`, selected by `.node-version` and the exact
  `package.json#engines.node` value;
- pnpm `11.19.0`, selected by the exact `packageManager` and
  `engines.pnpm` values; and
- TypeScript `5.9.3` as the only development dependency, with no production
  dependencies.

The TypeScript configuration keeps strict checking and natively enables both
`noUnusedLocals` and `noUnusedParameters`. Repository lint verifies those
options remain enabled; unused declarations or imports must be removed at
their owner rather than hidden by dummy reads, renaming, suppression, or broad
exports.

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

Creator-owned package and SQLite validation generations live only beneath the
ignored `.task-artifacts/` root registered by the
[local agent Git workflow](local-agent-git-flow.md). Each tool creates a unique
direct child after one root `mkdir` attempt, accepts only `EEXIST` as the
concurrent stable-root case, and immediately binds the created child's regular
directory identity and real path before any post-issue seam. It then revalidates
the root and that exact child identity without following links; replacement of
either fails closed with original and replacement content preserved. A worker
removes only its owned child and never removes the shared root. Child cleanup
atomically moves the receipt-bound child to a unique same-root quarantine,
verifies the moved identity, and revalidates every inventoried member before a
same-parent rename-and-delete boundary; identity drift fails closed with
replacement content preserved. After its single-process generation boundary is
quiescent, package smoke may separately contract the exact fixed root only when
it is a regular empty directory. SQLite has that authority only as a standalone
invocation after its worker threads and generation are quiescent. A SQLite
process nested in any native Node test context removes its generation but
defers fixed-root contraction to the outer test runner, whose complete child
exit establishes global native-test quiescence.
Unexpected inspection or removal errors propagate. `.pnpm-store/`,
`node_modules/`, `dist/`, runtime data, and user data remain outside the
registered disposable-root policy.

The two Node test scripts share `scripts/test-runner.mjs`. Before spawning
native `node --test` discovery directly without a shell, the runner captures a
path-based metadata snapshot of the `.task-artifacts` root and recursively
inventoried regular members. It performs a terminal equality check only when
the child test process succeeds. Addition, removal, replacement, identity
drift, or a statically observed reparse node makes the overall command fail
without deleting anything. A failed child process retains its own failure and
may leave diagnostics for the final explicit coordinator prune; a later
successful command must add no further residue but need not erase that prior
baseline.

The snapshot comparator itself is observation-only. Separately, when and only
when the baseline root was absent and the complete child process exits
successfully, the parent runner contracts the exact fixed `.task-artifacts`
root after child quiescence if it is still regular and empty, then performs the
terminal comparison. An absent root needs no action, a nonempty root is not
deleted, and a custom observed path is never a reclamation target. A failed
child bypasses this contraction and retains diagnostics.

The assertion assumes the test process and any child that could mutate the
tree are quiescent before the terminal observation. It is not handle-bound
against concurrent Windows path replacement and is neither a security boundary
nor a prune receipt. Those guarantees remain solely with the coordinator's
independent frozen-inventory validation and anchored deletion transition.
The fixed-root contraction is path-based operational hygiene under the same
quiescence assumption; it publishes no security or prune receipt and does not
authorize or replace coordinator prune.
The wrapper-owned child marker distinguishes its native test-loader child from
an ambient `NODE_TEST_CONTEXT`; a direct runner with an unowned context exits
nonzero rather than silently bypassing the suite. For nested SQLite, any present
`NODE_TEST_CONTEXT` conservatively removes contraction authority; fabricating
the marker therefore cannot grant deletion authority.

## Module and distribution boundary

The package is private by default and uses Node ESM with TypeScript
`NodeNext` resolution. Build output targets `dist/` and contains declarations
and source maps. The normal library entry is the package root export, and the
normal console entry is the `ato` package binary. A package smoke test must
first reproduce the frozen dependency install in an empty disposable project
and generation-local store, then pack the declared distribution, install it
into a disposable consumer without registry access, typecheck the public
  declarations without undeclared Node type dependencies, import the library
  entry, exercise trusted bootstrap plus Project/Task commands, three sequential
  explicit capability upgrades through vocabulary version 4 followed by the
  fourth confirmed upgrade to vocabulary version 5, an atomic
  execution claim, the local Manual start/inspect/outcome/finalization/
  completion library loop after restart, the typed product facade's Manual
  dispatch-to-completion restart path, and a fresh persistence backup; verify
  the exported reconcile-first dispatcher/product operational surfaces plus the
  pure workspace contract, typed application declarations, and the public
  Windows Git workspace-adapter factory, constants, and narrow configuration
  types without wiring or invoking that adapter through the product; and
  invoke the console entry. The console portion compares source, built, and
  packed-installed CLI behavior for omitted and explicit current `ato.api/v1`
  JSON/human responses, retired-major refusal, invalid input, public exits, and
  absence of read-only doctor side effects. Packed declarations must contain one
  product API major, one public error table/type, the current schema-1
  backup/restore declarations, and no synthetic scaffold/capability-status
  registry.

The package-root library export is the explicit operational facade. It exposes
the pure TypeScript Domain Core including its canonical cancellation-reason predicate,
ProjectRegistry identity owner, finite authorization
owner, typed Phase 1 and claim application services, the pure execution port
  kit, production local Manual backend/control, reliable execution loop,
reconcile-first Manual dispatcher, the pure workspace port kit and typed
durable workspace application service, the exported product-unwired Windows
Git workspace adapter, typed local product facade, current schema-version-1
persistence foundation, local lifecycle surfaces, and versioned product CLI
API; it does not maintain a parallel hand-synchronized capability-status
registry. The packed inventory includes the
single immutable SQL file under `migrations/`. The source and compiled migration
registry consume either a uniform LF or CRLF transport of that file and
reconstruct the same frozen canonical bytes before checksum
verification and execution. `.gitattributes` declares an explicit historical
checkout EOL for the shipped baseline; a future migration requires its own
reviewed registry identity and per-file attribute rather than inheriting a
wildcard. The `ato` console is the local Phase 1 and explicit-Manual Phase 2
product CLI defined by the
[CLI/API contract](cli-contract.md).

Production source is exactly these 46 files:

- `src/index.ts`, `src/domain.ts`, `src/cli.ts`, `src/cli-api.ts`,
  `src/cli-api-model.ts`, `src/cli-api-parser.ts`,
  `src/cli-api-presentation.ts`, `src/cli-api-runtime.ts`,
  `src/project-registry.ts`, and `src/authorization.ts`;
- `src/application.ts`, `src/application-model.ts`,
  `src/application-input.ts`, `src/application-policy.ts`,
  `src/application-domain.ts`, `src/application-service.ts`,
  `src/execution-application.ts`, `src/execution-port.ts`,
  `src/execution-loop.ts`, `src/manual-execution-backend.ts`,
  `src/dispatcher-application.ts`, `src/dispatcher.ts`,
  `src/workspace-port.ts`, `src/workspace-application.ts`,
  `src/workspace-git-adapter.ts`,
  `src/node-builtins.d.ts`, and `src/product-runtime.ts`;
- `src/persistence/application-repository.ts`,
  `src/persistence/application-repository-model.ts`,
  `src/persistence/application-repository-readers.ts`,
  `src/persistence/application-repository-digest.ts`,
  `src/persistence/application-repository-state.ts`,
  `src/persistence/application-repository-lifecycle.ts`,
  `src/persistence/application-repository-transaction.ts`,
  `src/persistence/backup.ts`, `src/persistence/database.ts`,
  `src/persistence/doctor.ts`, `src/persistence/errors.ts`,
  `src/persistence/index.ts`, `src/persistence/local-ingress.ts`,
  `src/persistence/manual-backend-repository.ts`,
  `src/persistence/migrations.ts`, `src/persistence/repository.ts`,
  `src/persistence/runtime.ts`, `src/persistence/store.ts`, and
  `src/persistence/values.ts`.

`node:sqlite` is confined to the persistence owner. Within the CLI entrypoint
and API family, `src/cli.ts` imports exactly `node:path` and `node:url`, the
parser imports exactly `node:path`, the runtime imports exactly `node:crypto`,
and the model, presentation, and facade import no Node built-in. Other existing
identity, digest, Manual-integrity, filesystem, and SQLite owners retain their
narrow declarations; no shared CLI-family or wildcard built-in exception is
allowed. The Windows Git workspace adapter imports exactly `node:buffer`,
`node:child_process`, `node:crypto`, `node:fs`, `node:path`, and `node:url`; it
uses no shell, package dependency, or wildcard built-in exception. The package
has no production dependency and must not acquire a scheduler, MCP, production
Codex adapter, ProjectPolicy, CompletionBackend/gates, daemon, remote effect,
or external-effect orchestrator as part of this boundary. The Windows Git
adapter remains an explicitly injected library surface with no product/CLI
composition, cleanup, integration, ref mutation, or push route. The Fake
backend remains test-only and absent from the packed inventory.

## Validation entry points

The following package scripts are the public local entry points:

| Command | Current responsibility |
| --- | --- |
| `pnpm lint` | Repository hygiene, frozen configuration, source-boundary, and diff checks |
| `pnpm typecheck` | Strict TypeScript checking without output |
| `pnpm build` | Produce the ESM package and declarations |
| `pnpm test` | Run the Node test suite through the success-only artifact-baseline gate, including Domain, ProjectRegistry, authorization, application/claim/Manual-loop/dispatcher/workspace/product-facade atomicity and security, port/adapter contracts, crash/restart recovery, persistence, versioned CLI, doctor, and real local feasibility contracts |
| `pnpm test:persistence` | Run the targeted current schema-version-1 baseline, repository/decoder, Manual journal/evidence, dispatcher/workspace durable records, concurrency, path-security, backup, restore, and doctor suite through the same artifact-baseline gate |
| `pnpm docs:check` | Resolve exact-case repository-relative Markdown links, validate same-file and cross-file heading fragments, and reject forbidden evidence artifacts |
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
only sanitized environment dimensions and reproducible procedures. A
coordinator artifact-prune receipt is repository-development evidence; it is
not product-runtime persistence, backup, or deletion authority.
