# Completion and workspace contract

## Status and authority

This file is the sole normative owner of current completion-gate identity and
freshness, durable workspace-generation topology, physical worktree ownership,
integration reservation and partial-success recovery, contained regular-path/
no-follow/reparse checks, cleanup eligibility, and cleanup attestation. The
fresh-only Phase 3 library implements these rules through the exact
`ato.completion/v1`, `ato.integration/v1`, and sole current `ato.workspace/v2`
ports, typed application/persistence owners, configured local gate and local
Git integration adapters, and the Windows local Git workspace backend.

All Phase 3 adapters require explicit trusted injection and are not wired into
the default product runtime or CLI. The integration adapter permits only local
expected-old fast-forward plus ordinary non-force push to a configured
canonical local bare repository; cleanup consumes an application-issued
attestation and refuses uncertain ownership. This is disposable local fixture
evidence, not a release, general network route, or platform-support claim.

The implemented Phase 2B Manual completion decision remains deliberately
outside this gate owner. It consumes only a current verified local Manual
`turn_succeeded` receipt plus distinct authorization and fresh confirmation; it
does not evaluate ProjectPolicy, run or inspect a CompletionBackend gate, bind a
workspace/HEAD, or satisfy Phase 3 completion evidence.

The presence of these physical sections does not authorize this repository's
development process to create a worktree. Adapter call shapes are
owned by the [adapter contracts](adapter-contracts.md), durable external effects
by the [reliability protocol](reliability-protocol.md), and permission by the
[authorization contract](authorization-contract.md).

## Implemented durable workspace foundation

The current schema allocates one workspace generation to exactly one frozen
Project resource/config/root identity, Task revision, dispatcher run/member/
membership revisions, execution revision/attempt/fence, trusted workspace-root
identity, adapter/contract version, creator operation, base reference, the
application-derived immutable ownership-binding digest, and optional cleaned
predecessor generation/revision. The workspace ID is
system-issued and stable; its positive generations are contiguous. A current
generation is unique for one Project/Task/run/execution owner tuple, and only a
cleaned predecessor may create generation `n+1` with the exact predecessor
revision. Similar paths, branches, or content never establish identity.

The complete durable generation status set is `allocated`, `reserved`,
`creating`, `ready`, `cleaning`, `recovery_required`, and `cleaned`. Operation
intents use `pending`, `executing`, `observed`, `verified`, `finalized`,
`ambiguous`, or `failed`. Each operation has its own exact idempotency key and
prepare/act/finalize authorization chain, ordered observation, optional verified
receipt, one finalization, and bounded transition events. Reserve begins with
an allocated generation; create requires reserved; cleanup requires ready;
recover requires `recovery_required` and an exact nonempty, existing,
same-workspace/generation, durably ambiguous, acyclic causal chain terminating
in the original effect-capable `reserve`, `create`, or `cleanup` operation.
The recover prepare and existing Act decision bind one revision `R`; every
ambiguous node in that chain must record `recovery_required` at exactly `R`.
An already resolved root from an older recovery episode is therefore invalid,
while nested ambiguous recover nodes remain valid only within the same `R`.
Inspect does not change the backend generation.

An effect-possible reserve/create/cleanup state is never blindly replayed after
restart or response loss. Known Fake state or the Windows adapter's matching
physical manifest plus authoritative Git/filesystem state may be observed and
finalized; unknown or conflicting state remains `recovery_required`/ambiguous
until an explicit recover operation proves a current postcondition. A verified refusal
or recovered absence can permit the same allocated generation to retry without
allocating a duplicate; a cleaned predecessor is the only route to the next
generation. These are current durable-library guarantees only. The exact-host
Windows adapter tests establish local development evidence for canonical path,
Git registration, HEAD, inventory, ownership, and path safety; they do not
establish a supported platform or any cleanup claim.

A package-private Codex execution backend may consume one such current `ready`
generation only through the exact `ato.execution/v2` owned-workspace tuple. It
requires the configured Project `rootKey` to match ProjectRegistry, reopens the
trusted workspace/root identities, and uses the same `windows-git-local`
physical inspection owner to verify the complete ownership manifest,
authoritative worktree registration, repository identity, ownership receipt,
detached HEAD, and clean inventory before using the canonical generation
directory as the SDK working directory. It compares the inspected repository
identity with the current durable ready receipt on both sides of the check.
This consumer neither creates nor cleans a workspace, cannot
select a caller path, and does not turn Codex turn success into Task completion.
It is absent from every supported package-root/product/dispatcher/API/CLI
factory; current vocabulary-version-7 grants supply no Codex destination,
credential, disclosure, or workspace-effect authority.

## Run and workspace topology

The durable identity/generation rules and the Windows adapter path layout in
this list are current library behavior. They are not evidence that the product
constructs a workspace or that another host is supported.

- A trusted configured `workspace_root` contains the exact adapter-owned path
  `ato-workspaces/w-<lowercase SHA-256(workspace_id)>-g<generation>`.
- The matching linked administration directory is exactly
  `<Project>/.git/worktrees/ato-<lowercase ownershipBindingSha256>`; the
  adapter constructs this registration itself and never invokes `git worktree
  add` or checkout.
- The complete target path and linked administration path are each limited to
  at most 240 UTF-16 code units. The generation suffix is the canonical positive
  decimal representation with no sign or leading zero. A longer path is refused
  before registration, target creation, or any Git mutation.
- `run_id`, `workspace_id`, and `generation` are system-generated identities,
  not Task titles, branch names, prompt text, or user-provided relative paths.
- A workspace generation belongs to exactly one Project, Task, execution, run,
  and creator operation. It is never shared across active executions or reused
  after terminal cleanup/recovery.
- A new retry that legitimately reuses a workspace retains its exact workspace
  ID/generation and ownership receipt. A replacement workspace uses a greater
  generation and a new receipt.
- Stages, gate output, and diagnostic material have named children of that
  generation. Code never discovers them by globbing siblings or choosing the
  lexicographically latest path.
- The configured workspace root, its exact `ato-workspaces` child, and the exact
  generation target are resolved and checked as separate containment/identity
  boundaries. Run identity exists in `ownershipBindingSha256`; it is not a path
  level. Containment of one workspace confers no ownership of a sibling or
  ancestor.

## Worktree ownership receipt

The Windows adapter implements this section for one closed local topology: a
non-bare main worktree whose Git directory and common directory are the same
real contained `<Project>/.git`, with contained ordinary objects and linked
administration directories. The test Fake still provides contract-only
evidence. Other Git layouts and hosts remain unverified.

Creation is not complete until the durable generation/request, adapter receipt,
direct-exclusive physical manifest, and current Git/filesystem observation
agree. `ownershipBindingSha256` is derived from the immutable Project/Task/run/
member/execution/fence/workspace/generation/creator/base/adapter tuple and is
required in both request and receipt. The manifest binds that digest plus:

- workspace generation;
- canonical repository identity, including Project, Git common-directory, and
  object-directory identity hashes;
- canonical workspace path and trusted workspace-root identity;
- worktree registration identity from Git's authoritative worktree inventory;
- detached base/HEAD object ID and object format;
- adapter/contract versions; and
- target/admin identity hashes and registration identity.

The immutable manifest remains bound to the creation base. A current clean,
direct detached workspace `HEAD` may later advance only to a commit whose
merge-base with that base is the base itself. Inspection parses that current
commit's exact tree, revalidates the detached and locked worktree registration,
and emits a new current durable receipt for that HEAD; a symbolic HEAD, unrelated
commit, dirty tree, or unproved object refuses. The closed linked-admin inventory
always contains its six ownership/control files and may additionally contain
only Git's ordinary single-link bounded `COMMIT_EDITMSG` and `logs/HEAD` leaves
created by such a commit. Cleanup inventories and reopens that exact current set.

The durable database stores only the existing receipt digest and closed
projection, not the raw manifest or path. The current request digest, reopened
canonical manifest, and current Git/filesystem observations must all match. A
directory, branch, marker file, Git registration, manifest, receipt, or database row by
itself is insufficient. Recovery of a partial create inspects all of them; a
conflict is `workspace_conflict` or `ambiguous_external_state`, not implicit
adoption.

## Gate identity and freshness

A gate receipt is uniquely identified by this complete tuple:

`task_id`, Task revision, `execution_id`, fencing token, `workspace_id`,
workspace generation/revision, canonical repository identity, exact HEAD object
ID, Project policy ID/version/config revision, gate ID/version, gate input or
command identity, completion-adapter ID/version, and tool/environment evidence
identity.

It also records start/end times, `pass|fail|indeterminate`, redacted evidence
reference, and nullable `valid_until`.

A receipt is fresh if and only if:

1. every identity above exactly matches the current completion request;
2. verdict is `pass`;
3. its gate ID/version remains in the current policy-required gate set;
4. its evidence inventory reopens and validates;
5. current time is before `valid_until` when one exists; and
6. no newer policy, Task, execution, workspace, repository HEAD, adapter, or
   gate-input revision supersedes it.

Any HEAD change, including a metadata-only commit, stales the receipt. Similar
content, a descendant commit, a repeated command, or another workspace does not
preserve freshness.

The local gate backend retains evidence only in a separately configured root
outside the Project/workspace Git inventory and cleanup scope. The exact
operation leaf is creator-bound, canonical, no-follow, exclusive, and
single-link. Its closed record includes hashes of the evidence-directory and
result-file device/inode/mode identities. Restart inspection opens the result
through a no-follow descriptor and checks descriptor/path/parent/root identities
both before and after reading instead of trusting process memory or raw command
output. Device and inode values are captured through lossless BigInt filesystem
stats and canonicalized directly as decimal strings; a JavaScript number
round-trip is forbidden. Missing, partial, exact-byte-replaced, directory- or leaf-swapped,
reparse, hardlinked, conflicting, or digest-mismatched evidence is
`indeterminate`/unknown and can never become a fresh pass.

Completion evaluation obtains the current required-gate set from ProjectPolicy,
verifies every required durable receipt, then invokes a separate `inspect_gate`
for every member outside a writer transaction immediately before final
authorization. It accepts only the exact newly finalized passing inspection
intent set, rereads the complete Task/execution/workspace/HEAD/policy/integration
tuple, and binds that set again inside the final completion CAS. A backend turn
ending, local commit existing, gate command exiting, or some gates passing does
not itself complete a Task.

When policy says preservation is `not_required`, its durable digest is the
canonical not-required disposition. Policy configuration may require
preservation only when integration is also required; in that case the
preservation digest is derived exactly from the independently verified terminal
apply-and-push integration evidence digest. A caller-provided or merely
well-formed digest is never preservation evidence. Completion and later cleanup
recompute the same derivation from current durable records.

## Integration reservation

The Phase 3 library implements this section. The default product runtime and CLI
do not construct its application owner or backend.

Execution workspaces may run concurrently. Mutation of one Project target ref
is serialized by a durable integration reservation with:

- reservation ID, Project ID, canonical repository identity, and exact target
  ref;
- distinct expected target object ID and proposed source workspace/HEAD
  identity;
- owner execution/operation, lease revision, fencing token, and expiry;
- policy/config revision and authorization-decision reference; and
- integration intent and current observation references.

The complete reservation status set is `active`, `ambiguous`, `released`, and
`expired`. `active` and `ambiguous` are current; `released` and `expired` are
terminal for that reservation. An `ambiguous` reservation permits no mutation
and continues to block a replacement until reconciliation resolves the target
to a terminal reservation state.

At most one current reservation exists per Project repository/target-ref tuple.
Acquisition uses one storage transaction that compares the expected target and
policy revisions, proves no current row, allocates the next per-target fencing
token, inserts `active`, and records audit evidence. The persistence owner's
partial unique index is the final concurrent-writer guard, so a racing acquire
cannot create a second current row.

Renewal matches reservation ID, revision, owner, fence, target tuple, and
expected target object ID. Passing expiry immediately removes mutation authority
but does not silently make the row replaceable: reconciliation first observes
unfinished Git effects. Any old intent must become terminal before the
reservation can become `released` or `expired`; an ambiguous observation leaves
both rows ambiguous. A clean release likewise requires the current owner/fence,
completed Task and terminal execution, and no unfinished integration intent.
Only after both old intent and reservation are terminal may a later acquisition
allocate a greater per-target fence.

Acquisition, renewal, takeover, and stale-writer rejection use the generic
lease/fencing mechanics, while this contract owns the status meanings and
target-ref exclusivity. The durable schema, writer/reader closure, transaction,
and unique-index rules are in the
[persistence contract](persistence-contract.md#transaction-and-repository-boundary). The
reservation authorizes no apply, push, completion, release, deployment, or
cleanup; each is a separate policy and authorization decision. Loss or expiry
stops further Git mutation and routes observation/reconciliation.

## Git partial-success protocol

The Phase 3 library implements this protocol through `ato.integration/v1` and
the configured `local-git-integration` adapter. Its push destination is a local
bare repository beneath a trusted root, not a general remote endpoint. The
workspace backend remains separately responsible for linked-worktree ownership.

Before inspection and each effect, the integration adapter reopens the exact
Project/source/destination Git topology: `.git` control, Git/common/object and
worktree directories, source ownership manifest, direct detached HEAD/lock,
locked worktree registration, clean inventory, and bare destination identity.
All namespaces must remain inside the trusted disposable root and the source
must share the Project common/object identity. The same checks run again after
the pre-effect interlock and before the expected-old ref update or ordinary
push; a pointer swap, external metadata namespace, alternate object store,
symbolic or changed source HEAD, or same-byte ownership-file replacement is a
pre-effect refusal.

Every apply or push has its own persisted intent; every inspection appends a
separately authorized read observation. Objects are lowercase 40-hex SHA-1,
expected target and source are distinct, and every receipt has a non-null opaque
evidence reference. Classification is source-first and exhaustive:

- Local inspection is `already_at_source` on a source match, otherwise
  `unchanged` on an expected-target match, otherwise `foreign` for another
  non-null object, otherwise `unknown`.
- Destination inspection is `already_at_source` on a source match even when the
  expected remote already equals source; otherwise authoritative null with null
  expected remote is `absent`, a non-null expected-remote match is `unchanged`,
  another non-null object is `foreign`, and an unproved value is `unknown`.
- Inspect returns `inspected_ambiguous` when either state is unknown;
  `inspected_unchanged` only for local unchanged plus remote absent/unchanged;
  `inspected_local_applied` only for local source plus remote absent/unchanged;
  `inspected_pushed` only when both are at source; every other fully
  authoritative combination is `inspected_foreign`.
- Apply returns `applied` for expected-target to source,
  `already_applied` for source to source, the active-preserving
  `apply_refused` only for expected-target unchanged, and `apply_ambiguous` for
  an unknown post-state. Another authoritative object is foreign and makes the
  reservation ambiguous even though the code is `apply_refused`.
- Push requires local source before and after. It returns `already_pushed` when
  remote is already source; `pushed` when a distinct nullable expected remote
  becomes source; the active-preserving `push_rejected` only when authoritative
  inspection proves the expected remote stayed unchanged or expected-null
  stayed absent; and `push_ambiguous` for an unknown post-state. Another
  authoritative remote object is foreign and makes the reservation ambiguous.

Normal success finalizes the effect intent and retains the active reservation
until separate completion/release. Only the named nonforeign no-effect
`apply_refused` or `push_rejected` row fails that intent while preserving active
status for a newly authorized operation. Every foreign or unknown effect row
makes both intent and reservation ambiguous, prohibits new effects, and admits
only `integration.recover` inspection. `inspected_ambiguous` retains both rows;
authoritative `inspected_unchanged`, `inspected_local_applied`,
`inspected_pushed`, or `inspected_foreign` atomically finalizes the old intent
as `recovered_no_effect`, `recovered_local_applied`, `recovered_pushed`, or
`recovered_inconsistent`, then releases the reservation when recovery precedes
its stored expiry or expires it otherwise.

Reset, force push, forced worktree removal, history rewriting, or deletion
cannot disguise partial success. Any state the configured local inspection
cannot prove remains ambiguous; it is never treated as retry authority.

## Contained-path and no-follow checks

This section is implemented for create/inspect/recover/cleanup by the Windows
adapter. The pure port and Fake themselves perform no filesystem mutation.
Current host evidence is limited to the exact recorded development environment
and is not a support claim.

Before every filesystem mutation or cleanup, the workspace adapter MUST:

1. obtain a canonical no-reparse device/inode/mode identity for each trusted
   root and hold each mutation namespace and its ancestors as a verified worker
   current directory for the relevant write window; device and inode values use
   lossless BigInt stats with no JavaScript number round-trip;
2. before acquiring either registration leaf, run a production capability
   attestation below both the exact `.git/worktrees` parent and exact
   `ato-workspaces` parent: a fresh ownership-bound empty child must pass a
   rename-and-restore positive control, then a nested worker holding that child
   as its current directory must make the same rename fail with exactly
   `EBUSY` or `EPERM`; verify same-device/identity facts and remove only that
   exact empty probe with non-recursive removal, otherwise fail closed;
3. reject empty/root targets, `.`/`..` traversal, drive or share changes,
   alternate data-stream syntax, device paths, and normalization ambiguity;
4. walk every existing path component without following symbolic links,
   junctions, mount points, or any other reparse point;
5. require expected directories to be directories and every control, ownership,
   manifest, index, receipt, and materialized content leaf to be a single-link
   regular file, never a hardlink, symbolic link, or special file; retain and
   revalidate the linked-admin index identity across Git status inspection;
6. atomically acquire each new directory, pass the parent-observed identity to
   the child current-directory guard, acquire every final regular file with
   exclusive create, verify the open descriptor, and compare identities and
   containment again after the operation; and
7. compare paths with the target filesystem's case and normalization rules,
   while retaining the exact opened identity rather than trusting a string
   prefix.

An unsupported no-follow or reparse inspection capability is a failed safety
precondition, not permission to fall back to recursive string-based deletion.
Git command output and repository content are untrusted input and cannot supply
the trusted root or ownership identity. Creation propagates the logical OR of
every parent/probe/downstream effect: once a namespace was acquired or a probe
mutated it, any later failure is ambiguous even when the intended linked-admin
and target leaves were not reached. A successful atomic directory acquisition
is an effect before its identity read: if that read cannot prove the newly
created identity, the adapter retains the effect fact and does not attempt to
remove the unproven object. A capability conflict detected before any probe
creation is a proved no-effect refusal.

## Cleanup refusal

The Phase 3 application owner prepares one unique cleanup intent before it can
issue cleanup authority. A preliminary ProjectPolicy allow is necessary but
insufficient. In one final-authorization transaction the owner revalidates the
completed Task and terminal execution, fresh required gates, preservation
evidence, released/expired-or-not-required integration disposition, exact ready
workspace ownership, current grant and fresh confirmation, then inserts the
`ato.workspace-cleanup-attestation/v1` record and advances that same intent from
`pending` to `executing`. Pre-prepare issuance and a second competing intent are
impossible.

Immediately before backend access, the owner rereads trusted actor and lease
identity, the exact referenced grant ID/revision/scope/config/expiry, the same
unexpired cleanup-policy receipt and facts, the attested final authorization,
Project identity, durable resources, attestation, and zero-owner quiescence.
The policy subject remains bound to the preceding ready revision: the durable
ready-to-cleaning transition records the already-authorized intent, while the
cleaning revision is independently bound by that intent, the attestation, and
the quiescence projection. Revocation, expiry, actor substitution,
policy/configuration drift, or resource change refuses before the adapter sees
the request.

The attestation contains exactly these fields:

`contractId`, `attestationId`, `operationId`, `intentId`, `projectId`,
`projectResourceRevision`, `projectConfigRevision`, `projectRootKey`,
`repositoryIdentity`, `taskId`, `taskCompletedRevision`,
`completionDecisionId`, `executionId`, `executionRevision`, `attemptNumber`,
`fencingToken`, `executionTerminalCreatedAt`, `workspaceId`, `generation`,
`workspaceRevision`, `workspaceRootKey`, `ownershipBindingSha256`,
`policyReceiptId`, `policyReceiptSha256`, `policyConfigRevision`,
`cleanupAuthorizationDecisionId`, `cleanupAuthorizationBindingRevision`,
`grantId`, `grantRevision`, `confirmationId`, `gateSetSha256`,
`preservationStateSha256`, `integrationDisposition`,
`integrationReservationId`, `integrationReservationRevision`,
`integrationReservationFencingToken`, `expectedBranchReference`,
`expectedHeadObjectId`, `quiescenceSha256`, `issuedAt`, `validUntil`, and
`attestationSha256`.

`integrationDisposition` is `not_required|released|expired`; its three
reservation fields are all null only for `not_required` and all present
otherwise. The exact quiescence projection has sorted keys
`activeExecutionOwnerCount`, `currentIntegrationReservationCount`,
`executionId`, `executionTerminalCreatedAt`, `generation`, `observedAt`,
`taskId`, `taskRevision`, `unfinishedCompletionGateIntentCount`,
`unfinishedIntegrationIntentCount`, `unfinishedWorkspaceIntentCount`,
`workspaceId`, and `workspaceRevision`; every count is zero. It excludes exactly
the attestation-bound cleanup intent, which must be the unique identity-matching
row in `pending` during issuance or `executing` during point-of-use validation.
Both digests are uppercase SHA-256 of sorted-key compact UTF-8 JSON;
`attestationSha256` excludes only itself. Validity is positive and at most five
minutes.

Cleanup proceeds only when all of these are proven current:

- a separate `workspace.cleanup` grant and ProjectPolicy allow decision;
- exact workspace ownership receipt, creator/generation identity, and Git
  worktree registration match;
- contained-path/no-follow checks pass at point of use;
- no active execution owner, current integration reservation, unfinished gate
  or integration intent, or workspace intent other than the one exact cleanup
  intent still owns the workspace;
- current branch/ref and HEAD match the expected terminal observation;
- the inventory contains no modified tracked file and no untracked or ignored
  item outside an explicitly creator-owned disposable inventory; and
- every policy-required integration/preservation condition has current evidence.

Unknown, stale, dirty, untracked, ignored, reparse, hardlinked, unowned,
multiply owned, partially published, or ambiguously integrated state refuses
cleanup. The Windows adapter immediately reopens and validates the attestation,
current branch/HEAD, ownership manifest, registration, inventory, and path
identities. Success quarantines the exact target and administration leaves,
revalidates every inventoried member, removes only that closed inventory, and
echoes `attestationSha256`; it never follows an alias, force-removes, accepts a
caller path, or touches the separately retained completion-gate evidence root.
Post-effect uncertainty remains durable ambiguity. Refusal is observable and is
not an error to bypass with recursive or forced cleanup.
