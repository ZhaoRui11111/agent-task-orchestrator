# EP-03A A1 implementation audit

- Reviewer: `/root/ep03a_a1`
- Independence: fresh, independent, read-only; the reviewer did not draft or implement EP-03A and performed no file, Git-flow, external, or product-test mutation.
- Reviewed material state: `git-sha1:fb09c8d78c8a3da2d92f9f73cc1a5911f6436585`
- Material base: `fc42a2ead9698e2e25341b014526d4b348fc016c`
- Approval SHA-256: `CFE9076E78B3B3679F0461EFCCB676FA7FC1600CF05ACBEBEE86ACE9BA4E6929`
- Report completed: 2026-09-02 09:55:23+08:00
- Parent disposition: all six findings reproduced, confirmed, in scope, and require task-diff repairs plus fresh independent A2 closure.

The reviewer read the complete active plan and A0 history, repository authority,
all changed and untracked task files, and the authorization, persistence,
reliability, adapter, workspace, security, compatibility, validation, and
toolchain contracts. The supplied primary validation was `pnpm verify:offline`
exit 0 with 483/483 tests, and the reviewer independently ran only read-only
Git/search/trace checks. Both final traces were warning-free and bound the same
material state above. No out-of-scope path, real Git/filesystem/Codex/scheduler/
MCP/release/deploy effect, or sensitive raw-value persistence was found.

## Findings and parent reproduction

### F-A1-01 — HIGH — terminal replay bypasses current trusted identity

At the reviewed state, `src/workspace-application.ts` returned a terminal
operation view before `bindingFailure` and `validateRuntime`. `replayMatches`
compared only `actorId`, so the same actor ID with a substituted principal, an
invalid runtime root, an expired lease, or a changed current owner could receive
the bounded durable result. The parent reproduced the control-flow ordering at
original lines 676-700 and 1565-1575. Repair must revalidate the current owner,
principal, runtime root, and Project root before any terminal result disclosure
and add hostile replay regressions.

### F-A1-02 — HIGH — combined decoder accepts incomplete verified/finalized chains

At the reviewed state, the combined decoder did not require a verified intent
to own exactly one receipt. It also accepted a successful finalization whose
authorization reference was the `act` decision, with no distinct `finalize`
decision and no finalized/reconciled event. The parent reproduced the missing
state/receipt cardinality and phase/current-decision/event checks at original
`src/persistence/application-repository-state.ts` lines 300-405, and confirmed
that the transaction API could otherwise advance observed to verified or bind
an arbitrary allow decision. Repair must close exact receipt cardinality,
decision phase/order/current binding, successful finalization authority, and
terminal-event lineage, with direct corruption regressions.

### F-A1-03 — HIGH — legitimate mutable revision advance strands a generation

At the reviewed state, commands had to equal current Project/Task/run/member/
execution revisions in `bindingFailure` while `generationMatchesOwner` also
required those values to equal the immutable creation-time generation tuple.
The combined decoder intentionally permits current revisions to advance while
retaining the same attempt/fence. A normal lease renewal therefore made both old
and new commands fail, and the immutable SQL update guard prevented rebinding.
Repair must distinguish stable generation ownership (IDs, membership, attempt,
fence) from monotonic current revisions, keep each operation current-authorized,
and prove fresh recovery/cleanup/replay after revision advance.

### F-A1-04 — MEDIUM — closed workspace error flags are inverted

At the reviewed state, `parseFailure` required every ambiguous error to be
retryable and allowed only two ambiguous categories. This rejected the
authoritative `ambiguous_external_state=false/true` and
`integrity_failure=false/true` retryable/ambiguous pairs while accepting invalid
pairs. The internal helper emitted the same inverted flags, and terminal
classification ignored the adapter's `ambiguous` flag. Repair must enforce the
complete category/flag table exactly and drive durable ambiguity/no-effect
transitions from the validated flag.

### F-A1-05 — MEDIUM — no-effect pre-Act reserve failure has no retry route

At the reviewed state, reserve preparation allocated the generation before a
fresh Act authorization check. A denial or stale binding then finalized the
intent as failed without a backend call, but same-generation retry accepted only
a verified refusal or recover-absent proof. Exact replay remained failed and no
other operation addressed `allocated`, permanently wedging the tuple. Repair
must recognize only a closed, receipt-free, observation-free, non-ambiguous
pre-effect failure proof and permit a fresh-current-authority retry of that same
generation.

### F-A1-06 — MEDIUM — Act omits immediate Project-root revalidation

At the reviewed state, `validateRuntime` ran before prepare and before finalize,
but not after the explicit prepared gap and before the Act writer/backend call.
`phaseIdentity` and the Act transaction rechecked logical identities only, so a
same-path physical Project-root substitution after prepare reached the Fake
backend before finalization noticed it. Repair must perform external root and
trusted-runtime validation outside the writer immediately before Act, persist a
no-effect denial when it fails, and prove zero backend calls after a prepared
root swap.

## Parent remediation and validation

The parent repaired all six confirmed findings inside the approved task scope:
terminal replay now follows current owner and trusted-runtime/root validation;
the combined decoder closes verified and successful-finalization lineage;
generation creation revisions are lower bounds while each new phase binds exact
current revisions; the complete 15-category workspace error matrix is exact;
only a receipt-free, observation-free, explicitly non-ambiguous failed reserve
may reuse its unchanged allocated generation; and a fresh external Project-root
check now runs immediately before Act with zero backend invocation on failure.

The repaired state passed `pnpm typecheck`, all four focused workspace groups
(52/52), the full document gardener scan (121 scanned, zero issues/candidates/
unverified), and `pnpm verify:offline` (486/486 tests, 180 packed files, Windows
SQLite feasibility passed with no survivors, Codex boundary explicitly
`blocked`/`not_run` with no support claim). These are parent repair facts, not an
A2 judgment.

All six dispositions remain `a2_required`; a fresh independent A2 must bind the
post-repair material state and close the exact finding IDs before terminal
readiness.
