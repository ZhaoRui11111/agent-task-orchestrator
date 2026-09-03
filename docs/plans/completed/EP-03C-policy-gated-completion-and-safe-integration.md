# ExecPlan: close fresh Phase 3 policy-gated completion and safe integration

EP-03C is the final item in the strict EP-03A -> EP-03B -> EP-03C chain. It closes the local library-level ProjectPolicy, completion-gate, integration-reservation, Git partial-success, and owned-cleanup boundaries only against repository-owned disposable fixtures; Codex, scheduling, MCP, D:\quant, release, deployment, real external repositories, credentials, and real network access remain outside this plan except for the repository standing-authorized final coordinator push to the configured `origin/master`.

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-02 20:50:53+08:00",
    "updated_at": "2026-09-03 13:46:07+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "user request in the current coordinator thread for strict EP-03A/EP-03B/EP-03C completion under a fresh-only baseline",
        "at": "2026-09-02 20:50:53+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "user request plus docs/reference/local-agent-git-flow.md standing artifact-prune and ordinary-push grants",
        "at": "2026-09-02 20:50:53+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Deliver EP-03C as the final fresh-only local Phase 3 library closure: implement exact ato.project-policy/v1, ato.completion/v1, and ato.integration/v1 contract kits; replace the unreleased ato.workspace/v1 boundary with one current ato.workspace/v2 whose cleanup can perform an independently policy-authorized owned effect; add one contiguous finite authorization stage for completion and integration actions; replace the sole schema-version-1 baseline in place with complete policy-receipt, gate, completion-decision, integration-reservation, integration-effect, and redacted-event storage; compose one typed application/product-library owner that obtains preliminary policy authority, verifies a current ProjectPolicy receipt, obtains final action authority, persists intent before effects, calls injected adapters outside writer transactions, independently observes and verifies receipts, enforces exact gate freshness and integration/preservation requirements, and alone transitions an eligible running Task to completed. Implement one configured local policy adapter, one bounded non-shell local completion-gate backend, one Windows local Git integration backend for fast-forward integration and ordinary push only to an explicitly configured local disposable bare repository, and policy-authorized Windows workspace cleanup that refuses uncertain ownership, dirty/untracked/ignored/reparse/hardlink state, active leases/reservations/gate writers, incomplete preservation, or ambiguous effects. Exercise every real filesystem/Git effect only beneath the task-frozen .task-artifacts root, pass fresh independent review plus impact-selected and complete offline repository gates, and finish the Git-flow result-commit/prune/gate/ready/FF-only integration/ordinary-push lifecycle without adding Codex, scheduler, MCP, D:\\quant, release, deployment, compatibility readers, or a platform-support claim.",
    "non_goals": [
      "Do not implement Codex or another Task-content ExecutionBackend, same-thread Codex resume, SchedulerBackend or scheduled delivery, MCP, Skill/plugin installation, daemon/service, D:\\quant policy or dogfood, release, deployment, PR creation, or public plugin publication.",
      "Do not access or mutate a real external Project or remote repository, contact a real network endpoint, read credentials or secrets, or execute a gate/integration/cleanup effect outside repository-owned disposable fixtures during this plan. The sole exception is the repository standing-authorized final coordinator ordinary non-force push of the exact integrated terminal commit to the already configured origin/master; that exception grants no credential inspection or adjacent network action.",
      "Do not add a legacy schema/API/port/authorization/backup reader, old workspace-v1 adapter, migration from a pre-EP-03C database, alias, translator, fallback, dual write, deprecation window, adoption path, or historical-baseline acceptance. Immutable completed plans and evidence remain historical facts only.",
      "Do not add a public ato.api/v1 CLI workspace/completion/integration command in this plan. The new Phase 3 product-library facade requires explicitly injected trusted configuration and adapters; the existing local explicit-Manual CLI remains closed until a separately planned safe configuration ingress exists.",
      "Do not let Task text, repository content, branch names, Git output, gate stdout/stderr, environment values, paths, policy receipt fields, or adapter receipts create authorization, select an executable/root/remote, widen a gate command, or decide Domain state.",
      "Do not implement arbitrary shell, arbitrary SQL, caller-selected filesystem mutation, force checkout, reset, rebase, non-FF integration, force push, recursive best-effort deletion, forced worktree removal, history rewrite, automatic retry of an ambiguous effect, or implicit cleanup in a finally block.",
      "Do not describe disposable Windows/Git evidence, an injected library facade, a local-file remote, or blocked real-network behavior as a released product, general Windows/Git support, sandbox, or production platform guarantee."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "EP-03B terminal-resolve must uniquely identify 2485608a1684ea6430adcb8d004979a90d689a69; its Git-flow task, local master, and origin/master tracking ref must remain pushed at that exact head; and chain-check must accept that terminal commit as EP-03C's material base before activation.",
        "source": "current user request; docs/plans/README.md; docs/plans/completed/EP-03B-windows-git-workspace-adapter.md"
      },
      {
        "id": "C2",
        "statement": "The repository root remains the clean master integration checkout. Every EP-03C plan, source, test, documentation, and evidence mutation occurs only on coordinator task ep-03c, branch task/ep-03c, and D:\\agent-task-orchestrator\\.worktrees\\ep-03c; harness-git-flow is the sole coordinator-state writer.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md"
      },
      {
        "id": "C3",
        "statement": "The package is still private 0.0.0-development with no released consumer or supported runtime. Under the user's explicit fresh-only reset authorization, the one schema-version-1 baseline, migration checksum/fingerprint, authorization vocabulary, and workspace port may be replaced in place; APPLICATION_STATE_DIGEST_VERSION advances exactly from 1 to 2 and the canonical v2 projection contains every current non-lifecycle family exactly once in its named sorted-key canonical JSON projection. The sole accepted workspace port becomes ato.workspace/v2; ato.workspace/v1, digest version 1, and every pre-EP-03C database/checksum/digest/action-set shape are rejected with no reader, migration, alias, fallback, dual write, or deprecation window. ato.project-policy/v1, ato.completion/v1, and ato.integration/v1 are first implementations. The closed 33-command ato.api/v1 CLI grammar and backup/restore JSON format remain unchanged.",
        "source": "current user fresh-only authorization; docs/reference/versioning-compatibility-contract.md; docs/reference/persistence-contract.md; docs/reference/cli-contract.md"
      },
      {
        "id": "C4",
        "statement": "The complete gate identity is the exact Task ID/revision, execution ID/revision/attempt/fence, workspace ID/generation/revision and ownership binding, canonical Project/repository identity, exact source HEAD object ID, ProjectPolicy ID/contract/adapter/config revision, gate ID/version, command/input identity, completion adapter/contract/version, trusted completion-evidence-root identity, tool/environment identity, start/end time, verdict, evidence reference, and nullable validity end. A receipt is fresh only when every identity is current, verdict is pass, the gate remains required, its exact owner-bound evidence reopens, validity has not expired, and no newer Task/execution/workspace/HEAD/policy/adapter/gate-input revision supersedes it; any HEAD change stales it.",
        "source": "docs/reference/completion-workspace-contract.md#gate-identity-and-freshness; docs/reference/adapter-contracts.md#completionbackend-atocompletionv1"
      },
      {
        "id": "C5",
        "statement": "Retain the real confirmation-bound authorization stages 1 through 5 and add exactly one contiguous stage 6 whose cumulative action set adds completion.gate.run, completion.gate.inspect, completion.gate.cancel, completion.accept, integration.reserve, integration.inspect, integration.lease.renew, integration.lease.takeover, integration.apply, integration.push, integration.recover, and integration.release. completion.accept, integration.apply, integration.push, and workspace.cleanup require fresh named high-risk confirmation; all operations still require exact current grants, scope/config/resource revisions, actor/principal/root binding, and point-of-use policy/fence checks. Bootstrap and renewal never advance vocabulary and every upgrade advances exactly one stage.",
        "source": "current user-authorized EP-03C outcome; docs/reference/authorization-contract.md; docs/adr/ADR-008-authorization-and-policy-gated-completion.md"
      },
      {
        "id": "C6",
        "statement": "ato.project-policy/v1 is strictly read-only and implements exactly evaluate_mutation, completion_requirements, evaluate_integration, and evaluate_cleanup using the ProjectPolicy decision-input envelope. The configured local adapter maps an exact trusted policy key to immutable bounded configuration; returns allow, deny, or defer plus exact required gates/integration/preservation/cleanup facts; cannot create a grant, intent, reservation, mutation, or Domain transition; and cannot derive policy from Task/repository content or caller-provided commands.",
        "source": "docs/reference/adapter-contracts.md#projectpolicy-atoproject-policyv1; docs/adr/ADR-008-authorization-and-policy-gated-completion.md"
      },
      {
        "id": "C7",
        "statement": "ato.completion/v1 implements exactly run_gate, inspect_gate, and cancel_gate. The local backend accepts only a trusted preconfigured absolute executable and closed argument/environment template identified by the current policy receipt, uses shell=false and bounded time/output, and executes inside the exact owned workspace. Its separately configured canonical evidence root must be bidirectionally non-overlapping with the Project root, workspace target, Git common/admin/object namespaces, and every other configured evidence root. A gate operation owns exactly evidence-root/g-<lowercase SHA-256 of its canonical semantic identity>/result.json: the directory and final leaf are acquired without following aliases, the leaf is exclusive-create, single-link, regular, canonical, bounded, and bound to the operation/creator/evidence-root digest. It is outside Git inventory and never changes source HEAD. Missing, partial, replaced, hardlinked, reparse, conflicting, or mismatched evidence is indeterminate/ambiguous and cannot be blindly rerun under the same semantic operation. Product workspace cleanup never removes this evidence; it is retained for reopen/restart evidence, while only the repository task-artifact harness removes the enclosing disposable fixture root after terminal assertions.",
        "source": "docs/reference/adapter-contracts.md#completionbackend-atocompletionv1; docs/security/threat-model.md; docs/security/privacy-and-logging.md"
      },
      {
        "id": "C8",
        "statement": "The sole schema-version-1 baseline allocates the exact ProjectPolicy receipt, completion-gate request/authorization/intent/observation/verified-receipt/finalization, generic completion-decision parent and closed Manual/Phase-3 subtype, integration reservation/sequence/request/authorization/intent/observation/verified-receipt/finalization, workspace-cleanup-attestation, and dedicated bounded event families implemented here. ApplicationTransaction remains the only SQL/CAS writer and the combined application-state decoder plus digest-version-2 projection remains the complete reader and corruption boundary; backup/restore and doctor observe the new current baseline without adding a historical reader. Every authoritatively recovered integration intent is terminal before its reservation becomes terminal or a higher fence is allocated. A cleanup attestation has an exact FK to its already durable cleanup intent, and its canonical quiescence calculation excludes exactly that intent only under C20's phase and identity rules. Adapter calls and trusted callbacks never run inside writer transactions.",
        "source": "docs/reference/persistence-contract.md; docs/reference/reliability-protocol.md; ARCHITECTURE.md"
      },
      {
        "id": "C9",
        "statement": "A durable integration reservation binds reservation ID/revision/status, Project/repository/target-ref identity, expected target object ID, source workspace/HEAD, owner execution/operation, lease owner/revision/fence/expiry, policy/config revision, and current effect evidence. Status is exactly active, ambiguous, released, or expired; at most one active/ambiguous row exists per Project/repository/target-ref. Acquire requires expectedTargetObjectId and sourceHeadObjectId to be distinct lowercase SHA-1 objects; equality means the target is already at the source and no reservation/effect is created. Acquire is one CAS transaction with the next per-target fence; expiry removes mutation authority but remains current until reconciliation; renew/takeover/release require the exact owner/revision/fence tuple; ambiguous blocks replacement; and every stale writer is refused. A higher fence is allocated only after both every old effect intent and the old reservation are terminal.",
        "source": "docs/reference/completion-workspace-contract.md#integration-reservation; docs/reference/reliability-protocol.md; docs/reference/persistence-contract.md"
      },
      {
        "id": "C10",
        "statement": "ato.integration/v1 implements inspect, apply, and push for one configured local Git topology. Apply is a trusted-Git expected-old-object update-ref CAS from the reserved target to the owned source HEAD only after ancestry and identity proof; the target ref must not be checked out by any registered worktree, and apply never changes an index or worktree. Push is one ordinary non-force explicit object-to-ref refspec to an explicitly configured canonical local bare repository beneath the trusted disposable root; URL, UNC, device path, credentials, helpers, proxy, network, repository-discovered remote, hooks, unsafe config, alternates/promisor/replace/grafts, shallow state, filters, submodule execution, or sparse materialization are refused before effect. Each effect has a persisted intent and independent local/remote observation; response loss, rejection, target drift, and partial local success preserve actual state and never fabricate rollback.",
        "source": "docs/reference/completion-workspace-contract.md#git-partial-success-protocol; current user no-network/no-real-external boundary; docs/security/threat-model.md"
      },
      {
        "id": "C11",
        "statement": "A Task reaches completed through the Phase 3 owner only after a current execution success fact, exact ready workspace/ownership receipt, fresh ProjectPolicy completion requirements, every required fresh passing gate receipt, current required integration/preservation evidence, a separate completion.accept grant and named confirmation, and one final authorization/Task-revision/fence CAS. That single transaction inserts the generic plus Phase-3 completion decision, applies the existing Domain running-to-completed transition, inserts the unique completed execution-terminal fact, appends bounded audit, and proves readback. The terminal fact immediately removes lease/worker mutation authority even though the immutable attempt retains historical lease fields. Manual and Phase-3 decisions are mutually exclusive per execution, and the existing no-workspace Manual path writes the same generic parent plus its closed Manual subtype without semantic change. Gate exit, adapter turn success, local commit, policy allow, integration, or cleanup alone never completes a Task or unlocks dependencies. After completion, a separately authorized release must terminalize the integration reservation before cleanup.",
        "source": "docs/adr/ADR-008-authorization-and-policy-gated-completion.md; docs/reference/completion-workspace-contract.md#gate-identity-and-freshness; docs/reference/domain-contract.md"
      },
      {
        "id": "C12",
        "statement": "ato.workspace/v2 preserves exact reserve/create/inspect/recover identity and recovery guarantees and adds one required cleanupAttestation key to every request: null for reserve/create/inspect/recover and the exact C20 record for cleanup. Cleanup preparation first persists one unique pending cleanup intent; a later single ApplicationTransaction commits its final authorization, computes and persists the C20 attestation against that intent, and advances only that intent to executing; immediately before the out-of-transaction effect the application revalidates the same attestation and C20 quiescence. The Windows adapter reopens the exact ownership manifest and Git inventory, and refuses any dirty tracked, untracked, ignored, or extra member inside the target/admin inventory, plus every reparse, hardlink, foreign, partial, multiply owned, or ambiguous state. It quarantines only exact owner-bound target/admin leaves within their anchored parents, verifies identities after each rename, deletes only the closed verified inventory bottom-up without following aliases, echoes the attestation digest, and reports every post-first-effect failure as ambiguous for recovery. The separate C7 gate-evidence namespace is never part of workspace Git inventory or product cleanup. The adapter never recursively deletes a caller path or uses forced Git removal.",
        "source": "docs/reference/completion-workspace-contract.md#contained-path-and-no-follow-checks; docs/reference/completion-workspace-contract.md#cleanup-refusal; docs/adr/ADR-009-workspace-ownership-and-safe-integration.md"
      },
      {
        "id": "C13",
        "statement": "The product-library composition requires explicit injected ProjectPolicy, Completion, Integration, and Workspace backends plus trusted configuration and exposes only typed Phase 3 commands/results. The default CLI/runtime constructs none of them and the sole ato.api/v1 grammar remains exactly 33 commands: no Task content, repository file, CLI option, environment variable, or adapter response can select an executable, workspace root, target ref, local remote, policy, or cleanup authority.",
        "source": "ARCHITECTURE.md; docs/reference/cli-contract.md; docs/reference/adapter-contracts.md"
      },
      {
        "id": "C14",
        "statement": "Every real Git/filesystem fixture is created only inside D:\\agent-task-orchestrator\\.worktrees\\ep-03c\\.task-artifacts, has no network remote or credentials, and is owned by the existing task-artifact harness. Tests may create an exact disposable local bare repository there to exercise ordinary push semantics; no other repository or path is read or mutated. The task-frozen pathless prune remains the only post-result-commit artifact deletion authority.",
        "source": "current user request; .codex/harness-git-flow.json; docs/reference/local-agent-git-flow.md"
      },
      {
        "id": "C15",
        "statement": "All policy/gate/integration/workspace errors, durable events, public library results, default diagnostics, and test evidence use closed bounded codes and opaque references. Raw Task content, paths, command arguments, stdout/stderr, repository content, Git errors/config, environment, credentials, policy bodies, SQL, stacks, and local/remote URLs never enter durable audit, public/default output, or committed evidence. No telemetry/export sink is added.",
        "source": "docs/reference/observability-contract.md; docs/security/privacy-and-logging.md; docs/security/threat-model.md"
      },
      {
        "id": "C16",
        "statement": "Every intermediate EP-03C state is internally coherent, strict-typecheckable, and testable at its milestone boundary. No compatibility shim, unsafe temporary cleanup, product/CLI leak, unbounded command seam, stale schema reader, partial public export, or known failing gate is deferred. The helper-required singular docs/plans/proposal lifecycle path is an ownership-only scope sentinel and must remain absent; the sole live plan moves only through proposals, active, and completed. Any material review finding is repaired only inside the approved envelope and receives fresh independent A2 when required.",
        "source": "current user request; AGENTS.md; docs/plans/README.md"
      },
      {
        "id": "C17",
        "statement": "The integration port's exact semantic subject contains Project ID/resource/config/root identity, repository identity and objectFormat=sha1, target refs/heads, source workspace/generation/revision/ownership/HEAD, reservation ID/revision/status/owner/lease-revision/fence/expiry, policy receipt/config identity, and configured local-destination identity with nullable expected remote head. IDs are NFC 1..128, refs are validated NFC refs/heads names at most 255, SHA-1 objects are lowercase 40-hex, SHA-256 bindings are uppercase 64-hex, and times are canonical UTC. inspect is the read class and adds only queryId/readAuthorizationDecisionId/lastObservationNumber; apply and push are effect classes and add only operationId/intentId/idempotencyKey/finalAuthorizationDecisionId/expectedObservationNumber. Exact union receipts echo those identities plus observation number, local and remote before/after objects, local state unchanged|fast_forwarded|already_at_source|foreign|unknown, remote state not_requested|absent|unchanged|pushed|already_at_source|rejected|foreign|unknown, outcome succeeded|refused|ambiguous, an operation-specific closed code, non-null opaque evidence reference, and observed time; absent means an authoritative inspection proved that the configured destination ref does not exist and is legal only when expectedRemoteHead is null, while unknown never proves absence. Only effect receipts echo intent/idempotency and only inspect echoes query/read authority. Failures use only the shared closed adapter taxonomy. Unknown, extra, accessor, mixed-operation, cross-port, wrong-bound, or illegal state/code combinations are rejected before dispatch.",
        "source": "docs/reference/adapter-contracts.md#operation-class-receipts; docs/reference/completion-workspace-contract.md#integration-reservation; docs/reference/completion-workspace-contract.md#git-partial-success-protocol"
      },
      {
        "id": "C18",
        "statement": "Integration apply/push durable intents use exactly pending, executing, observed, verified, finalized, ambiguous, or failed; only apply and push have intents, while inspect appends a read observation. Legal edges are pending->executing before effect, executing->observed|ambiguous|failed, observed->verified, verified->finalized, and ambiguous->observed after an independently authorized inspect; terminal rows are immutable. A C21-named authoritative nonforeign no-effect apply_refused or push_rejected effect row advances its intent to failed and alone may leave the reservation active for a new separately authorized intent, never an automatic retry. Every effect receipt containing unknown or foreign advances its intent and reservation to ambiguous, prohibits every new effect, and permits only independently authorized inspect recovery. inspected_ambiguous appends the read observation and retains both rows ambiguous. Any fully authoritative inspected_unchanged, inspected_local_applied, inspected_pushed, or inspected_foreign row is handled in one ApplicationTransaction CAS: append the inspection; advance the original intent ambiguous->observed->verified->finalized with recoveryResult exactly recovered_no_effect, recovered_local_applied, recovered_pushed, or recovered_inconsistent respectively; then and only then terminalize the reservation as released when recoveryCommittedAt is strictly before its stored expiresAt, otherwise expired. The CAS binds the exact reservation/intent/revision/fence/last-observation tuple; it never returns active, and no higher fence is allocated until both rows are terminal. Normal succeeded effect rows advance observed->verified->finalized and retain the active reservation until separate completion/release. The exact response-loss matrix distinguishes authoritative absence from unknown, no local/remote change, local-only success, proved nonforeign remote rejection, prior/matching/foreign/unknown remote head, remote success with finalization loss, and target CAS conflict.",
        "source": "docs/reference/reliability-protocol.md; docs/reference/completion-workspace-contract.md#integration-reservation; docs/reference/completion-workspace-contract.md#git-partial-success-protocol"
      },
      {
        "id": "C19",
        "statement": "The current baseline adds immutable completion_decisions as the one parent keyed by completionDecisionId with kind manual|policy_gated, exact Task/execution/attempt/fence/pre/post revisions, created time, and unique execution identity. manual_completion_decisions retains its current exact fields and foreign keys as a closed child of a kind=manual parent; policy_gated_completion_decisions is the kind=policy_gated child and binds operation/idempotency, execution-success receipt/finalization, policy receipt, gate-set digest, workspace/HEAD/integration/preservation evidence digests, request/authorization/audit/confirmation, and created time. tasks.completion_decision_id and execution_terminal_states.completion_decision_id reference only the generic parent. Triggers and the combined reader require child/parent equality, exactly one matching subtype, one completion and one terminal row per execution, matching Domain post revision, and no Manual/Phase-3 crossover. The Manual writer is updated only to insert its generic parent in the existing atomic transaction; Phase-3 atomically inserts parent, child, Domain completion and terminal execution state.",
        "source": "docs/reference/persistence-contract.md; docs/reference/domain-contract.md; docs/reference/reliability-protocol.md"
      },
      {
        "id": "C20",
        "statement": "The cleanup-only attestation is exactly ato.workspace-cleanup-attestation/v1 with these JSON field names: contractId, attestationId, operationId, intentId, projectId, projectResourceRevision, projectConfigRevision, projectRootKey, repositoryIdentity, taskId, taskCompletedRevision, completionDecisionId, executionId, executionRevision, attemptNumber, fencingToken, executionTerminalCreatedAt, workspaceId, generation, workspaceRevision, workspaceRootKey, ownershipBindingSha256, policyReceiptId, policyReceiptSha256, policyConfigRevision, cleanupAuthorizationDecisionId, cleanupAuthorizationBindingRevision, grantId, grantRevision, confirmationId, gateSetSha256, preservationStateSha256, integrationDisposition, integrationReservationId, integrationReservationRevision, integrationReservationFencingToken, expectedBranchReference, expectedHeadObjectId, quiescenceSha256, issuedAt, validUntil, attestationSha256. integrationDisposition is not_required|released|expired with all three integration fields null only for not_required and all present otherwise. The exact quiescence projection has keys activeExecutionOwnerCount, currentIntegrationReservationCount, executionId, executionTerminalCreatedAt, generation, observedAt, taskId, taskRevision, unfinishedCompletionGateIntentCount, unfinishedIntegrationIntentCount, unfinishedWorkspaceIntentCount, workspaceId, workspaceRevision; every count is exactly zero. unfinishedWorkspaceIntentCount counts every nonterminal workspace intent for the exact workspace/generation except and only except attestation.intentId: that excluded row must already exist exactly once, match the attestation's operation/project/task/execution/workspace/generation identities, be operation=cleanup, and be pending during the final-authorization/attestation issuance transaction or executing during immediate point-of-use revalidation. Missing, duplicate, differently bound, differently phased, or any other nonterminal workspace intent makes quiescence invalid. The final-authorization transaction computes the pending-phase projection, inserts the attestation through its exact cleanup-intent FK, and advances that same intent to executing atomically; pre-prepare issuance is impossible, restart reads the committed pending or executing phase exactly, and a concurrent competing insert makes the CAS fail. quiescenceSha256 is uppercase SHA-256 of sorted-key compact UTF-8 JSON of that projection. attestationSha256 is uppercase SHA-256 of sorted-key compact UTF-8 JSON of the exact attestation object containing every preceding field and excluding only attestationSha256 itself. The application is the sole durable issuer and point-of-use revalidator; validUntil is later than issuedAt and at most five minutes; all resources/revisions/digests remain current; and the backend consumes only this narrowing proof and echoes attestationSha256. Cross-operation, stale, expired, substituted, cross-resource, wrong-head, wrong-reservation, wrong-quiescence, or digest-mismatched attestations fail before filesystem/Git access. Fixed pre-prepare, post-prepare, post-authorization/executing, concurrent-insert, positive, and one-field-negative canonical vectors are contract tests.",
        "source": "docs/reference/adapter-contracts.md#workspacebackend-atoworkspacev1; docs/reference/completion-workspace-contract.md#cleanup-refusal; docs/reference/reliability-protocol.md"
      },
      {
        "id": "C21",
        "statement": "INTEGRATION_RECEIPT_CODES is exactly inspected_unchanged, inspected_local_applied, inspected_pushed, inspected_foreign, inspected_ambiguous, applied, already_applied, apply_refused, apply_ambiguous, pushed, already_pushed, push_rejected, push_ambiguous. Every receipt has a non-null opaque evidenceReference and every object ID is a lowercase 40-hex SHA-1; C9 guarantees expectedTargetObjectId differs from sourceHeadObjectId. For inspect, both before IDs are null, both configured refs are always inspected, and state classification uses this exhaustive precedence. Local: a source match is already_at_source; otherwise an expected-target match is unchanged; otherwise a non-null object is foreign; otherwise unknown; fast_forwarded is illegal. Remote: a source match is already_at_source even when expectedRemoteHead also equals source; otherwise authoritative null with expectedRemoteHead null is absent; otherwise a non-null expected-remote match is unchanged; otherwise a non-null object is foreign; otherwise unknown; not_requested, pushed, and rejected are illegal. The mutually exclusive inspect rows are ordered: inspected_ambiguous+ambiguous iff either state is unknown; otherwise inspected_unchanged+succeeded iff local is unchanged and remote is absent|unchanged; otherwise inspected_local_applied+succeeded iff local is already_at_source and remote is absent|unchanged; otherwise inspected_pushed+succeeded iff both are already_at_source; every other fully authoritative combination is inspected_foreign+refused, including local expected plus remote source and combinations with either foreign state. For apply, both remote IDs are null and remoteState=not_requested: applied+succeeded has expected-target before/source after and localState=fast_forwarded; already_applied+succeeded has source before/after and localState=already_at_source; the sole active-preserving apply_refused+refused row has expected-target before/after and localState=unchanged; an authoritative non-null other local object uses apply_refused+refused with localState=foreign and makes the reservation ambiguous; apply_ambiguous+ambiguous has localAfterObjectId=null and localState=unknown. For push, both local IDs equal source and localState=already_at_source. already_pushed+succeeded applies whenever remote before/after equal source, including expectedRemoteHead equal to source. pushed+succeeded requires expectedRemoteHead differ from source, remoteBeforeObjectId equal that nullable expected value, remoteAfterObjectId equal source, and remoteState=pushed. The sole active-preserving push_rejected+refused row also requires expectedRemoteHead differ from source and proves no effect by keeping both remote IDs equal to a non-null expected remote with remoteState=rejected|unchanged, or both null with expectedRemoteHead null, authoritative inspection, and remoteState=absent. An authoritative non-null other remote object uses push_rejected+refused with remoteState=foreign and makes the reservation ambiguous; push_ambiguous+ambiguous has remoteAfterObjectId=null and remoteState=unknown, distinct from authoritative absent. Normal succeeded rows finalize success; only the named nonforeign no-effect refusal rows fail their current intent while preserving active status for a separately authorized new intent. Every foreign or unknown effect row makes both intent and reservation ambiguous, prohibits a new effect, and can be resolved only by C18's inspect terminalization. Every other operation/outcome/code/state/equality/nullability/finalization combination is invalid.",
        "source": "docs/reference/adapter-contracts.md#operation-class-receipts; docs/reference/completion-workspace-contract.md#git-partial-success-protocol; docs/reference/reliability-protocol.md"
      },
      {
        "id": "C22",
        "statement": "Every semantic filesystem-object identity used by ProjectRegistry Project/runtime-root receipts, trusted persistence runtime-layout ownership, persistence regular-file/path/descriptor/unlink/lock/connection-receipt guards, completion evidence, local Git integration, or workspace mutation captures device and inode from BigInt lstat/fstat and canonicalizes their exact decimal strings before any JavaScript number conversion. Mode and byte size remain bounded numeric contract fields only after explicit safe-range conversion; link counts and byte-length comparisons remain BigInt where supplied by BigInt stats. Ordinary numeric stat may be used only for presence/type checks that do not create or compare semantic identity. Windows regressions independently recompute actual BigInt identities, require high-bit values to remain exact, and prove replacement objects are rejected at Project revalidation, trusted-runtime bootstrap/runtime-layout revalidation, and persistence path-versus-descriptor/lock/receipt boundaries.",
        "source": "docs/reference/completion-workspace-contract.md; docs/reference/persistence-contract.md; docs/security/threat-model.md"
      }
    ],
    "authorization": {
      "allowed": [
        "Create, independently audit, and activate this one EP-03C plan; edit only declared task paths inside the coordinator-owned ep-03c worktree; use fresh independent read-only A0/A1/A2 reviewers and persist bounded review evidence.",
        "Replace the unreleased current schema-version-1 baseline, migration checksum/fingerprint, lifecycle application-state digest version 1 with exact version 2, authorization stage, workspace port major, and provisional package exports exactly as constrained here, with no compatibility reader or migration.",
        "Implement and locally test the pure policy/completion/integration ports, typed durable application/product-library composition, trusted configured local adapters, local fast-forward integration, local-file ordinary push, and ownership-safe cleanup only in repository-owned disposable fixtures beneath .task-artifacts.",
        "Run read-only Git inspection, local builds, impact-selected tests, pnpm verify:offline, package smoke, SQLite feasibility, documentation checks and gardening, git diff --check, exact inventory checks, and schema/backup/restart/concurrency/failpoint/security fixtures. No registry/network advisory query is authorized.",
        "Create one terminal task-result commit containing only task-owned paths, invoke the standing-authorized pathless prune-artifacts transition after that commit, record all 22 frozen exact-head Git-flow gates, mark ready, perform FF-only local master integration, and invoke the standing-authorized ordinary non-force origin/master push."
      ],
      "requires_reapproval": [
        "Any public ato.api/v1 CLI command/error/output change, backup/restore JSON-format change, Domain state/transition change, schema version other than 1, additional authorization action or stage, port operation or required identity beyond C3-C13, compatibility reader, migration, alias, fallback, dual write, or old baseline acceptance.",
        "Any product, adapter, fixture, dependency, audit or arbitrary access to a real Project, external repository, D:\\quant, network endpoint, credential/secret store, Codex, scheduler, MCP, daemon/service, PR, non-FF merge, force operation, release, deployment, public listing, or coordinator cleanup; only the separately listed final coordinator ordinary origin/master push is excepted.",
        "Any production remote protocol beyond configured canonical local-file bare repositories, any arbitrary shell/SQL/filesystem surface, any cleanup outside an exact current ownership receipt, any recursive or forced deletion, or any capability/platform-support claim.",
        "Any task-path expansion, material approval-contract change, uncertain/diverged base transition, or authority/architecture conflict not explicitly resolved under this contract and fresh A0."
      ],
      "prohibited": [
        "Modify the integration checkout directly, create another lifecycle plan, mutate another repository, use Git reset/stash/clean/rebase/force, rewrite historical plans/evidence, or run coordinator cleanup.",
        "Run pnpm dependency:audit or another registry/network advisory query, install/download dependencies, contact any remote URL except the standing-authorized final coordinator origin/master push, read credentials, invoke Codex/scheduler/MCP, access D:\\quant, create a PR, release, or deploy.",
        "Use a real external repository for a Project, gate, integration, push, or cleanup effect; execute Task content; accept repository-derived executables/config as trusted; or retain raw sensitive output as evidence.",
        "Treat a gate exit code, manifest, policy receipt, adapter receipt, branch/HEAD similarity, local integration, remote observation, Task readiness, or turn success alone as authorization, ownership, freshness, completion, preservation, or cleanup authority.",
        "Blindly retry ambiguous gate/integration/cleanup effects, fabricate rollback after partial success, force-remove a worktree/ref, delete an unknown/dirty/reparse/hardlinked path, or weaken containment to make a fixture pass."
      ],
      "persistence": {
        "required": true,
        "action": "Persist one terminal EP-03C task-result commit containing the completed ExecPlan and exact task-owned implementation/evidence, then use current-head pathless artifact prune, all 22 exact-head gates, readiness, FF-only local integration, and the standing-authorized ordinary origin/master push; do not perform coordinator cleanup.",
        "source": "current user request; docs/plans/README.md; docs/reference/local-agent-git-flow.md"
      }
    },
    "scope": {
      "task_paths": [
        {"path": "AGENTS.md", "kind": "file"},
        {"path": "ARCHITECTURE.md", "kind": "file"},
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "README.md", "kind": "file"},
        {"path": "docs/README.md", "kind": "file"},
        {"path": "docs/adr/ADR-008-authorization-and-policy-gated-completion.md", "kind": "file"},
        {"path": "docs/adr/ADR-009-workspace-ownership-and-safe-integration.md", "kind": "file"},
        {"path": "docs/compatibility/v0.1.md", "kind": "file"},
        {"path": "docs/plans/proposal/EP-03C-policy-gated-completion-and-safe-integration.md", "kind": "file"},
        {"path": "docs/plans/proposals/EP-03C-policy-gated-completion-and-safe-integration.md", "kind": "file"},
        {"path": "docs/plans/active/EP-03C-policy-gated-completion-and-safe-integration.md", "kind": "file"},
        {"path": "docs/plans/completed/EP-03C-policy-gated-completion-and-safe-integration.md", "kind": "file"},
        {"path": "docs/plans/evidence/EP-03C", "kind": "directory"},
        {"path": "docs/reference/adapter-contracts.md", "kind": "file"},
        {"path": "docs/reference/authorization-contract.md", "kind": "file"},
        {"path": "docs/reference/cli-contract.md", "kind": "file"},
        {"path": "docs/reference/completion-workspace-contract.md", "kind": "file"},
        {"path": "docs/reference/contract-ownership.md", "kind": "file"},
        {"path": "docs/reference/domain-contract.md", "kind": "file"},
        {"path": "docs/reference/observability-contract.md", "kind": "file"},
        {"path": "docs/reference/persistence-contract.md", "kind": "file"},
        {"path": "docs/reference/reliability-protocol.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "docs/reference/validation-policy.md", "kind": "file"},
        {"path": "docs/reference/versioning-compatibility-contract.md", "kind": "file"},
        {"path": "docs/security/privacy-and-logging.md", "kind": "file"},
        {"path": "docs/security/threat-model.md", "kind": "file"},
        {"path": "migrations/0001-current-baseline.sql", "kind": "file"},
        {"path": "package.json", "kind": "file"},
        {"path": "scripts/lint.mjs", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "scripts/repo-utils.mjs", "kind": "file"},
        {"path": "src/application-domain.ts", "kind": "file"},
        {"path": "src/application-model.ts", "kind": "file"},
        {"path": "src/application-policy.ts", "kind": "file"},
        {"path": "src/application-service.ts", "kind": "file"},
        {"path": "src/application.ts", "kind": "file"},
        {"path": "src/authorization.ts", "kind": "file"},
        {"path": "src/completion-application.ts", "kind": "file"},
        {"path": "src/completion-port.ts", "kind": "file"},
        {"path": "src/execution-loop.ts", "kind": "file"},
        {"path": "src/index.ts", "kind": "file"},
        {"path": "src/integration-port.ts", "kind": "file"},
        {"path": "src/local-completion-backend.ts", "kind": "file"},
        {"path": "src/local-git-integration-backend.ts", "kind": "file"},
        {"path": "src/local-project-policy.ts", "kind": "file"},
        {"path": "src/node-builtins.d.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-digest.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-lifecycle.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-model.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-readers.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-state.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-transaction.ts", "kind": "file"},
        {"path": "src/persistence/application-repository.ts", "kind": "file"},
        {"path": "src/persistence/backup.ts", "kind": "file"},
        {"path": "src/persistence/database.ts", "kind": "file"},
        {"path": "src/persistence/doctor.ts", "kind": "file"},
        {"path": "src/persistence/index.ts", "kind": "file"},
        {"path": "src/persistence/migrations.ts", "kind": "file"},
        {"path": "src/persistence/runtime.ts", "kind": "file"},
        {"path": "src/persistence/values.ts", "kind": "file"},
        {"path": "src/product-runtime.ts", "kind": "file"},
        {"path": "src/project-policy-port.ts", "kind": "file"},
        {"path": "src/project-registry.ts", "kind": "file"},
        {"path": "src/workspace-application.ts", "kind": "file"},
        {"path": "src/workspace-git-adapter.ts", "kind": "file"},
        {"path": "src/workspace-port.ts", "kind": "file"},
        {"path": "test/application-atomicity.test.mjs", "kind": "file"},
        {"path": "test/application-cli-module-architecture.test.mjs", "kind": "file"},
        {"path": "test/application-service.test.mjs", "kind": "file"},
        {"path": "test/authorization.test.mjs", "kind": "file"},
        {"path": "test/cli-contract.test.mjs", "kind": "file"},
        {"path": "test/cli-phase2-e2e.test.mjs", "kind": "file"},
        {"path": "test/completion-application.test.mjs", "kind": "file"},
        {"path": "test/completion-port-contract.test.mjs", "kind": "file"},
        {"path": "test/completion-recovery.test.mjs", "kind": "file"},
        {"path": "test/completion-security.test.mjs", "kind": "file"},
        {"path": "test/configuration.test.mjs", "kind": "file"},
        {"path": "test/domain-architecture.test.mjs", "kind": "file"},
        {"path": "test/dispatcher-security.test.mjs", "kind": "file"},
        {"path": "test/execution-claim-foundation.test.mjs", "kind": "file"},
        {"path": "test/execution-loop-authorization.test.mjs", "kind": "file"},
        {"path": "test/execution-loop-recovery.test.mjs", "kind": "file"},
        {"path": "test/execution-loop-security.test.mjs", "kind": "file"},
        {"path": "test/fixtures/fake-completion-backend.mjs", "kind": "file"},
        {"path": "test/fixtures/fake-integration-backend.mjs", "kind": "file"},
        {"path": "test/fixtures/fake-project-policy.mjs", "kind": "file"},
        {"path": "test/fixtures/fake-workspace-backend.mjs", "kind": "file"},
        {"path": "test/fixtures/workspace-git-fixture.mjs", "kind": "file"},
        {"path": "test/integration-port-contract.test.mjs", "kind": "file"},
        {"path": "test/integration-reservation.test.mjs", "kind": "file"},
        {"path": "test/local-completion-backend.test.mjs", "kind": "file"},
        {"path": "test/local-git-integration.test.mjs", "kind": "file"},
        {"path": "test/local-project-policy.test.mjs", "kind": "file"},
        {"path": "test/package-boundary.test.mjs", "kind": "file"},
        {"path": "test/persistence-backup-restore.test.mjs", "kind": "file"},
        {"path": "test/persistence-concurrency.test.mjs", "kind": "file"},
        {"path": "test/persistence-doctor.test.mjs", "kind": "file"},
        {"path": "test/persistence-module-architecture.test.mjs", "kind": "file"},
        {"path": "test/persistence-path-security.test.mjs", "kind": "file"},
        {"path": "test/persistence-repository.test.mjs", "kind": "file"},
        {"path": "test/persistence-schema-migrations.test.mjs", "kind": "file"},
        {"path": "test/persistence-smoke.test.mjs", "kind": "file"},
        {"path": "test/persistence-test-helpers.mjs", "kind": "file"},
        {"path": "test/product-runtime-security.test.mjs", "kind": "file"},
        {"path": "test/product-runtime.test.mjs", "kind": "file"},
        {"path": "test/project-policy-contract.test.mjs", "kind": "file"},
        {"path": "test/project-registry.test.mjs", "kind": "file"},
        {"path": "test/workspace-application.test.mjs", "kind": "file"},
        {"path": "test/workspace-git-adapter-contract.test.mjs", "kind": "file"},
        {"path": "test/workspace-git-command-security.test.mjs", "kind": "file"},
        {"path": "test/workspace-git-recovery.test.mjs", "kind": "file"},
        {"path": "test/workspace-git-security.test.mjs", "kind": "file"},
        {"path": "test/workspace-git-worktree-e2e.test.mjs", "kind": "file"},
        {"path": "test/workspace-port-contract.test.mjs", "kind": "file"},
        {"path": "test/workspace-recovery.test.mjs", "kind": "file"},
        {"path": "test/workspace-security.test.mjs", "kind": "file"},
        {"path": "test/windows-phase3-e2e.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "Freeze one fresh independently approved EP-03C contract that proves the EP-03B terminal chain, exact version/action reset, ProjectPolicy/Completion/Integration/Workspace allocation, durable identity/state machines, library-versus-CLI boundary, disposable-only effects, and binary validation matrix.",
        "validation_ids": ["V1", "V2", "V3"]
      },
      {
        "id": "M2",
        "outcome": "Implement the exact pure port kits, authorization stage 6, sole current schema-version-1 baseline and typed writer/reader/digest closure for policy, gates, completion and integration reservation/effect evidence without a compatibility reader.",
        "validation_ids": ["V2", "V3", "V4", "V5", "V7", "V16"]
      },
      {
        "id": "M3",
        "outcome": "Implement ProjectPolicy evaluation, bounded local gate execution/inspection/cancellation, exact gate freshness, policy-gated Task completion, typed product-library composition, redaction, and every authorization/revision/fence/response-loss boundary.",
        "validation_ids": ["V4", "V5", "V6", "V8", "V12", "V13", "V14"]
      },
      {
        "id": "M4",
        "outcome": "Implement durable integration reservation, local Git fast-forward and configured local-file ordinary push with partial-success observation, plus policy-authorized ownership-safe workspace cleanup and recovery, all exercised only in disposable Windows fixtures.",
        "validation_ids": ["V9", "V10", "V11", "V12", "V14", "V15"]
      },
      {
        "id": "M5",
        "outcome": "Synchronize architecture, contracts, schema/version/compatibility status, source/package inventories, product/CLI boundary, threat/privacy claims and validation routes; pass impact-selected and complete offline repository validation with no network advisory claim.",
        "validation_ids": ["V13", "V14", "V16", "V17", "V18"]
      },
      {
        "id": "M6",
        "outcome": "Complete fresh independent A1/A2 as required, exact inventory, terminal plan persistence, result commit, task-frozen pathless artifact prune, all 22 exact-head Git-flow receipts, readiness, FF-only integration and applicable ordinary push; then run final master gates and terminal summary without coordinator cleanup.",
        "validation_ids": ["V1", "V17", "V18", "V19"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "ExecPlan schema, strict predecessor chain, scope, and activation readiness",
        "criterion": "exec_plan.py trace returns schema v3, ok=true, errors=[], outside_scope=[], overlap=[], pre_existing_dirty=[], exact base 2485608a1684ea6430adcb8d004979a90d689a69, and a fresh independent A0 with the exact approval digest/material base and findings=[]; terminal-resolve uniquely identifies EP-03B at that commit, chain-check accepts EP-03C, and local master/origin tracking plus the EP-03B push receipt remain exact."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Exact fresh-only port and version boundary",
        "criterion": "Contract, package and one-field-at-a-time hostile-shape tests pass with zero fail/skip/todo: ato.project-policy/v1 and ato.completion/v1 expose only their approved operations/envelopes; ato.integration/v1 exactly implements the C17 union/bounds/operation classes and C21's mutually exclusive, exhaustive receipt code/state/object-equality/nullability/finalization matrix, including distinct target/source, expected-remote-equals-source precedence and every fully authoritative cross-product; ato.workspace/v2 is the sole workspace contract, requires null cleanupAttestation on four non-cleanup operations and the exact C20 record/self-intent-excluding canonical vectors plus receipt digest echo on cleanup; ato.workspace/v1 and all old/mixed/cross-port shapes are rejected; the current 33-command ato.api/v1 and backup/restore JSON grammars remain byte-for-byte contract-equivalent; no compatibility reader, alias, fallback or dual write exists."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Finite authorization stage 6 and confirmation boundary",
        "criterion": "Static, unit, persistence and failpoint tests prove exact cumulative stages 1/2/3/4/5/6; stage 6 adds only the twelve C5 actions; completion.accept, integration.apply, integration.push and workspace.cleanup are high risk; bootstrap/renewal never upgrade; each upgrade is separately confirmed and advances exactly one stage; skipped/old/unknown/stale/revoked/wrong-scope/wrong-root/wrong-policy/wrong-fence paths commit no partial grant, epoch, request, decision, audit, reservation, intent or Domain mutation."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "ProjectPolicy v1 purity, binding, and narrowing",
        "criterion": "Shared port and configured-adapter tests prove exact four-operation grammar, preliminary current policy.evaluate authorization, complete Project/config/subject/observation identity, deterministic allow/deny/defer receipts, bounded required-gate/integration/preservation/cleanup facts, exact config-revision staleness, and zero SQL, filesystem, Git, grant, intent, reservation, Domain or caller-value mutation. Task/repository content and adapter output cannot add authority or a command."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Completion v1 gate effect and inspection contract",
        "criterion": "Port, backend and application tests prove exact run/inspect/cancel requests and receipts; run uses only the trusted executable/argv/env/workspace tuple with shell=false and bounded time/output; intent and final authorization precede the effect; calls occur outside writer transactions; the exact C7 evidence directory/leaf is outside every Git/workspace inventory, exclusive, canonical, single-link, no-follow, owner/root/operation-bound, immutable and independently reopened across restart; pass/fail/indeterminate, timeout, cancellation, response loss, missing/partial/replaced/hardlinked/reparse/conflicting evidence and replay have exact closed outcomes; and an ambiguous semantic operation is never blindly rerun."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Gate identity, evidence reopening, and freshness",
        "criterion": "A complete identity-matrix suite proves a receipt is accepted only for the exact C4 tuple, current required gate set, pass verdict, reopenable C7 evidence and unexpired validity. Changing each Task/execution/fence/workspace/generation/revision/ownership/repository/HEAD/policy/config/gate/version/command/adapter/evidence-root/tool/environment identity independently makes the old receipt stale; any HEAD change including metadata-only commit stales it; similar content, descendant HEAD, repeated command or another workspace never preserves freshness."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Tier-2 persistence writer/reader/schema closure",
        "criterion": "Architecture, schema and repository tests prove ApplicationTransaction is the sole SQL/CAS writer and the combined state decoder plus APPLICATION_STATE_DIGEST_VERSION=2 projection is the complete reader for every C8/C19/C20 row and field; all constraints, foreign keys, child/parent checks, partial unique indexes, immutable evidence and C18 legal transition triggers are exact. A terminal reservation with any nonterminal old integration intent is corruption; a cleanup attestation without exactly one identity-matching durable cleanup intent in its permitted phase is corruption. Current-state projection, lifecycle digest v2, backup/restore and doctor include every family once; malformed/orphan/duplicate/cyclic/cross-subtype/stale/inconsistent rows fail read-only before mutation; and digest v1 or any old checksum/fingerprint/baseline is rejected byte-preservingly. C22 tests prove exact BigInt device/inode capture and replacement refusal for Project/runtime-root receipts, runtime-layout ownership, persistence regular files, lifecycle locks and connection receipts across path, descriptor, reopen and unlink boundaries."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Policy-gated completion and Domain separation",
        "criterion": "Application/product-library and real-SQLite tests prove only C11's complete current evidence can atomically insert one C19 generic+Phase-3 decision, perform the existing running-to-completed Domain transition, insert the unique completed execution-terminal fact, append audit and read back the exact tuple. That terminal fact invalidates historical lease mutation authority; replay is exact, a Manual/Phase-3 race has one winner, and the Manual path inserts generic+Manual rows with unchanged observable semantics. Missing/failed/indeterminate/stale/expired gates, policy deny/defer, wrong HEAD/workspace/execution/fence, incomplete integration/preservation, absent confirmation/grant or competing Task revision leaves Task and execution nonterminal with no partial decision. Execution turn success, gate exit, commit, policy allow, integration and cleanup alone never complete or unlock dependencies."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Integration reservation exclusivity, lease and fencing",
        "criterion": "Real SQLite multi-writer and failpoint tests prove one current reservation per exact Project/repository/target ref, distinct expected target/source, monotonic per-target fencing, one racing acquire winner, exact renewal, expiry-without-silent-release, observation-first takeover, ambiguous replacement blocking, clean owner release, and the C18 atomic ambiguous-intent-finalization-before-released|expired-reservation rule. No higher-fence replacement exists until every old intent and the old reservation are terminal. A foreign or unknown effect observation can never preserve or restore active status or admit a new effect; only C21's named authoritative nonforeign no-effect refusal rows can preserve active status for a separately authorized new intent. Every prepare/write checkpoint is atomic and restart-readable."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "Fast-forward integration, ordinary local-file push, and partial-success recovery",
        "criterion": "Repository-owned disposable Git tests prove the exact C17 envelope, C21 mutually exclusive and exhaustive receipt equality/nullability matrix and C18 state machine: only a clean repository with a target ref not checked out by any worktree and at a distinct expected SHA-1 object can use trusted update-ref expected-old CAS to fast-forward to the owned source HEAD without index/worktree mutation. Non-ancestor, already-at-source acquisition, checked-out target, dirty/untracked/ignored/reparse, identity drift, another actor's target change and non-FF updates refuse or return the exact no-effect classification. Ordinary push uses one explicit non-force object-to-ref refspec and a canonical local bare destination beneath the trusted root; URL/UNC/device/network/credential/helper/proxy, source or receive hooks, disallowed config, alternates/promisor/replace/grafts/shallow, filters/submodule execution/sparse behavior and repository-selected remote all refuse before effect. Hostile client/receive hook and filter/config sentinel files remain absent. Fixed vectors cover expected remote equal to source, local expected plus remote source, all authoritative cross-products, authoritative absent versus unknown, local-success/remote-not-requested, proved nonforeign rejection, lost response, foreign state, remote-success/finalization-loss and target-CAS conflict. Foreign, unknown, and inconsistent observations prohibit new effects and use atomic inspect-only terminal recovery; only named nonforeign no-effect refusals admit a separately authorized new intent."
      },
      {
        "id": "V11",
        "type": "automated",
        "target": "Policy-authorized owned workspace cleanup",
        "criterion": "Focused application/adapter one-field matrix and fixed canonical digest vectors prove cleanup reaches filesystem/Git access only with the exact current C20 attestation and its current workspace.cleanup grant/confirmation, ProjectPolicy allow, generic completion/terminal-execution fact, fresh external gate/preservation digests, released/expired-or-not-required integration disposition, exact ownership receipt/manifest/live Git inventory, and expected HEAD/ref. Pre-prepare issuance fails; post-prepare issuance excludes exactly the one identity-matching pending cleanup intent; its final-authorization transaction atomically persists the attestation and advances that intent to executing; point-of-use revalidation excludes exactly that executing intent; any other unfinished workspace intent, phase/identity mismatch, restart drift or racing insert refuses before root access. Null-on-cleanup, nonnull-on-other-operation, stale, expired, substituted, cross-resource, wrong-head/reservation/quiescence or digest-mismatched attestations fail before root access. Every dirty tracked, untracked, ignored or extra target/admin member, missing, foreign, hardlinked, reparse, identity-swapped, partially published, multiply owned or ambiguous case refuses without deleting user bytes. Successful cleanup quarantines and verifies only owner-bound leaves, removes only the closed workspace inventory without touching C7 evidence or using alias traversal/force/recursive caller deletion, leaves no registration/target, and returns a receipt echoing attestationSha256; post-effect failure remains recoverable ambiguity."
      },
      {
        "id": "V12",
        "type": "automated",
        "target": "Every-checkpoint crash, response-loss, concurrency, and recovery",
        "criterion": "Real SQLite close/reopen and deterministic failpoint tests pass after policy receipt, gate/integration reservation prepare, every C18 effect transition, adapter effect/response loss, observation, verified receipt, finalization, C19 completion CAS, reservation release, cleanup-intent prepare, C20 final-authorization/issuance/executing CAS, point-of-use revalidation, cleanup quarantine and terminalization. No committed intent means no assumed effect; authoritative absent and nonforeign no-effect remain distinguishable from unknown, foreign or inconsistent; every unknown/foreign effect receipt makes or retains ambiguity and blocks new effects; every authoritative recovery terminalizes the old intent with its exact recovered result before atomically releasing or expiring the reservation, while inspected ambiguity leaves both ambiguous. A terminal reservation with a nonterminal old intent, a higher fence before both terminal rows, an attestation without its exact permitted-phase intent, or an excluded second intent is rejected as corruption/conflict. Known authoritative state finalizes exactly once; an expired/stale fence or terminal execution cannot write back; competing workers have one winner; and recovery never duplicates a gate, ref update, push, completion or deletion."
      },
      {
        "id": "V13",
        "type": "automated",
        "target": "Product-library composition, module direction, and unchanged CLI",
        "criterion": "Architecture/package/product tests prove one typed Phase 3 facade derives non-public durable tuples and composes only injected ports; policy, completion, integration and workspace adapters never import application/persistence/product owners or write SQLite; the application calls no concrete adapter; the default product runtime/CLI constructs none of the Phase 3 adapters; the exact ato.api/v1 33-command/37-error grammar, public output and exit mapping remain unchanged; and only approved factories/constants/types are added to the package root."
      },
      {
        "id": "V14",
        "type": "automated",
        "target": "Path, command, prompt, evidence, and redaction security",
        "criterion": "Hostile-shape/security tests prove traversal, root/share/device/ADS/non-NFC/case ambiguity, symlink/junction/reparse, hardlink, path swap, unsafe executable/argv/env, checked-out integration target, source/client/receive hooks, filters, submodules, sparse/alternate/promisor/replace/grafts/shallow state, credential/helper/proxy and disallowed source/destination config are rejected or inert before effect; observable hook/filter/config sentinels prove no execution and no external write. C22 independently checks the actual high-bit BigInt filesystem identities before production serialization and proves no rounded numeric identity can authorize a Project/runtime/persistence or Phase-3 effect. Prompt/Task injection, raw gate/Git output, SQL/stack/credential/path/URL sentinels and adapter exceptions cannot select authority, create passing evidence, or enter durable/public/default output. All fixed bounds reject over-limit input before trusted ingress or effect and no sensitive committed fixture/evidence remains."
      },
      {
        "id": "V15",
        "type": "automated",
        "target": "Disposable Windows Phase 3 end-to-end",
        "criterion": "One no-network Windows fixture beneath .task-artifacts runs a complete injected-library path over real SQLite and local Git: current stage upgrade, workspace reserve/create, policy requirements, C7 external gate evidence and inspection, source commit, gate staleness and rerun, exclusive distinct-target/source reservation, ref-only fast-forward integration, ordinary push to a validated local bare repository, C19 policy-gated completion and terminal execution, separately authorized reservation release, one prepared cleanup intent, atomic final authorization/C20 issuance/executing transition, immediate self-intent-excluding quiescence revalidation, verified owned workspace cleanup, retained/reopenable gate evidence after cleanup, and restart inspection. Only after those assertions the existing fixture harness removes the enclosing artifact root and proves zero survivors. Spaces, NFC Unicode and exact path bounds pass; no D:\\quant, real external repository, network, credential, Codex, scheduler or MCP effect occurs and no support claim is made."
      },
      {
        "id": "V16",
        "type": "automated",
        "target": "Fresh current schema, backup/readback, and compatibility refusal",
        "criterion": "Fresh initialization, exact reopen, backup/restore, schema fingerprint, APPLICATION_STATE_DIGEST_VERSION=2 lifecycle authorization, complete v2 projection/canonicalization, current reader and corruption tests pass for the one replaced schema-version-1 baseline. A prior EP-03B checksum/fingerprint/database/digest-version-1, old vocabulary stage, ato.workspace/v1 request/receipt, future/unknown digest or port, or malformed mixed state is rejected before writable open or effect and remains byte-identical. Backup/restore JSON formats stay version 1 and accept only a backup produced by this exact current schema/digest-v2 reader; no migration or downgrade path is created."
      },
      {
        "id": "V17",
        "type": "automated",
        "target": "Impact-selected and complete offline repository validation",
        "criterion": "All impact-selected policy/completion/integration/workspace/application/persistence/product/security/Windows suites pass with zero fail/skip/todo, followed by pnpm verify:offline exiting 0 through exact source lint, strict typecheck, build, complete test discovery, docs, offline dependency shape, package smoke, Windows SQLite and truthful Codex blocked-boundary checks. Successful wrappers begin and end with an absent .task-artifacts root and no generated tracked output."
      },
      {
        "id": "V18",
        "type": "not_applicable",
        "target": "Network registry vulnerability advisory query",
        "criterion": "The current user prohibits product, fixture, dependency and advisory-query network access; the only network exception is the standing-authorized final coordinator ordinary origin/master push after local integration. pnpm dependency:audit and every registry/network advisory query are not run. Offline validation instead proves zero production dependencies, exactly the frozen TypeScript development dependency/lock policy and no added install script or credential source; no vulnerability-status claim is made."
      },
      {
        "id": "V19",
        "type": "manual",
        "target": "Fresh terminal review, documentation, inventory, and Git-flow persistence",
        "criterion": "Fresh independent A1 and every required closure-safe A2 are complete at one exact material state; full doc-gardener, docs check and git diff --check pass; the exact staged inventory contains only declared regular non-reparse task paths and no runtime/secret/generated member; the completed plan is completion-ready and committed once; the current-head pathless prune receipt and all 22 frozen gates pass before ready, FF-only master integration and standing-authorized ordinary push. Final master and origin tracking refs match the terminal commit, master full offline gates are green, cleanup is not invoked, and every intentionally unrun external action is listed."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "A gate or policy receipt can omit one semantic identity and remain falsely fresh after Task, execution, workspace, HEAD, policy, command, adapter or environment change."},
      {"id": "R2", "risk": "A policy adapter or product facade can become a second authorization/domain owner or let untrusted Task/repository content select commands and mutations."},
      {"id": "R3", "risk": "Gate execution can run an unsafe shell/config/helper, leak stdout/stderr/secrets, publish evidence inside mutable Git inventory, suffer alias/replacement, survive response loss ambiguously, or be blindly rerun."},
      {"id": "R4", "risk": "New Tier-2 rows can split writer/reader/digest/backup ownership, admit orphan or stale evidence, expose a partial schema as current, or let rounded numeric filesystem identities collapse distinct Project/runtime/file/lock/receipt objects."},
      {"id": "R5", "risk": "Concurrent integration reservations or expired owners can both mutate the same target ref or write back under stale fencing."},
      {"id": "R6", "risk": "Local integration or push can partially succeed and be disguised as rollback, retried twice, forced, redirected to a network/credential path, execute source/receive hooks or filters, split a checked-out ref from its worktree, or apply over another actor's target change."},
      {"id": "R7", "risk": "Cleanup can consume a stale or cross-resource attestation or delete user/replacement content after a path swap, hardlink/reparse substitution, dirty inventory, active owner, incomplete preservation, or partial quarantine."},
      {"id": "R8", "risk": "Turn success, gate exit, commit, policy allow, integration or cleanup can bypass separate completion authorization, omit the generic/subtype or execution-terminal lineage, leave lease authority live, or violate Manual/Phase-3 exclusivity."},
      {"id": "R9", "risk": "A fresh-only schema/authorization/workspace-port reset can accidentally preserve an old reader or silently accept an earlier database/receipt as compatible."},
      {"id": "R10", "risk": "Concrete adapters can leak into the default CLI/product runtime or widen the package into arbitrary filesystem/Git/command capability."},
      {"id": "R11", "risk": "Raw paths, policy/config, gate/Git output, credentials, SQL, stacks or Task content can escape through durable evidence, public results, diagnostics or committed fixtures."},
      {"id": "R12", "risk": "Large cross-cutting changes, master movement, stale audit state or ignored fixture residue can invalidate exact evidence and be incorrectly composed as terminal."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Use one fresh-only current baseline: schema version remains 1 with a replaced immutable migration identity, APPLICATION_STATE_DIGEST_VERSION becomes exactly 2 with one complete current projection, authorization retains stages 1..5 and adds exact stage 6, ato.workspace/v2 replaces v1, and the three new ports start at v1. Keep ato.api/v1 and backup/restore JSON unchanged and reject digest version 1 plus every prior baseline before writable open.",
        "rationale": "This consumes the user's explicit unreleased convergence authorization while preserving independent version namespaces and avoiding any compatibility code or premature CLI configuration surface."
      },
      {
        "id": "D2",
        "statement": "Implement pure exact port kits in project-policy-port.ts, completion-port.ts and integration-port.ts; implement configured local adapters in separate inward modules; extend the Windows workspace adapter only for the exact v2 cleanup behavior; expose narrow factories/types from index.ts and keep all Fakes test-only.",
        "rationale": "Ports remain vendor-neutral and application-owned while concrete filesystem/process/Git mechanics stay outward and package boundaries remain inspectable."
      },
      {
        "id": "D3",
        "statement": "Extend the sole ApplicationTransaction, combined state decoder/readers and digest-v2 projection with explicit policy/gate/generic-and-subtype-completion/integration/cleanup-attestation records and the exact C18/C19 legal CAS transitions; use no parallel database, JSON journal or adapter write. Persist intent and final authorization before each effect and perform every adapter call outside writer transactions. For integration recovery, terminalize the old intent before its reservation in one CAS; for cleanup, prepare one intent, then atomically persist final authority plus its FK-bound attestation and advance that intent to executing before immediate point-of-use revalidation. Update the existing Manual completion writer only to insert the generic parent in its existing transaction.",
        "rationale": "Tier-2 recovery and backup correctness require one closed writer/reader/state identity rather than loosely coupled receipts."
      },
      {
        "id": "D4",
        "statement": "Evaluate policy in two authorization phases: preliminary current policy.evaluate authority, then a pure policy receipt bound to exact observations, then final requested-action authorization using the receipt's allow/deny/defer. Persist the receipt as immutable evidence and independently revalidate it before every later transition.",
        "rationale": "Policy may narrow but never grant authority; this preserves the repository's existing application decision sequence."
      },
      {
        "id": "D5",
        "statement": "Give each gate run/cancel one semantic durable intent and make inspect read-only. The local backend uses the exact separate C7 evidence-root topology and publishes one owner/root/operation-bound final evidence leaf after a bounded non-shell child exits; the leaf is outside Git/workspace inventory and product cleanup, retained across restart, and removed only by the disposable test-artifact harness. Absence, partial publication, replacement, alias or mismatch is indeterminate and requires observation/recovery rather than same-operation rerun. Freshness is computed only by the completion application from the full C4 tuple.",
        "rationale": "A process exit or adapter shape alone cannot prove durable, current completion evidence after response loss."
      },
      {
        "id": "D6",
        "statement": "Use one completion application service and product-library facade to bind current execution success, ready workspace, ProjectPolicy requirements, gate receipts and integration/preservation evidence, then obtain fresh completion.accept confirmation/authority and atomically insert the C19 generic plus Phase-3 decision, commit the existing Domain transition, insert the unique execution-terminal fact and audit, and read back the exact tuple. The terminal fact makes the historical lease non-authoritative; Manual and Phase-3 races have one winner. Release the integration reservation separately after completion and before cleanup.",
        "rationale": "This keeps policy/gates/effects separate from Domain semantics and prevents the adapter, product facade or CLI from becoming a second completion owner."
      },
      {
        "id": "D7",
        "statement": "Represent integration reservation and apply/push operations as the exact separate C9/C17/C18/C21 durable state machines and mutually exclusive/exhaustive receipt equality/nullability matrix. Acquire/renew/takeover/release use the storage owner; apply/push use ato.integration/v1 only after intent and final authorization; inspect is read-only and drives recovery. Reservation acquisition requires distinct expected target and source objects. Apply uses expected-old update-ref only on a target ref not checked out by any worktree and never materializes a worktree. Push uses one explicit ordinary non-force object-to-ref refspec to the validated configured local bare destination. The adapter applies C21's source-first state precedence, independently observes exact local and remote refs before and after every uncertain result, distinguishes authoritative absent from unknown, routes every remaining authoritative inconsistent cross-product through inspected_foreign recovery, sends every foreign/unknown effect observation to ambiguous no-new-effect recovery, and allows active-status continuation only for C21's named nonforeign authoritative no-effect refusal rows. Authoritative inspect recovery finalizes the old intent with an exact result before terminalizing its reservation in one CAS.",
        "rationale": "Local and remote success are distinct facts; serial reservation and observation-based reconciliation close partial success without network authority."
      },
      {
        "id": "D8",
        "statement": "Implement workspace-v2 cleanup by first persisting one unique pending cleanup intent. In one later ApplicationTransaction, prove policy/authorization/owner/terminal-execution/released-reservation/gate/preservation conditions, compute C20 quiescence while excluding exactly that identity-matching pending intent, commit final authorization plus its FK-bound attestation, and advance only that intent to executing. Immediately before the adapter call, revalidate the attestation and quiescence while excluding exactly that same executing intent; any other unfinished intent or phase/identity drift refuses. The backend verifies and echoes the attestation digest, atomically renames exact target/admin leaves to deterministic owner-bound quarantine siblings, verifies their identities, removes only the validated workspace manifest/tree/control inventory bottom-up with no follow, never touches C7 evidence, and recovers any post-rename ambiguity by inspecting those exact quarantine identities.",
        "rationale": "Quarantine captures ownership before deletion and permits restart observation without recursive string deletion or forced worktree removal."
      },
      {
        "id": "D9",
        "statement": "Extend product-runtime.ts with a separately constructed Phase 3 facade that requires injected trusted adapters/configuration; do not add a CLI command or default construction path. Preserve the current Manual facade and ato.api/v1 tables exactly, and prove module DAG/export restrictions statically.",
        "rationale": "The library can close application composition while the current user prohibition on real repositories/network and the absence of a trusted CLI config ceremony remain explicit."
      },
      {
        "id": "D10",
        "statement": "Work in self-consistent port/schema, policy/gate, integration/cleanup, and product/documentation milestones; use exact material trace for every validation/review; reserve integration only for final review; commit once; invoke pathless artifact prune; record all frozen gates with fresh CAS tokens; then ready, FF-only integrate, ordinary push, and run final master gates without cleanup.",
        "rationale": "ExecPlan and Git-flow evidence stay independently auditable and no ignored fixture or stale receipt can be promoted to terminal state."
      },
      {
        "id": "D11",
        "statement": "Close A0 attempt 1 before activation by treating its six findings as approval defects: the independent gate evidence topology is C7, generic completion lineage is C19, integration envelope and recovery are C17/C18, ref-only apply and validated bare push are C10/D7, cleanup proof is C20, and lifecycle digest is exactly version 2. Persist that report and require a different fresh independent A0 over the revised approval bytes.",
        "rationale": "None of these identities, state transitions, or Git safety primitives may be delegated to post-approval implementation judgment."
      },
      {
        "id": "D12",
        "statement": "Close F-A2-EP03C-004 by treating lossless filesystem identity as one cross-owner invariant rather than an adapter-local repair: ProjectRegistry, persistence runtime-layout ownership, persistence file/descriptor/lock/receipt guards, completion evidence, Git integration and workspace mutation all use C22 BigInt device/inode capture before canonical string conversion. Add only the three newly identified production owners and the focused ProjectRegistry test to the approved task scope; existing persistence and Phase-3 test owners remain the executable regression envelope.",
        "rationale": "The observed Windows inode precision loss is one proven replacement-detection and effect-authorization root; leaving directly invoked owners on numeric stat would make the partial repair and exact-identity claims unsound."
      }
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep the proposal and contract edits as the only task state; if a version, action, port, schema, product or authorization boundary lacks a source, revise approval and obtain fresh independent A0 before implementation."},
      {"id": "M2", "recovery": "Return the uncommitted task-owned port/schema/authorization delta to the last complete milestone as one unit; never retain a mixed v1/v2 workspace surface, partial schema identity, old decoder, or temporary compatibility shim."},
      {"id": "M3", "recovery": "Preserve exact disposable gate evidence for read-only inspection, classify the committed durable intent/observation, and repair only the owning port/application transition. Unknown effect remains indeterminate/ambiguous; never rerun merely to make a receipt pass."},
      {"id": "M4", "recovery": "Stop all mutation on reservation/fence/identity drift. Preserve actual local/remote/quarantine observations, reopen through the authoritative decoder, and use only the exact recover edge. Never reset, force, rewrite, recursively delete, or infer rollback."},
      {"id": "M5", "recovery": "Correct the single authoritative code/contract/inventory/status owner and rerun every affected focused and full gate; do not hide a failing surface with package exclusions, CLI aliases, support caveats that contradict code, or fabricated network evidence."},
      {"id": "M6", "recovery": "A failed audit or gate leaves ep-03c reserved and editable. Repair only task-owned files, create a new exact head only when plan order permits, refresh all stale material evidence and prune/gate receipts, and do not run coordinator cleanup or mark the overall goal complete."}
    ],
    "validation_bindings": [
      {"id": "V1", "state_binding": "approval"},
      {"id": "V2", "state_binding": "material"},
      {"id": "V3", "state_binding": "material"},
      {"id": "V4", "state_binding": "material"},
      {"id": "V5", "state_binding": "material"},
      {"id": "V6", "state_binding": "material"},
      {"id": "V7", "state_binding": "material"},
      {"id": "V8", "state_binding": "material"},
      {"id": "V9", "state_binding": "material"},
      {"id": "V10", "state_binding": "material"},
      {"id": "V11", "state_binding": "material"},
      {"id": "V12", "state_binding": "material"},
      {"id": "V13", "state_binding": "material"},
      {"id": "V14", "state_binding": "material"},
      {"id": "V15", "state_binding": "material"},
      {"id": "V16", "state_binding": "material"},
      {"id": "V17", "state_binding": "material"},
      {"id": "V18", "state_binding": "material"},
      {"id": "V19", "state_binding": "material"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Freeze the complete C4 tuple in policy/gate records and centralize freshness in one application function with one-field-at-a-time negative matrices.", "recovery": "Reject the receipt as stale without mutation, obtain new policy requirements, and run a new explicitly authorized gate operation only when current evidence permits."},
      {"id": "R2", "mitigation": "Keep ProjectPolicy pure, require preliminary policy authority, make receipts narrowing-only, inject trusted configuration out of band, and keep Domain/authorization decisions in the application owner.", "recovery": "Remove the leaked decision/config seam and re-run policy, authorization, architecture and hostile-input tests; do not add a policy fallback."},
      {"id": "R3", "mitigation": "Use exact configured executables/argv, shell=false, minimal environment, bounded timeout/output, the separate C7 no-follow evidence topology, process identity and intent-before-effect ordering.", "recovery": "Inspect the exact external owner-bound leaf; missing/partial/replaced/aliased/conflicting state stays indeterminate/ambiguous and requires an explicit new operation rather than blind replay. Product cleanup never deletes gate evidence."},
      {"id": "R4", "mitigation": "Allocate all new rows in one baseline with strict FK/unique/transition guards; use ApplicationTransaction as sole writer and combined reader/digest/backup projection as sole ingress; capture every Project/runtime/file/lock/receipt semantic device/inode identity through C22 BigInt stats before conversion.", "recovery": "Refuse the database and affected Project/runtime identity read-only, preserve bytes, repair the current fresh baseline or identity owner, and rerun exact BigInt, replacement, reopen, corruption and backup tests without migration or SQL repair."},
      {"id": "R5", "mitigation": "Use a partial unique current-target index, monotonic fence sequence, exact owner/lease/revision CAS and observation-first expiry/takeover.", "recovery": "Stop mutations, retain current/ambiguous reservation, inspect target refs, and terminalize only through the matching recover CAS before replacement."},
      {"id": "R6", "mitigation": "Use the exact C17/C18 unions and C21 mutually exclusive/exhaustive state machine; require distinct expected target/source; make apply ref-only expected-old update-ref on an un-checked-out target; separately persist apply/push; reject hostile repository/destination topology and config; prohibit force/network/credentials; and inspect exact local plus configured local-remote refs after every uncertain result.", "recovery": "Preserve local success and exact remote observations. Only a named nonforeign authoritative no-effect refusal may leave active status for a separately authorized new push; unknown, foreign or inconsistent state blocks every new effect and requires authorized inspection that finalizes the old intent before terminalizing the reservation, after which a higher-fence replacement may be acquired."},
      {"id": "R7", "mitigation": "Issue and point-of-use revalidate C20 only after policy, authorization, generic completion/terminal execution, ownership, quiescence, released integration and preservation proof; revalidate no-follow inventory; quarantine exact leaves with identity checks; remove only enumerated regular files/empty dirs; and propagate every acquired/renamed effect.", "recovery": "Inspect deterministic quarantine/original identities, never delete an unproved object or C7 evidence, and keep recovery_required until exact present or absent postconditions are independently proven."},
      {"id": "R8", "mitigation": "Centralize completion in one C19 application CAS that consumes all current evidence and a fresh high-risk decision, writes generic+subtype+Domain+terminal execution atomically, and makes the terminal row defeat stale leases; adapters and facade return facts only.", "recovery": "Leave Task/execution nonterminal on any failed CAS, append only bounded denial/defer evidence, refresh stale gates/policy/integration, and retry completion with a new authorized request; never synthesize a missing parent, subtype or terminal row."},
      {"id": "R9", "mitigation": "Delete old live readers/exports, replace one checksum/fingerprint/action set, set APPLICATION_STATE_DIGEST_VERSION exactly to 2 with the complete projection, assert exact public inventories, and test prior EP-03B bytes/shapes as immutable rejected fixtures.", "recovery": "Stop before writable open/effect, restore one coherent current-only schema/digest-v2 implementation, and never add a bridge to rescue a development database."},
      {"id": "R10", "mitigation": "Keep adapters inward of pure ports, require explicit library construction, forbid default CLI imports/config, and assert exact module DAG, Node built-ins and root exports.", "recovery": "Remove the concrete import/export or unsafe command route and rerun architecture/package/CLI tests rather than adding another facade."},
      {"id": "R11", "mitigation": "Use closed codes, bounded hashes/references and sentinel scans across durable state, public results, manifests, diagnostics and committed evidence; retain no raw child/Git output.", "recovery": "Drop the unsafe field at its owner, invalidate only disposable fixtures, refresh affected evidence and rerun redaction/security tests; never persist then display-redact."},
      {"id": "R12", "mitigation": "Trace before decisions, bind all material evidence to one state, reserve only for terminal review, validate exact inventory, and use task-frozen prune plus fresh-CAS gates.", "recovery": "Classify base or material changes, refresh A0/A1/A2 and validations as required, preserve partial coordinator state, and use only Git-flow recover transitions."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "2485608a1684ea6430adcb8d004979a90d689a69",
      "current_material_base": "2485608a1684ea6430adcb8d004979a90d689a69",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-09-03 12:16:14+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-09-03 13:06:19+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-09-03 13:06:19+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-09-03 13:06:19+08:00"},
      {"id": "M5", "status": "complete", "updated_at": "2026-09-03 13:06:19+08:00"},
      {"id": "M6", "status": "complete", "updated_at": "2026-09-03 13:46:07+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "schema-v3 trace, predecessor terminal-resolve, successor chain-check, and local ref inspection",
        "evidence": "After the F-A2-EP03C-004 approval-scope revision, schema-v3 parsing and current scope inspection identify approval SHA-256 172AD37726545F99A1CD60F142F92043A051CDE4AAA764F36BC0AE764AC30434 over 67435 canonical bytes at unchanged exact base 2485608a1684ea6430adcb8d004979a90d689a69. Fresh independent A0 attempt 7 reproduced those bytes and approved the expanded C22 envelope with findings=[]. EP-03B terminal-resolve and chain-check uniquely select that base; the task branch contains first result commit ad6f6c791fd061a1fb83afa51532a7a0ae33a3c6 plus only the declared repair/terminal-plan delta, with empty outside-scope, overlap and pre-existing-dirty inventories.",
        "state_id": "approval-sha256:172AD37726545F99A1CD60F142F92043A051CDE4AAA764F36BC0AE764AC30434"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "focused port/application/Windows selections plus complete offline test discovery",
        "evidence": "After the post-result BigInt identity repair and F-A1-EP03C-010 byte-length repair, the complete current suite passed 575/575 with zero fail/skip/todo and includes every ProjectPolicy, completion, Windows Phase-3, workspace/Git, ProjectRegistry, persistence and public-export case. Exact project-policy/v1, completion/v1, integration/v1 and workspace/v2 grammars, operation unions, receipt matrices, the required-preservation/requires-integration invariant, cleanup attestation, old-v1 refusal, unchanged ato.api/v1 plus backup-v1 surfaces, lossless BigInt filesystem identity capture, and BigInt file-length equality all passed.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "authorization, application, persistence, failpoint, CLI and package-runtime tests",
        "evidence": "The complete suite proved cumulative authorization stages 1 through 6, stage-6-only completion/integration actions, all four required high-risk actions, one confirmed stage per upgrade, and atomic refusal for stale, revoked, wrong-scope, wrong-root, wrong-policy and wrong-fence paths. Package smoke exercised both the workspace-stage and completion/integration-stage upgrades.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "ProjectPolicy port, configured-adapter and Phase-3 application tests",
        "evidence": "Tests passed the exact four-operation policy grammar, deterministic allow/deny/defer receipts, current Project/config/subject identity, bounded gate/integration/preservation/cleanup facts, the required-preservation/requires-integration cross-field invariant at direct facts and result ingress, duplicate-gate refusal and preliminary policy.evaluate narrowing without SQL, filesystem, Git, grant, reservation, Domain or caller-value mutation.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Completion port/backend/application contract, race and durable-evidence tests",
        "evidence": "The local completion backend passed configured gate execution and immutable digest-only evidence, deletion/replacement/hardlink/reparse/digest-drift refusal, descriptor-based parent/leaf publication and reopen race closure, bounded no-shell command handling, response-loss inspection and closed pass/fail/indeterminate outcomes. Device and inode components are now captured from BigInt stats and canonicalized as exact decimal strings before hashing; independent tests recomputed those identity hashes from BigInt values, and the read/publication race passed 12/12 in repeated isolation. Application tests proved prepare/final authorization before the outside-transaction effect and no blind semantic replay.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "gate identity/freshness matrix and live Git/evidence substitution tests",
        "evidence": "Required gates were accepted only for the exact Task/execution/fence/workspace/generation/revision/ownership/repository/HEAD/policy/config/gate/command/adapter/evidence/tool/environment tuple. Physical file and directory identities use lossless BigInt device/inode capture. Metadata-only HEAD advance, symbolic or detached mismatch, ownership substitution, object-topology drift, evidence deletion/replacement/hardlink/reparse and digest mismatch all made old evidence unusable before spawn or completion.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Tier-2 architecture/schema/reader-writer tests plus focused Project/runtime/file identity regressions",
        "evidence": "The complete current 575/575 suite and current focused 12/12 persistence path selection prove the single writer/combined-reader/digest-v2 closure and exact fresh-only schema, backup/restore and doctor behavior. ProjectRegistry, trusted runtime directories, owned runtime layout, persistence regular files, lifecycle locks and connection receipts capture device/inode through BigInt lstat/fstat before exact decimal serialization; actual filesystem receipts are independently recomputed from BigInt stats, synthetic values above MAX_SAFE_INTEGER retain distinct decimal identities, unsafe numeric mode/size conversion is rejected, the read byte-length equality stays BigInt until decided, and path/descriptor/reopen/replacement guards fail closed.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Phase-3 completion application, product facade, Domain and real-SQLite tests",
        "evidence": "Only complete current policy, freshly reopened passing gates, terminal integration/preservation where required, current high-risk authority and exact CAS bindings completed the Task. Generic plus Phase-3 decision, Domain transition and unique terminal execution fact committed atomically; replay was exact and missing, stale, failed, indeterminate or competing evidence left Task/execution nonterminal. Manual observable behavior and completion separation remained intact.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "real-SQLite reservation, lease/fence, failpoint, concurrency and recovery tests",
        "evidence": "Tests proved one current reservation per exact target, distinct target/source, monotonic fences, one racing acquire winner, exact renewal, observation-first takeover, old-intent terminalization before reservation release/expiry, and blocking of higher fences under unresolved ambiguity. Only named authoritative nonforeign no-effect results retained an active reservation; foreign, unknown and inconsistent observations terminalized through inspect-only recovery.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "local Git integration adapter, equality-matrix, hostile-configuration and composed Windows tests",
        "evidence": "Disposable local Git tests passed inspect, expected-old ref-only fast-forward and explicit non-force local-file push, including expected-remote/source and authoritative absent/foreign/unknown cross-products plus response-loss recovery. Direct repository paths, Git metadata directories and open descriptors now retain exact BigInt device/inode identities. Checked-out targets, non-FF, dirty inventory, live source drift, escaped gitdir/common/object topology, alternates, unsafe config/hooks/filters/helpers/proxies/URLs and pointer swaps refused before effect; no network or credential source was used.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "cleanup application/adapter point-of-use, attestation, inventory and race tests",
        "evidence": "Cleanup reached the backend only after current actor, grant revision/expiry, policy receipt/config/expiry, completion/terminal-execution, released integration, exact ownership, self-intent-excluding quiescence and integration-derived preservation were revalidated at point of use. Workspace mutation identities now retain exact BigInt device/inode components. Revocation, expiry, policy drift, actor substitution, forged/stale attestation, dirty or foreign inventory, hardlink/reparse/path swap and partial publication all refused without deleting replacement bytes; successful fixture cleanup removed only the exact owned generation and retained gate evidence.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V12",
        "status": "passed",
        "method": "every-checkpoint failpoint, response-loss, close/reopen, concurrency and ambiguity tests",
        "evidence": "The complete suite reopened every durable prepare/execute/observe/verify/finalize boundary for gate, integration, completion and cleanup. Known authoritative state finalized once, response loss never duplicated a gate/ref update/push/completion/deletion, unknown or foreign effects remained explicit ambiguity, stale fences and terminal executions could not write back, and corrupt terminal-reservation or cleanup-attestation lineage failed read-only.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V13",
        "status": "passed",
        "method": "module-DAG, root-export, product, CLI, package-boundary and installed-consumer checks",
        "evidence": "Architecture tests retained the sole application/persistence/CLI owners and kept concrete Phase-3 adapters behind injected ports; the default product runtime and CLI construct none. The ato.api/v1 33-command/37-error surface remained exact. Package smoke passed 212 files, consumer types, approved root exports, persistence, source/built/installed CLI parity and uninstall after synchronizing the fixed inventory and stage-6 package fixture.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V14",
        "status": "passed",
        "method": "hostile path/command/redaction suites plus actual and synthetic BigInt identity regressions",
        "evidence": "The complete current 575/575 suite, current focused 12/12 persistence path selection and full documentation scan passed. Actual object receipts are compared to independently acquired BigInt stats; synthetic high-bit device/inode values prove production conversion has no Number round-trip; unsafe numeric mode/size is rejected; the persistence read length comparison is statically fixed to BigInt equality; identical-byte replacement, root/parent/leaf swap, hardlink/reparse, live Git topology drift, hostile command/configuration and redaction cases all fail closed. The internal test helper remains excluded from the unchanged package-root export surface.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V15",
        "status": "passed",
        "method": "real Windows composed Phase-3 E2E in the 21-case Windows suite",
        "evidence": "The standalone 21-case real Windows Phase-3 suite passed after the BigInt identity repair, including policy, external gate, source commit and stale-gate rerun, distinct-source/target integration reservation, fast-forward, validated local-bare push, policy-gated terminal completion, release, attested cleanup, retained evidence and restart inspection beneath the registered disposable fixture. Its targeted read/publication replacement race also passed 12/12 in repeated isolation. Spaces and NFC Unicode passed; no real Project, network, credential, Codex, scheduler, MCP or support claim was used.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V16",
        "status": "passed",
        "method": "fresh schema, exact reopen, lifecycle digest, backup/restore and compatibility-refusal tests",
        "evidence": "Fresh initialization and exact reopen passed for the replaced schema-version-1 baseline with digest version 2 and complete current projection. Backup/restore JSON stayed version 1 and round-tripped only the exact current reader. Prior EP-03B checksum/fingerprint/database/digest-v1, old vocabulary/workspace-v1, future versions and mixed malformed state were rejected before writable open or effect without migration or downgrade.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V17",
        "status": "passed",
        "method": "focused impact suites followed by the bundled network-disabled pnpm verify:offline route",
        "evidence": "At current material state git-sha1:b715d8123afe02920876a0b1ba366fba954f716c, pnpm verify:offline exited 0 through lint 283/53, strict typecheck, build, 575/575 tests with zero fail/skip/todo, docs 146/262/22/0, offline zero-production-dependency shape, 212-file package smoke, complete Windows SQLite with zero survivors and truthful Codex blocked evidence. The exact-state persistence path selection passed 12/12 and strict typecheck passed separately after F-A1-EP03C-010 was repaired by retaining raw BigInt fstat size through the byte-length equality. Artifact hygiene observed baseline 0 and terminal 0 and reclaimed the generated root. The post-repair result commit, current-head pathless prune and exact-head gate receipts remain the explicit V19 sequence.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V18",
        "status": "not_applicable",
        "method": "authorization review and offline dependency-shape evidence only",
        "evidence": "The controlling request prohibits registry and advisory-query network access, so pnpm dependency:audit and every registry/network vulnerability query were not run. Offline validation proved zero production dependencies, exactly TypeScript 5.9.3 as the sole development dependency, no install script or credential source, and made no vulnerability-status claim. The final coordinator ordinary origin/master push is the sole separate network exception.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      },
      {
        "id": "V19",
        "status": "passed",
        "method": "fresh exact-state A1, extra user-required independent A2, full documentation gardening, diff hygiene, exact inventory, and corrected terminal pre-commit handoff review",
        "evidence": "Fresh independent A1 attempt 4 reviewed git-sha1:b715d8123afe02920876a0b1ba366fba954f716c and found no residual after independently rechecking every historical A1/A2 root and F-A1-EP03C-010. Because schema-v3 forbids a current A2 closure record when current A1 findings=[], the separately user- and plan-required fresh independent A2 attempt 6 is preserved as accepted history; it bound the same state, found no residual and reported closure_safe=true. Full doc-gardener scanned 146 documents with HIGH=0, MEDIUM=0, LOW=0, candidates=0 and unverified=0; current docs check passed 146/262/22/0 and git diff --check passed. Repair commit 1061f02a19967cc7b7b469f49833f4ed47e5d76c contained the exact 16-path declared regular non-reparse candidate with no runtime, secret, generated, outside-scope, overlap, pre-existing-dirty or unstaged member. When terminal-resolve correctly required the completed path to be newly added, dedicated clean commit aec2b606f37e6a235254297f494c9417576485f8 reopened only the same plan to its declared active path and preserved the deterministic failure evidence; this active-to-completed plan-only addition is the corrected terminal persistence sequence and leaves every material receipt current. The resulting terminal commit, current-head pathless prune, 22 exact-head gates, readiness, FF-only integration, standing-authorized ordinary origin/master push and final master verification remain Git-flow coordinator consumers. Cleanup remains unauthorized and every other external action remains intentionally unrun.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/ep03a_a0_3",
        "independence": "Fresh independent non-drafter, non-reviser, non-implementer, strictly read-only, non-fail-fast A0 attempt 7. Earlier participation was limited to superseded A0 attempts 2 and 5 and no conclusion was reused. No repository, Git, ExecPlan, coordinator, test, build, fixture, ignored-artifact, network, credential, external-repository, cleanup, integration, push, release, deployment, Codex, scheduler, MCP or D:\\quant mutation occurred.",
        "scope": "Complete harness-exec-plan skill/schema/A0 and Tier-2 persistence instructions; AGENTS.md and ARCHITECTURE.md; the complete current schema-v3 proposal and historical A0/A1/A2 records; relevant persistence, completion/workspace, authorization, compatibility, CLI, validation and threat authorities; F-A2-EP03C-004; C22, V7, V14, R4, D12 and milestone recovery; the current ProjectRegistry, persistence runtime/file-identity, completion, integration and workspace identity call paths; and the complete task-path/test inventory.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-03 12:14:55+08:00",
        "approval_sha256": "172AD37726545F99A1CD60F142F92043A051CDE4AAA764F36BC0AE764AC30434",
        "reviewed_material_base": "2485608a1684ea6430adcb8d004979a90d689a69",
        "evidence": "Exactly one correctly targeted trace returned ok=true with approval_contract_bytes=67435, approval SHA-256 172AD37726545F99A1CD60F142F92043A051CDE4AAA764F36BC0AE764AC30434, approval/current material base 2485608a1684ea6430adcb8d004979a90d689a69 and material state git-sha1:84224f82371679d05075df30f7eba2a1a40ce27e; errors, outside_scope, overlap and pre_existing_dirty were empty and only the accurately preserved W_PREFLIGHT_A2_CONVERGENCE warning remained. Independent duplicate-key-rejecting sorted-key compact UTF-8 canonicalization reproduced the same 67435 bytes and digest. C22 exactly requires every semantic Project/runtime/persistence/completion/integration/workspace device/inode identity to use BigInt lstat/fstat before decimal-string conversion, explicit safe-range mode/size conversion, and BigInt link/length comparisons. The newly added three production paths are the complete directly unclosed owner set and test/project-registry.test.mjs plus already scoped persistence/Windows tests close the executable envelope. V7/V14, R4 and D12 provide binary validation, recovery and one cross-owner implementation choice. The revision changes no API, CLI, schema, backup format, authorization stage/action, external effect, network grant, compatibility policy or support claim and is necessary within the existing user-authorized EP-03C completion scope. Material V7/V14 and A1/A2 remain correctly stale or pending after activation.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/ep03b_a1_1",
        "independence": "Fresh independent non-implementer and non-fixer A1 attempt 4. The review was strictly read-only and non-fail-fast. The reviewer modified no repository, Git, ExecPlan, coordinator, fixture, ignored-artifact, credential, network, external-repository, cleanup, integration, push, release, deployment, Codex, scheduler, MCP, or D:\\quant state; ran no tests or builds; and independently re-evaluated rather than reused prior A1 conclusions.",
        "scope": "The complete EP-03C task-owned material inventory from base 2485608a1684ea6430adcb8d004979a90d689a69, including the active schema-v3 ExecPlan and approval contract; AGENTS.md and ARCHITECTURE.md; authoritative authorization, CLI, policy/completion/integration/workspace, persistence, reliability, compatibility, security, observability, package and validation contracts; schema, writers, combined readers, digest, CAS and recovery paths under the Tier-2 persistence lens; ProjectRegistry, runtime-layout, persistence file/descriptor/lock/receipt identities; completion, integration and workspace adapters; product and package-root exports; documentation and test inventory. The review explicitly rechecked F-A1-EP03C-002 through F-A1-EP03C-010, F-A2-EP03C-001 through F-A2-EP03C-004, the V19 high-bit inode root, semantic dev/ino/nlink/size/byte-length handling, and the package-root export boundary.",
        "reviewed_at": "2026-09-03 13:27:45+08:00",
        "evidence": "Exactly one correctly targeted fresh trace returned schema_version=3, lifecycle=active, ok=true, errors=[], outside_scope=[], overlap=[], pre_existing_dirty=[], approval_contract_bytes=67435, approval SHA-256 172AD37726545F99A1CD60F142F92043A051CDE4AAA764F36BC0AE764AC30434, material base 2485608a1684ea6430adcb8d004979a90d689a69, HEAD ad6f6c791fd061a1fb83afa51532a7a0ae33a3c6, exact material state git-sha1:b715d8123afe02920876a0b1ba366fba954f716c and sole warning W_PREFLIGHT_A2_CONVERGENCE. Fresh static inspection confirmed every semantic Project/runtime/persistence/completion/integration/workspace device and inode originates from BigInt lstat/fstat and converts directly to exact decimal strings; ordinary numeric stats are only presence/type checks; nlink and stat-derived byte-length equality use BigInt. F-A1-EP03C-010 now retains raw BigInt post-read fstat size through equality and has a focused regression. Internal conversion helpers remain absent from the package root. Point-of-use cleanup authority/identity/quiescence, gate reopening, no-follow evidence checks, preservation derivation/combined-reader enforcement, ProjectPolicy cross-field rules, Git topology/source/checkout revalidation, composed Windows lifecycle, completion lineage, terminal execution, schema/digest/vocabulary compatibility refusal and every historical A1/A2 root were independently found closed. git diff --check passed. State-bound 12/12 focused persistence, strict typecheck, Windows Phase-3 21/21 and complete offline 575/575 evidence was inspected but not rerun by the reviewer.",
        "reviewed_state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c",
        "parent_disposition": "complete",
        "closes": [],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["A0-EP03C-001", "A0-EP03C-002", "A0-EP03C-003", "A0-EP03C-004", "A0-EP03C-005", "A0-EP03C-006"],
        "disposition": "superseded",
        "reason": "Fresh independent non-fail-fast A0 confirmed six approval defects before implementation: gate evidence had no cleanup-compatible topology; Phase-3 completion had no generic/Manual/terminal-execution lineage; integration-v1 and its durable recovery states were not exact; apply/push did not close checked-out-ref and hostile source/receive configuration; workspace-v2 cleanup attestation had no exact shape; and the lifecycle digest version was not fixed. The parent confirmed all six, archived the report, added C7/C17-C20 and exact validation/decision rules, scoped the shared Manual writer and affected persistence/security tests, and requires a different fresh independent A0."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-A0-EP03C-007", "F-A0-EP03C-008", "F-A0-EP03C-009", "F-A0-EP03C-010"],
        "disposition": "superseded",
        "reason": "Fresh independent A0 confirmed four residual approval defects: integration receipt codes and their legal matrix were not enumerated; cleanup attestation and quiescence digest projections were not deterministic; three necessarily affected existing test/Fake owners were outside scope while one singular proposal path was spurious; and the blanket real-network prohibition contradicted the required standing-authorized final origin/master push. The parent confirmed all four, archived the report, added exact C20/C21 canonical and receipt matrices, repaired scope, and named the final coordinator push as the sole network exception; another fresh independent A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": ["F-A0-EP03C-011", "F-A0-EP03C-012"],
        "disposition": "superseded",
        "reason": "Fresh independent A0 confirmed two residual integration-contract defects: a foreign refused effect could inconsistently leave the reservation active, and a nullable expected remote ref had no authoritative-absent observation distinct from unknown. The parent confirmed both, archived the report, made every foreign or unknown effect observation enter ambiguous/no-new-effect inspect-only terminal recovery, limited active continuation to the two named nonforeign authoritative no-effect refusal rows, added remoteState=absent, and fixed the complete expected-target/source/expected-remote/null equality matrix across C17/C18/C21 and V2/V9/V10/V12. Another fresh independent A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": ["F-A0-EP03C-013", "F-A0-EP03C-014", "F-A0-EP03C-015"],
        "disposition": "superseded",
        "reason": "Fresh independent A0 confirmed three remaining approval defects: the integration equality matrix overlapped and omitted one fully authoritative cross-product; inspected_foreign could terminalize a reservation without terminalizing its original ambiguous intent; and cleanup quiescence did not define exclusion of its own required intent. The parent confirmed all three, archived the report, required distinct target/source plus source-first exhaustive observation precedence, routed every residual authoritative combination to one inconsistent terminal inspection, atomically finalized every resolved old intent before released/expired reservation terminalization, and fixed cleanup prepare/final-authority/attestation/executing/revalidation ordering with an exact self-intent-only exclusion. Another fresh independent A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 5,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "superseded",
        "reason": "Fresh independent A0 at 2026-09-02 22:40:55+08:00 bound approval digest 14F7EC5BD24D6A393D7A884A71DE30A003C8A1779D073C1456670C683919E770, reviewed base 2485608a1684ea6430adcb8d004979a90d689a69, and material state git-sha1:33c27b419c7f9481e385beb3eca20aa7a18520b9. It independently reproduced 65182 canonical bytes, re-evaluated findings 001–015 as closed, found no new finding, and declared that approval ready_for_activation. The first active trace then exposed W_PREFLIGHT_LIFECYCLE_SCOPE for the helper-required singular proposal sentinel, so the parent returned the plan to proposal, added only that absent ownership sentinel plus its no-duplicate invariant, and requires fresh A0 over the new approval bytes."
      },
      {
        "audit": "A0",
        "attempt": 6,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "accepted",
        "reason": "Fresh independent A0 at 2026-09-02 22:49:27+08:00 bound approval digest 35A308CAA02690A0832FC1C112A3BCD14ACD4259F4AEFE58B5519711BD617065, reviewed base 2485608a1684ea6430adcb8d004979a90d689a69, and material state git-sha1:c9f9c0a330a6702de16e6850ba20c072305a84da. It independently reproduced 65478 canonical bytes, confirmed the helper ownership sentinel remains absent and non-authorizing, confirmed findings 001–015 and the Tier-2 boundary remain closed, found no new finding, and declared the plan ready_for_activation."
      },
      {
        "audit": "A0",
        "attempt": 7,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "accepted",
        "reason": "Fresh independent A0 at 2026-09-03 12:14:55+08:00 bound approval digest 172AD37726545F99A1CD60F142F92043A051CDE4AAA764F36BC0AE764AC30434, reviewed base 2485608a1684ea6430adcb8d004979a90d689a69 and material state git-sha1:84224f82371679d05075df30f7eba2a1a40ce27e. It independently reproduced 67435 canonical bytes, confirmed C22's exact cross-owner BigInt identity rule, the four-path scope expansion, V7/V14, R4/D12, recovery and unchanged authority/API/schema/network boundaries, found no new finding, and declared the revised plan ready_for_activation."
      },
      {
        "audit": "A1",
        "attempt": 1,
        "report_status": "failed",
        "finding_ids": ["F-A1-EP03C-001", "F-A1-EP03C-002", "F-A1-EP03C-003", "F-A1-EP03C-004", "F-A1-EP03C-005", "F-A1-EP03C-006", "F-A1-EP03C-007", "F-A1-EP03C-008"],
        "disposition": "failed",
        "reason": "Independent read-only non-fail-fast review completed at 2026-09-03T03:26:28.1066050+08:00 and preserved eight findings, but its trace returned E_SCOPE for the task-diff change to docs/adr/README.md and therefore issued no valid material state ID. The parent reverted that path, archived the unbindable report at docs/plans/evidence/EP-03C/a1-attempt-1-unbindable.md, and requires a fresh independent A1 before treating any finding disposition as current."
      },
      {
        "audit": "A1",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-A1-EP03C-002", "F-A1-EP03C-003", "F-A1-EP03C-004", "F-A1-EP03C-005", "F-A1-EP03C-006", "F-A1-EP03C-007", "F-A1-EP03C-008", "F-A1-EP03C-009"],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A1 attempt 2 reviewed git-sha1:2ec992d569f2f88ab2e148699f1898443b4aac2c and confirmed eight implementation findings. The parent repaired them, later A2 reviews exposed and closed four adjacent residual roots, V19 then exposed lossy Windows inode capture, and the approval scope plus implementation changed. Attempt 2 remains historical evidence but no longer binds the current material state; fresh expanded-scope A1 attempt 4 replaces it."
      },
      {
        "audit": "A1",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": ["F-A1-EP03C-010"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only non-fail-fast A1 at 2026-09-03 13:13:58+08:00 reviewed git-sha1:f8799bb50f1cd5a4dd0e759442ed7abff050b8f0 and confirmed one in-scope LOW contract residual: readRegularFile converted the BigInt post-read fstat size into number before comparing it with bytes.byteLength. The parent independently confirmed the literal C22/persistence-contract violation, retained raw BigInt size through equality, added an exact static regression, and passed focused persistence 12/12, strict typecheck and complete pnpm verify:offline 575/575 at git-sha1:b715d8123afe02920876a0b1ba366fba954f716c. Fresh exact-state A1 and A2 remain mandatory."
      },
      {
        "audit": "A2",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-A2-EP03C-001"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only non-fail-fast A2 reviewed git-sha1:e6799402be3f110d68da942e9c9f4e47ca7d01a3 at 2026-09-03 09:45:20+08:00 and confirmed one in-scope MEDIUM residual in the F-A1-EP03C-006 family: the Tier-2 combined reader enforced only the not_required preservation digest and accepted a format-valid required digest unequal to verified integration evidence. The parent independently reproduced the reader gap, made it derive the unique expected digest for both dispositions, and added a real SQLite corruption regression proving direct combined read, reopen and doctor refusal. Focused completion tests passed 13/13 and pnpm verify:offline passed 571/571 plus every remaining offline gate at current state git-sha1:9627dff40108e33028f6f9efc9c63b359712c393; a fresh exact-state A2 remains mandatory."
      },
      {
        "audit": "A2",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-A2-EP03C-002"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only non-fail-fast A2 reviewed git-sha1:9627dff40108e33028f6f9efc9c63b359712c393 at 2026-09-03 10:11:57+08:00 and confirmed one in-scope MEDIUM residual in the F-A1-EP03C-004/F-A1-EP03C-009 family: apply checked whether the target ref was checked out only before the pre-effect interlock and could therefore update a ref newly checked out by another worktree during that interlock. The parent independently reproduced the point-of-use gap, made apply recheck target checkout, ancestry and the complete preflight immediately after the interlock and before update-ref, and added a real Git regression that checks out the target branch during the hook and proves apply_refused with unchanged ref and clean unchanged worktree. The complete Windows Phase-3 file passed 21/21 and pnpm verify:offline passed 572/572 plus every remaining offline gate at current state git-sha1:18859222b0278deebd73b1b9a0592e56b82ffd1b; a fresh exact-state A2 remains mandatory."
      },
      {
        "audit": "A2",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": ["F-A2-EP03C-003"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only non-fail-fast A2 reviewed git-sha1:18859222b0278deebd73b1b9a0592e56b82ffd1b at 2026-09-03 10:38:39+08:00. It confirmed the eight original A1 findings and both earlier A2 direct roots closed, then found one in-scope MEDIUM residual in the F-A1-EP03C-006/F-A2-EP03C-001 family: the shared ProjectPolicy facts parser accepted preservation=required with integration=not_required, allowing a contract-impossible canonical durable pair to make equal not-required integration and preservation digests appear healthy. The parent independently reproduced the port-to-writer-to-reader chain, enforced the implication in the single shared parser, added direct-facts and result-ingress rejection, and added a real SQLite regression proving the impossible pair fails direct combined read, doctor and reopen with CORRUPT_ROW/state_corrupt while positive required/required and not_required paths remain green. The focused ProjectPolicy plus completion files passed 16/16 and pnpm verify:offline passed 573/573 plus every remaining offline gate at current state git-sha1:51a1a9f8e3f053de67deb6162f7343628cf5cba4; the localized repair remains within the approved envelope, A1/A0 need not reopen, and a fresh exact-state A2 remains mandatory."
      },
      {
        "audit": "A2",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "superseded",
        "reason": "Fresh independent read-only non-fail-fast A2 at 2026-09-03 11:03:20+08:00 found no residual at git-sha1:51a1a9f8e3f053de67deb6162f7343628cf5cba4 and was valid for that reviewed material state. After result commit ad6f6c791fd061a1fb83afa51532a7a0ae33a3c6, a separately selected exact-head Windows Phase-3 validation exposed that ordinary numeric stat rounded a real inode before canonical identity hashing. The plan was reopened, the completion/workspace/Git effect owners were repaired to capture device/inode through BigInt stats, and attempt 4 no longer binds the current material state; a fresh independent A2 must evaluate both the historical A1/A2 roots and this V19 identity root."
      },
      {
        "audit": "A2",
        "attempt": 5,
        "report_status": "complete",
        "finding_ids": ["F-A2-EP03C-004"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only non-fail-fast A2 at 2026-09-03 12:04:14+08:00 reviewed git-sha1:84224f82371679d05075df30f7eba2a1a40ce27e, rechecked every prior A1/A2 root, and found one HIGH directly adjacent persistence/authority residual: ProjectRegistry, runtime-layout and persistence file/lock/receipt guards still stringified already-rounded numeric device/inode values. The parent independently reproduced the shared root, revised the approval envelope, obtained fresh A0, repaired every semantic identity owner with BigInt stats and safe numeric mode/size conversion, added actual/synthetic/replacement regressions, and requires reopened A1 plus fresh exact-state A2."
      },
      {
        "audit": "A2",
        "attempt": 6,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "accepted",
        "reason": "User- and plan-required fresh independent read-only A2 at 2026-09-03 13:37:57+08:00 reviewed exact state git-sha1:b715d8123afe02920876a0b1ba366fba954f716c after current A1 attempt 4 found no residual. Exactly one trace was clean except the expected convergence advisory. The reviewer independently rechecked every historical A1/A2 root, V19 high-bit inode behavior, all production dev/ino/nlink/size/byte-length semantics, package-root helper exclusion, cleanup point-of-use authorization, gate/preservation/combined-reader enforcement, integration post-interlock checks, SQLite corruption refusal and Windows composed coverage; findings=[] and closure_safe=true. Because schema-v3 requires execution.audits.a2 to be absent when current A1 has no a2_required finding, this extra accepted terminal review is preserved here without inventing a closure edge; M6/V19 and final_summary remain separately pending."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V17",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-03 09:28:24+08:00",
        "evidence": "The first complete pnpm verify:offline attempt passed lint, typecheck, build, 570/570 tests, docs and offline dependency shape, then package:smoke stopped because the worktree-local offline pnpm store was absent. No registry or network access was attempted. The parent copied the already validated EP-03B worktree-local store with exact relative-path, size and SHA-256 equality, 391 members, 133 files, 23661930 bytes and zero reparse points, then retried offline.",
        "state_id": "git-sha1:790eb86d9aeac5bd60e86dca525f95f0e974247e"
      },
      {
        "validation_id": "V17",
        "attempt": 2,
        "classification": "deterministic_failure",
        "at": "2026-09-03 09:28:24+08:00",
        "evidence": "With the local offline store present, package:smoke deterministically reported that its frozen 184-file expected inventory omitted the seven new compiled Phase-3 module families. The parent added exactly those 28 declaration/map/JavaScript/map entries and changed the expected count to 212; no package exclusion or product behavior changed.",
        "state_id": "git-sha1:790eb86d9aeac5bd60e86dca525f95f0e974247e"
      },
      {
        "validation_id": "V17",
        "attempt": 3,
        "classification": "deterministic_failure",
        "at": "2026-09-03 09:28:24+08:00",
        "evidence": "The next package:smoke run passed the corrected inventory and reached its installed runtime consumer, where the fixture incorrectly expected the stage-5 workspace upgrade to expose all stage-6 actions. The parent made the stage-5 assertion use WORKSPACE_STAGE_AUTHORIZATION_ACTIONS, added one separately confirmed stage-6 completion/integration upgrade, and shifted only trusted fixture timestamps. Direct package smoke and the complete offline route then passed.",
        "state_id": null
      },
      {
        "validation_id": "V17",
        "attempt": 4,
        "classification": "deterministic_failure",
        "at": "2026-09-03 11:42:07+08:00",
        "evidence": "The first full offline attempt after reopening the committed terminal candidate stopped in lint before typecheck, build or tests because the governance-required plan move from completed back to active was present only in the worktree while the Git index still named the committed completed path. The repository inventory correctly failed closed on that path identity mismatch. Staging only the exact old and new lifecycle paths makes the index and filesystem agree; no source, product, fixture or validation behavior was repaired or hidden by this workflow correction.",
        "state_id": "git-sha1:84224f82371679d05075df30f7eba2a1a40ce27e"
      },
      {
        "validation_id": "V19",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-09-03 11:31:09+08:00",
        "evidence": "After result commit ad6f6c791fd061a1fb83afa51532a7a0ae33a3c6 and its standing-authorized artifact prune, the exact-head pnpm verify:offline passed 573/573 with an absent terminal artifact root. A separately selected 21-case Windows Phase-3 file then passed 20/21: the identical-byte result-leaf replacement race was once accepted as lifecycle=completed rather than unknown. Eight immediate isolated reruns passed, but independent instrumentation proved Node's ordinary numeric stat rounded actual inode 42502721485294691 to 42502721485294690. Because the implementation canonicalized device/inode only after that lossy number conversion, the exact-identity contract was not deterministic even though the manifestation was intermittent. The terminal candidate, A2 binding, prune receipt and V19 completion claim were reopened for a BigInt identity repair and fresh exact-state review; the failed direct run left only an empty .task-artifacts root and changed no tracked byte.",
        "state_id": "git-sha1:51a1a9f8e3f053de67deb6162f7343628cf5cba4"
      },
      {
        "validation_id": "V14",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-09-03 12:42:29+08:00",
        "evidence": "The first focused ProjectRegistry/persistence identity run at git-sha1:c1e8e2a7d8e6bc9ffa2edc2f0143163506b0d213 passed 25/27. Its two failures came only from a test oracle that assumed every newly allocated Windows inode must exceed Number.MAX_SAFE_INTEGER; exact BigInt recomputation and replacement checks had passed, but inode magnitude is allocation-dependent. The tests were corrected to compare every actual receipt to independently acquired BigInt stats and to exercise synthetic high-bit values through the production conversion helpers, without weakening any implementation guard.",
        "state_id": "git-sha1:c1e8e2a7d8e6bc9ffa2edc2f0143163506b0d213"
      },
      {
        "validation_id": "V17",
        "attempt": 5,
        "classification": "environment_failure",
        "at": "2026-09-03 12:42:29+08:00",
        "evidence": "A focused pnpm typecheck invocation at git-sha1:fe2421635139bf6b8211fa646556388e6ebe26f6 stopped before TypeScript launched because the child command could not resolve node from PATH. The same repository-bundled Node/pnpm runtime with its three prescribed bin directories prepended immediately ran strict typecheck successfully; no source byte was changed to address this environment-only failure.",
        "state_id": "git-sha1:fe2421635139bf6b8211fa646556388e6ebe26f6"
      },
      {
        "validation_id": "V17",
        "attempt": 6,
        "classification": "deterministic_failure",
        "at": "2026-09-03 12:42:29+08:00",
        "evidence": "The first complete 574-test run after the cross-owner repair at git-sha1:fe2421635139bf6b8211fa646556388e6ebe26f6 passed 573/574 and exposed one exact public-boundary defect: export * from project-registry leaked the internal BigInt conversion helper through the package root. The parent replaced only that wildcard with an explicit whitelist of the pre-existing public ProjectRegistry values and types; focused public-export plus identity tests then passed 34/34 and the complete current suite passed 574/574 with unchanged ato.api/v1 and package-root names.",
        "state_id": "git-sha1:fe2421635139bf6b8211fa646556388e6ebe26f6"
      },
      {
        "validation_id": "V19",
        "attempt": 2,
        "classification": "deterministic_failure",
        "at": "2026-09-03 13:44:45+08:00",
        "evidence": "After repair result commit 1061f02a19967cc7b7b469f49833f4ed47e5d76c, terminal-resolve correctly rejected the completed plan because that path already existed in parent result commit ad6f6c791fd061a1fb83afa51532a7a0ae33a3c6; its exact current blob therefore was not newly added and no unique terminal commit existed. No material byte or external state changed. The same plan is reopened through the declared active path in a dedicated history-preserving commit, after which the unchanged exact-state terminal evidence will be re-persisted by the normal active-to-completed addition and terminal-resolve rerun; neither result commit is amended or erased.",
        "state_id": "git-sha1:b715d8123afe02920876a0b1ba366fba954f716c"
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-09-02 21:22:29+08:00",
        "summary": "Closed A0 attempt-1 findings by freezing an external no-follow owner-bound gate-evidence namespace retained outside Git/workspace cleanup; adding a generic completion parent with closed Manual/Phase-3 children and atomic terminal-execution convergence; specifying integration-v1's exact union, bounds, observations, codes and durable recovery transitions; restricting apply to expected-old update-ref on an un-checked-out target and push to a hostile-config-validated local bare destination; defining the complete cleanup-only attestation and receipt digest echo; setting APPLICATION_STATE_DIGEST_VERSION exactly to 2; and expanding scope for the shared Manual writer plus affected persistence and security owners.",
        "previous_approval_sha256": "230C110FAFCDFE0180EBE06D31BC08B22103CD9DDC8C897F3343D2508BF3806C"
      },
      {
        "at": "2026-09-02 21:42:00+08:00",
        "summary": "Closed A0 attempt-2 findings by enumerating the 13 exact integration receipt codes and the complete inspect/apply/push outcome/state/object-nullability/evidence/finalization matrix; defining cleanup attestation and zero-owner quiescence as fixed sorted-key compact UTF-8 canonical projections with uppercase SHA-256 and fixed vectors; adding the authorization-stage and workspace-v2 Fake/test owners while removing the singular proposal typo; and preserving the required standing-authorized final coordinator origin/master push as the sole real-network exception to the otherwise complete product, fixture, dependency, credential and arbitrary-network prohibition.",
        "previous_approval_sha256": "6D796B6CEE46BBE48C7A0AA10A421B81FAE9CCDA0086B090D3D998C101DA26F3"
      },
      {
        "at": "2026-09-02 22:01:08+08:00",
        "summary": "Closed A0 attempt-3 findings by routing every foreign or unknown integration effect observation to ambiguous no-new-effect inspect-only terminal recovery; restricting active continuation to the named nonforeign authoritative no-effect apply_refused and push_rejected rows; adding the explicit remoteState=absent observation for an authoritatively missing expected-null destination ref; and defining the complete local/remote expected-target/source/expected-remote/null equality, nullability, result-code and finalization matrix in C17/C18/C21 plus V2/V9/V10/V12 and D7.",
        "previous_approval_sha256": "5EDF25186C5EAFEE3B99D3CF25DE1A60D7F26F1E6AC1F956C6243D9924C66042"
      },
      {
        "at": "2026-09-02 22:28:04+08:00",
        "summary": "Closed A0 attempt-4 findings by requiring distinct expected target/source objects; imposing a source-first, mutually exclusive and exhaustive local/remote observation partition including expected-remote-equals-source and local-expected/remote-source vectors; giving every authoritative inspected recovery one exact finalized result before deterministic reservation terminalization; prohibiting higher fences until both old rows are terminal; and defining cleanup quiescence to exclude exactly its unique attestation-bound pending or executing cleanup intent under an atomic prepare/final-authorization/issuance/executing/revalidation sequence.",
        "previous_approval_sha256": "A14FEAC387C270409AEF8FA1FC4F0E7A1F637A359E0F2264D3E7EBAFBF6AB384"
      },
      {
        "at": "2026-09-02 22:44:52+08:00",
        "summary": "Closed the activation-only W_PREFLIGHT_LIFECYCLE_SCOPE advisory by adding the helper-required singular docs/plans/proposal path as an ownership-only scope sentinel while explicitly requiring it to remain absent; the sole plan still moves only through proposals, active, and completed, and no implementation, product, schema, authorization, persistence, external-action, or validation outcome changed.",
        "previous_approval_sha256": "14F7EC5BD24D6A393D7A884A71DE30A003C8A1779D073C1456670C683919E770"
      },
      {
        "at": "2026-09-03 12:08:51+08:00",
        "summary": "Accepted fresh A2 finding F-A2-EP03C-004 after V19 proved ordinary Node numeric stat rounded a real high-bit Windows inode. The approval now makes lossless BigInt device/inode capture one cross-owner Project/runtime/persistence/Phase-3 identity invariant, adds only src/project-registry.ts, src/persistence/runtime.ts, src/persistence/values.ts and test/project-registry.test.mjs to the task scope, strengthens V7/V14 and R4, and requires fresh A0 before implementation plus reopened A1/A2 afterward. No public API, CLI, schema, authorization action, external effect, network grant or product-support claim changes.",
        "previous_approval_sha256": "35A308CAA02690A0832FC1C112A3BCD14ACD4259F4AEFE58B5519711BD617065"
      }
    ],
    "final_summary": "EP-03C closes only the approved fresh-only local library boundary for ProjectPolicy, completion gates, durable integration reservation/recovery, configured disposable local-Git fast-forward/local-file push, policy-gated Task completion, preservation derivation, and separately authorized ownership-safe workspace cleanup through explicitly injected adapters; the default product runtime and CLI still construct none of those adapters. Exact material state git-sha1:b715d8123afe02920876a0b1ba366fba954f716c passes pnpm verify:offline through lint 283/53, strict typecheck, build, 575/575 tests with zero fail/skip/todo, docs 146/262/22/0, offline zero-production-dependency shape, 212-file package smoke, Windows SQLite with zero survivors, truthful blocked-only Codex evidence and artifact hygiene baseline/terminal zero; focused persistence path tests pass 12/12. Full documentation gardening reports zero HIGH/MEDIUM/LOW issues, candidates or unverified items. Fresh A0 approved the final 67435-byte contract; fresh exact-state A1 found no residual; the extra user-required independent A2 also found no residual and is recorded as accepted history because current A1 requires no schema closure edge. First result commit ad6f6c791fd061a1fb83afa51532a7a0ae33a3c6 was correctly reopened after V19 exposed lossy Windows inode handling; repair result commit 1061f02a19967cc7b7b469f49833f4ed47e5d76c preserves it and closes the cross-owner root plus BigInt byte-length residual. Terminal-resolve then correctly required a newly added completed path, so plan-only commit aec2b606f37e6a235254297f494c9417576485f8 records the clean active reopening before this corrected terminal addition; no history was amended or erased. The terminal plan commit, current-head pathless artifact prune, 22 exact-head Git-flow gates, readiness, FF-only integration, standing-authorized ordinary origin/master push and final master gates remain authorized coordinator consumers; coordinator cleanup remains separately unauthorized. No dependency advisory query ran and no vulnerability-status claim is made. No real external Project, product/fixture network, credential, Codex adapter/E2E support, scheduler, MCP, PR, release or deployment is implemented or performed."
  }
}
```

## Context

EP-03A and EP-03B are uniquely terminal, FF-only integrated, and pushed at `d0ed2d85c2908e36f8b97a450366ee85ab72368f` and `2485608a1684ea6430adcb8d004979a90d689a69`. The latter exports a product-unwired Windows local Git workspace backend whose reserve/create/inspect/recover behavior is implemented and whose cleanup currently always refuses. The sole current schema is a fresh-only version-1 development baseline, the current authorization vocabulary ends at stage 5, the existing Manual completion path has no workspace or gate meaning, and all ProjectPolicy, CompletionBackend, integration reservation, ref/push, policy-gated completion, and owned cleanup records are still absent. This plan closes only that local injected-library boundary and uses no real Project, remote, product/fixture network, credentials, Codex, scheduler, MCP, D:\quant, release, or deployment; the final Git-flow coordinator push is the sole explicit network exception.
