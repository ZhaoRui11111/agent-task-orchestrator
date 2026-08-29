# Toolchain feasibility record

This is a non-normative evidence record for EP-00B. The current rules and
commands are owned by the [toolchain contract](../reference/toolchain-contract.md).

## Candidate material state

The candidate selects Node.js `24.19.0`, pnpm `11.19.0`, TypeScript `5.9.3`,
ESM/`NodeNext`, a package-root library export, and an `ato` console binary. It
contains no product runtime behavior and no production dependency.

The user-authorized official-registry resolution produced a frozen lockfile and
a worktree-local cache for exact TypeScript `5.9.3` with lifecycle scripts
disabled. A clean disposable install then consumed that cache with
`--offline --frozen-lockfile`, and the packed consumer verified the package
export, `ato` console entry, and uninstall boundary.

The current package-smoke procedure creates its unique disposable consumer and
pack generation beneath `.task-artifacts/`, while the reusable `.pnpm-store/`
cache remains outside the coordinator-prunable policy. The tool removes only
its creator-owned generation and never treats the store or build output as
disposable coordinator material.

On 2026-08-28 the post-A1 candidate `pnpm verify:offline` command exited `0`
using a separately frozen offline compiler install, including lint, typecheck,
build, 18 Node tests, documentation, dependency policy, the
package smoke test, the real Windows SQLite matrix, and the blocked/no-claim
Codex boundary. The separately authorized production audit against
`https://registry.npmjs.org/` also exited `0` with no known vulnerability.
Details and non-passing historical attempts are retained in the
[EP-00B evidence log](../plans/evidence/EP-00B/validation-evidence.md).
These are candidate feasibility observations, not a product release, hosted-CI
result, or support claim. Terminal state binding lives in the ExecPlan.

## Reproduction

From an EP-00B checkout on the recorded Windows environment:

```powershell
pnpm install --frozen-lockfile --ignore-scripts --store-dir=.pnpm-store --registry=https://registry.npmjs.org/
pnpm verify:offline
pnpm dependency:audit
```

The first and last commands can require registry access. A blocked or skipped
network operation is not a pass. Hosted CI status is also unverified until an
actual run is observed; the committed workflow is only a skeleton.
