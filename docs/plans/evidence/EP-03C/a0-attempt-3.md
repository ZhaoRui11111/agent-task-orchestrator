# EP-03C A0 attempt 3 — revision required

Reviewer: `/root/ep03b_a1_1`

Reviewed at: `2026-09-02 21:55:36+08:00`

Reviewed material base: `2485608a1684ea6430adcb8d004979a90d689a69`

Reviewed material state: `git-sha1:c3144aaf116e5049e7c4993e8e049b5f31559ad8`

Approval contract: 58,767 canonical UTF-8 bytes, SHA-256 `5EDF25186C5EAFEE3B99D3CF25DE1A60D7F26F1E6AC1F956C6243D9924C66042`

Independence: fresh independent, non-drafter, non-reviser, non-implementer, strictly read-only, non-fail-fast A0 reviewer. No mutation, test/build/fixture, ignored-artifact, network, credential, external-repository, `D:\quant`, integration, cleanup, push, release, or deployment action was performed.

Scope: complete ExecPlan skill/schema/A0/Tier-2 persistence instructions; repository authority; complete proposal and A0 attempts 1–2; fresh trace and EP-03B chain; relevant authorization, adapter, completion/workspace, Domain, persistence, reliability, versioning, CLI, validation, Git-flow, security, observability, migration, source, package, and test inventories.

Evidence: independent canonicalization reproduced the exact byte count and digest. Trace was clean at the exact base/HEAD and state above; EP-03B terminal, chain, local master and origin tracking agreed. The reviewer confirmed findings 001, 002, 004–006 and 008–010 closed, C20 deterministic, V15 reachable, and the Tier-2 design otherwise complete. Only the two C17/C18/C21 integration receipt/recovery defects below remained.

Parent disposition: both findings are confirmed, in scope, and approval-contract material. The proposal remains inactive. The parent will make every foreign effect observation enter ambiguous/no-new-effect recovery; constrain active retry to named nonforeign authoritative no-effect rows; add an explicit authoritative-absent remote state; and bind every inspect local/remote state to exact expected/source/null equalities. This attempt is superseded and fresh independent A0 is required.

## Findings

### F-A0-EP03C-011 — HIGH — foreign receipt has incompatible reservation outcomes

C18 required unknown or foreign effect observations to make a reservation ambiguous, while C21 classified foreign rows as refused and then generally allowed refused rows to open another intent on the active reservation. `inspected_foreign` had the same unclear routing.

Minimum closure: any effect receipt containing local or remote `foreign` must transition/retain reservation `ambiguous`, prohibit new effects, and use only authorized inspect followed by released/expired terminalization. Only explicitly named nonforeign authoritative no-effect refused rows may leave the reservation active for a separately authorized new intent.

### F-A0-EP03C-012 — HIGH — authoritative absent remote ref is unrepresentable

`expectedRemoteHead` was nullable, but C21 allowed null remote observation only for `unknown` or `not_requested`. After a response loss while a previously absent destination ref remains authoritatively absent, neither state is correct. Inspect state names also lacked exact equality rules against expected target, source HEAD, and expected remote.

Minimum closure: add a closed authoritative `absent` state (or an equivalent exact rule), define its nullability when expected remote is null, and enumerate every inspect state’s exact object equality/nullability. Extend fixed hostile-shape and response-loss vectors.
