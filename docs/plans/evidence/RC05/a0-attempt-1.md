# RC05 A0 attempt 1

## Status

This fresh independent read-only schema-v3 A0 completed with one confirmed
MEDIUM finding and readiness `requires_revision`. It is preserved as
superseded review history after the parent accepted the finding and revised
only the exact dependency-graph contract.

The reviewer did not participate in RC05 proposal drafting, scope enumeration,
implementation, or repair. It ran no tests and made no repository, Git,
coordinator, runtime, or external-state mutation.

## Exact review identity

- Reviewer: `/root/rc01_a0_repeat`
- Reviewed at: `2026-09-01T04:54:19+08:00`
- Material base/HEAD: `ad67d059a3fc21d94fa775669a7d0efaa7d8b4c6`
- Reviewed state: `git-sha1:43b42e9291d1072028514c80a3742c93b7cc8e0a`
- Canonical approval bytes: `20,033`
- Approval SHA-256: `5F29F9AE827D7D16822B1E15FAA5CDDF581C714697B174337E3C8778561DEBD7`
- Trace invocations: exactly one
- Trace result: `ok=true`, `errors=[]`, `warnings=[]`, `outside_scope=[]`,
  `overlap=[]`, `pre_existing_dirty=[]`; the proposal was the only task-owned
  untracked path.

## Confirmed baselines

The review confirmed the RC04 pushed chain; the Application facade's exact
four runtime and sixteen type exports; the CLI facade's exact five runtime and
four type exports; the 33-command and 37-error current-v1 inventories; the
43-source and 172-package-entry arithmetic; the one service/runtime effect
owner intent; and the declared non-goals.

## Finding

### F-RC05-A0-001 — MEDIUM — contract gap

C3 described `application-domain` as depending on model plus unspecified
"lower pure helpers" and otherwise stated only layering prose. C5 similarly
described parser, presentation, and runtime layers without a complete internal
edge predicate. V2 and V3 promised to prove those graphs, but materially
different acyclic graphs could satisfy the prose. Implementation and A1 could
therefore accept unintended coupling while claiming the same contract.

The minimum repair is to enumerate the exact required and allowed adjacency for
all five Application and four CLI implementation modules; forbid every other
internal edge, cycle, and facade import; and bind V2/V3 to set equality while
retaining the sole service/runtime effect-owner assertions.

## Parent disposition

The parent confirms the finding. C3 and V2 now require exactly
`input→model`, `policy→model,input`, `domain→model,policy`, and
`service→model,input,policy,domain`. C5 and V3 now require exactly
`parser→model`, `presentation→model`, and
`runtime→model,parser,presentation`. Every other internal edge is forbidden.
Fresh independent A0 is required before activation.
