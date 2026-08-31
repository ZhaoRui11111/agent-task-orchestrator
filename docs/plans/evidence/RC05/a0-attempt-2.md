# RC05 A0 attempt 2

## Status

This fresh independent read-only schema-v3 A0 completed with one confirmed
MEDIUM finding and readiness `requires_revision`. It is preserved as
superseded review history after the parent accepted the finding and revised
only the exact per-file Node built-in mapping and its binary validation.

The reviewer did not draft or revise the proposal, enumerate its scope,
implement RC05, run tests, edit repository content, mutate Git/index/ref,
coordinator, runtime or external state, grant authority, or inherit attempt
1's conclusion. Attempt 1 was treated only as preserved history.

## Exact review identity

- Reviewer: `/root/rc01_a0_repeat`
- Reviewed at: `2026-09-01 05:16:20+08:00`
- Material base/HEAD: `ad67d059a3fc21d94fa775669a7d0efaa7d8b4c6`
- Reviewed state: `git-sha1:bcdb586caf841c47f945b761bad031b9dd1a33dc`
- Canonical approval bytes: `20,981`
- Approval SHA-256: `470974E49964064BAE2B445FBFF06ACBCBB47DA71682D36FCC1B03CC71ED3BB9`
- Trace invocations: exactly one
- Trace result: `ok=true`, `errors=[]`, `warnings=[]`, `outside_scope=[]`,
  `overlap=[]`, `pre_existing_dirty=[]`; the proposal and attempt-1 evidence
  were the only task-owned untracked material.

## Confirmed baselines

The review confirmed the pushed RC04 base; all 35 unique task paths; closure
of F-RC05-A0-001 by exact Application and CLI adjacency predicates; exact
Application facade four-runtime/sixteen-type and CLI facade
five-runtime/four-type exports; 33 commands and 37 public errors; the twelve
historical unused roots with only `readDomainInitialized` already removed by
RC04; the current 75 diagnostics as eleven survivors plus 64 RC04
extraction-only imports; and exact 34/136 current plus 43/172 target source and
package inventories. No test or mutation-capable command was run.

## Finding

### F-RC05-A0-002 — MEDIUM — contract gap

C4 and C6 require `src/cli.ts` to remain byte-identical, and that current
entrypoint imports `node:path` and `node:url`. V8 nevertheless said only the
physical parser/runtime modules use the existing built-in set. C9 preserved
only the aggregate `node:crypto`/`node:path`/`node:url` set, while the current
`scripts/repo-utils.mjs` exception jointly permits all three for both
`src/cli.ts` and `src/cli-api.ts`. The intended gate was therefore either
unsatisfiable against the unchanged entrypoint or too broad to reject an
incorrect mapping.

The minimum repair is to require exact per-file equality: unchanged
`src/cli.ts` may import only `node:path` and `node:url`;
`src/cli-api-parser.ts` may import only `node:path`;
`src/cli-api-runtime.ts` may import only `node:crypto`; and model,
presentation and facade import no Node built-in. `scripts/repo-utils.mjs` and
the architecture test must reject every wildcard or shared family exception.

## Parent disposition

The parent independently confirms the current imports and allowlist conflict.
C9 and V8 now freeze the exact mapping above and bind validation to set
equality without changing any deliverable, path, authority or product
behavior. Fresh independent A0 is required before activation.
