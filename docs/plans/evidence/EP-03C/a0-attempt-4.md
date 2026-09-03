# EP-03C A0 attempt 4 — revision required

Reviewer: `/root/ep03b_a2_1`

Reviewed at: `2026-09-02 22:24:49+08:00`

Reviewed material base: `2485608a1684ea6430adcb8d004979a90d689a69`

Reviewed material state: `git-sha1:f4d2f1205abd3698fabff600f46509f4e90f7a42`

Approval contract: 61,369 canonical UTF-8 bytes, SHA-256 `A14FEAC387C270409AEF8FA1FC4F0E7A1F637A359E0F2264D3E7EBAFBF6AB384`

Independence: fresh independent, non-drafter, non-reviser, non-implementer, strictly read-only, non-fail-fast A0 reviewer. No file, Git, ExecPlan, coordinator, test, build, fixture, ignored-artifact, network, credential, external-repository, `D:\quant`, integration, cleanup, push, release, or deployment mutation was performed.

Scope: complete ExecPlan skill/schema/A0/Tier-2 persistence instructions; repository authority and architecture; complete proposal and A0 attempts 1–3; one valid fresh trace and independent canonical digest; relevant adapter, authorization, completion/workspace, Domain, persistence, reliability, versioning, validation, toolchain, Git-flow, security, and observability contracts; and the current workspace, authorization, Manual completion, ApplicationTransaction, combined reader/digest, migration, package/export, and test inventories.

Evidence: the valid trace was clean at the exact base, HEAD, state, approval byte count, and digest above. The reviewer confirmed the explicit repairs for findings 001–012 are present, including foreign/unknown ambiguity, no-new-effect recovery, and authoritative remote absence. The three remaining findings below prevent a unique, reachable Tier-2 implementation oracle.

Parent disposition: all three findings are confirmed, in scope, and approval-contract material. The proposal remains inactive. The parent will define a mutually exclusive and exhaustive object-observation partition with source/expected preconditions and deterministic precedence; atomically terminalize every authoritatively inspected ambiguous intent before terminalizing its reservation; and define cleanup quiescence to exclude exactly the attestation-bound cleanup intent with fixed issuance/revalidation ordering. This attempt is superseded and another fresh independent A0 is required.

## Findings

### F-A0-EP03C-013 — HIGH — integration equality matrix overlaps and has an authoritative gap

When expected target equals source, identical local observations can mean already-applied or active-preserving refusal; inspect states overlap similarly. When expected remote equals source, the same remote observation can mean pushed, already-pushed, or rejected. Conversely, local expected plus remote source is fully authoritative but matches no legal inspect row.

Minimum closure: require a distinct expected target and source at reservation acquisition, impose source-first deterministic remote classification, make pushed/rejected require expected remote distinct from source, and route every fully authoritative combination outside the three ordered-success rows to one exact inconsistent/foreign terminal-inspect row. Bind mutual exclusivity and exhaustiveness to fixed validation vectors.

### F-A0-EP03C-014 — HIGH — foreign inspection does not terminalize the original ambiguous intent

C18 terminalizes the reservation after `inspected_foreign` but does not define the old effect intent's terminal state or atomic ordering. A higher-fence reservation could therefore coexist with an abandoned nonterminal intent, or that intent could permanently block cleanup.

Minimum closure: atomically advance an authoritatively inspected ambiguous intent through observed and verified to finalized with an exact recovered result before transitioning its reservation to deterministically released or expired. Keep both intent and reservation ambiguous for an unknown inspection, and forbid a higher fence until both old rows are terminal.

### F-A0-EP03C-015 — HIGH — cleanup quiescence counts its own required intent

The cleanup attestation binds an already durable cleanup intent, while its quiescence projection requires zero unfinished workspace intents without excluding that same intent. Counting it makes successful cleanup unreachable; silently excluding it leaves the destructive authorization oracle unspecified.

Minimum closure: exclude exactly the attestation-bound cleanup intent and only while it is the unique same-operation, same-workspace/generation pending intent at issuance or executing intent at point-of-use. Require every other unfinished workspace intent to be absent and freeze prepare, final authorization/attestation issuance, executing transition, pre-effect revalidation, restart, and concurrent-insert order with fixed vectors.
