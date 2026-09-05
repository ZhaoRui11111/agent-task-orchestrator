# ExecPlan：交付显式授权的 Codex 产品组合

本计划从 EP-03E 的唯一终态开始，只组合 EP-03D 明确留给 EP-03F 的 Codex 产品入口、受控配置、owned workspace 与 successor allocation。EP-03E 的 scheduler 仍是独立注入式库，不进入本计划的默认产品路径。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-05 00:17:52+08:00",
    "updated_at": "2026-09-05 09:16:29+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "user request requiring fresh serial EP-03F implementation after completed EP-03E",
        "at": "2026-09-05 00:17:52+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "user request requiring terminal commit, FF-only integration, and applicable ordinary origin/master push",
        "at": "2026-09-05 00:17:52+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "From the unique completed EP-03E terminal, deliver one fresh-only local Codex product composition under an explicit trusted-host-administrator precondition without reinterpreting existing Manual authority: add a Project-scoped trusted Codex profile whose activation result binds the product-supplied fixed OpenAI Codex constructor destination, an allowlisted opaque process credential reference, exact Git executable and disjoint workspace-root identities; add one contiguous finite vocabulary-version-8 Codex stage; require a fresh persisted per-effect authorization result that jointly binds the current profile, constructor identity, credential reference, exact Task/execution/owned-workspace effect and the existing execution/workspace/dispatcher grants before any credential resolution or Task-input disclosure; add a targeted one-member Codex dispatcher route that durably claims a ready Task, reserves and creates an ato.workspace/v2 owned workspace, invokes the existing Codex SDK backend asynchronously, then independently refreshes the workspace HEAD; route Codex inspect, resume, retry, cancellation and crash reconciliation through the existing execution owner; allocate every expired-lease or failed-turn continuation through a fresh targeted one-member continuation run whose claimed member directly owns a new fenced execution and a new ready workspace from an authoritative clean predecessor HEAD while retaining the predecessor as owned evidence; keep completion exclusively behind the existing Phase 3 policy/gate/completion owner; expose the exact profile and Codex operation subset through the sole ato.api/v1 product facade and CLI; replace the unreleased schema-version-1 baseline and application-state digest in place; and keep administrator-managed effective-configuration attestation, real-account E2E, platform/provider support, Manual dispatch changes, scheduled ingress, MCP, release and deployment outside the result.",
    "non_goals": [
      "Do not make Codex the implicit backend of dispatch.run, scheduled delivery, an existing Manual execution grant, Task text, Project content, environment content, or adapter output. The only Codex start route is the exact targeted codex.dispatch-run command plus a current active profile and a fresh Codex effect authorization result.",
      "Do not add a concrete scheduler adapter, compose ato.scheduler/v1 into the default product or CLI, register or invoke a real scheduled task, or assign any EP-03E obligation to this plan.",
      "Do not add a public Phase 3 gate/integration/cleanup command family, automatic Task completion, automatic integration/push/cleanup, or let Codex turn success complete a Task. The existing injected Phase 3 owner remains the sole policy-gated completion path.",
      "Do not perform a real Codex account call, read a real credential, mutate a real external Project/workspace, claim Windows/Codex support, enable model web/network access, or use a real remote during implementation or validation.",
      "Do not accept a credential value, arbitrary destination URL, arbitrary environment-variable name, prompt, Task body, base URL, model option, sandbox mode, network flag, approval policy, executable, or workspace path from Codex output or repository content.",
      "Do not inherit same-user ambient process environment, user Codex home, proxy, API-base, provider, model, SDK configOverrides, executable override or repository configuration into the Codex process. The trusted CLI may name only the exact local Git executable, workspace root and private Codex state root used to establish the profile; none is an SDK transport selector. The local OS administrator, installed Codex executable/runtime and administrator-managed Codex layers are an explicit trusted-computing-base precondition outside the application authorization boundary: the result does not discover, bypass, attest or constrain them, does not treat the constructor tuple as proof of post-managed effective configuration, and makes no endpoint-isolation, no-hook, managed-host, provider or platform support claim against that administrator boundary.",
      "Do not add App Server, MCP, plugins, daemon/service behavior, background polling, arbitrary shell/SQL/filesystem endpoints, release, deployment, PR creation, force operations, compatibility readers, dual writes, or an older schema/API/workspace/execution fallback.",
      "Do not automatically delete predecessor workspaces or coordinator worktrees; safe product cleanup and repository coordinator cleanup remain separately authorized operations."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "The predecessor is docs/plans/completed/EP-03E-durable-scheduler-ingress.md at its unique terminal commit c78b07e9c70f86fcec19feb40c4f2149b82e366a, which is this task's initial material base. EP-03E explicitly assigns no scheduler or sequencing obligation to EP-03F.",
        "source": "docs/plans/README.md, completed EP-03E, and exec_plan.py terminal-resolve evidence"
      },
      {
        "id": "C2",
        "statement": "EP-03D D9 and its final allocation are the only direct EP-03F source: operational Codex composition must obtain an explicit result binding destination, credential reference and workspace effect, and resume/retry successor allocation must own a new fenced execution plus a ready successor workspace.",
        "source": "docs/plans/completed/EP-03D-codex-execution-backend.md"
      },
      {
        "id": "C3",
        "statement": "Vocabulary versions 1 through 7 and their existing grants remain insufficient for Codex. Version 8 adds exactly codex.profile.activate, codex.profile.inspect, codex.profile.deactivate, codex.execution.invoke, and codex.execution.cancel. Activate, deactivate and invoke are high risk; no wildcard or prefix authority exists.",
        "source": "docs/reference/authorization-contract.md and src/authorization.ts"
      },
      {
        "id": "C4",
        "statement": "A profile is Project-scoped trusted configuration, not effect authority. Its exact current record binds profile/revision/status, Project resource/config/root identity, fixed product destination label openai-codex-api, C17 constructor-configuration digest, one allowlisted credential reference process-env:CODEX_API_KEY, exact Git executable identity, exact workspace-root path/key/filesystem identity, a separate private Codex-home path/key/filesystem identity, configuration digest, actor, activation request/decision/audit/confirmation and timestamps. First activation accepts only an existing empty direct Codex-home directory disjoint from the runtime root, Project root, workspace root and every workspace generation; reactivation accepts only the same owned identity and refuses prohibited same-user config.toml, auth.json, rules, skills, plugin or MCP members while retaining only product-observed SDK session state needed for same-thread continuation. The product never automatically deletes this root and does not inspect or attest administrator-managed layers outside it. Paths and the credential reference may exist only in the authoritative profile store; public results expose only credentialConfigured=true and digests, and the secret value never enters the store.",
        "source": "docs/security/privacy-and-logging.md, docs/security/threat-model.md, and existing configured-adapter contracts"
      },
      {
        "id": "C5",
        "statement": "Every start/resume/retry persists a T1 Codex Prepare result before credential-availability inspection and a distinct T6 Codex Act result before credential-value resolution or Task-input disclosure. Prepare binds the active profile/config digest, fixed product destination, opaque credential reference, operation and planned run/member/execution/workspace/intent effect. After the exact pending execution intent exists, Act atomically binds that one intent as its sole consumer, records a fresh confirmation, revalidates the same configuration digest plus the current active profile revision and current codex.execution.invoke grant together with the separately current dispatch.run, execution.*, execution.claim/takeover and workspace.* decisions required by that operation, appends bindingRevision+1 and CAS-advances pending to executing. An unchanged configuration may be reactivated at a higher profile revision and receive a new Act; no Act may change the profile ID/configuration digest or another semantic member. A prior profile activation, Prepare/Act decision, denial, lease expiry or adapter receipt is immutable history and never replay authority.",
        "source": "EP-03D D9, docs/reference/authorization-contract.md, docs/reference/reliability-protocol.md, and docs/security/privacy-and-logging.md"
      },
      {
        "id": "C6",
        "statement": "The production credential resolver recognizes only process-env:CODEX_API_KEY. A non-value availability probe runs only after T1 Prepare and before T2 run creation; an unavailable credential at that point refuses the product operation with no run/member/execution. The value is resolved only after T6 has atomically bound its fresh Act to the exact existing intent and advanced it to executing, is passed only as CodexOptions.apiKey, and is dropped without persistence, hashing, display or raw error propagation. If the value disappears after T4/T6, the exact executing intent records and finalizes a bounded no-effect credential-unavailable adapter failure; it is never treated as a pre-intent refusal. The Codex constructor receives one newly allocated exact options object with baseUrl=https://api.openai.com/v1, the resolved apiKey, env={CODEX_HOME:<profile-bound canonical private path>}, config={model_provider:openai}, no codexPathOverride and no configOverrides. Supplying that one-key env prevents ordinary process.env inheritance; the product supplies the built-in OpenAI provider and base URL, and only the pinned SDK's documented injection of CODEX_API_KEY, CODEX_INTERNAL_ORIGINATOR_OVERRIDE=codex_sdk_ts and its pinned native-package PATH augmentation may add child environment keys. Before every SDK call the product reopens the exact private Codex-home identity and refuses its prohibited same-user configuration/authentication/capability members. These controls govern product and same-user inputs only; they neither inspect nor prove the effective configuration after administrator-managed layers. Tests use an injected fake resolver and constructor seam with sentinel values, and no real secret is accessed.",
        "source": "pinned @openai/codex-sdk 0.153.2 CodexOptions declarations and docs/security/privacy-and-logging.md"
      },
      {
        "id": "C7",
        "statement": "The targeted codex.dispatch-run route creates one exact routeKind=codex-start dispatcher run, membership and member for the requested current ready Task. Its claim transaction alone revalidates the prepared Codex product operation plus current dispatch.run/execution.claim/execution.start authority, transitions the Task to running, creates the initial execution sequence/attempt, resolves the member as claimed and binds it to that execution and the planned Codex product operation; it deliberately creates no execution operation intent before a ready workspace exists. The member owner is codex-product-operation, while every existing Manual/scheduled claimed member remains ownerKind=execution-start-intent with its same manual-local intent. The workspace owner then receives the unchanged direct run/member/execution tuple. After workspace create, the execution owner first creates the preallocated exact pending execution.start intent without credential or Task bytes; only a later T6 transaction may bind a fresh single-consumer Act and advance it to executing before the asynchronous SDK boundary. Manual dispatch.run and scheduled ingress remain bound to manual-local and cannot select a Codex profile.",
        "source": "docs/reference/reliability-protocol.md, docs/reference/scheduler-contract.md, and existing dispatcher ownership"
      },
      {
        "id": "C8",
        "statement": "Initial execution requires a caller-supplied lowercase SHA-1 baseReference that is included in the confirmation/result and independently verified by the configured workspace backend. After a Codex turn, workspace.inspect must authoritatively prove one complete owned clean workspace and refresh the current ready revision/HEAD before any Phase 3 consumer may proceed.",
        "source": "ato.workspace/v2, docs/reference/completion-workspace-contract.md, and EP-03D workspace verifier"
      },
      {
        "id": "C9",
        "statement": "Resume/retry first reconcile the exact predecessor turn and workspace and require an authoritative complete clean predecessor HEAD. Every continuation then creates a fresh routeKind=codex-continuation dispatcher run with one immutable membership/member that binds the source execution/workspace tuple and planned product operation. Its single claim/allocation transaction revalidates the prepared operation, current dispatch.run/execution.claim/execution.resume-or-retry/execution.lease.takeover authority and source evidence; transitions the waiting Task to running; advances the execution sequence; supersedes the source; creates the higher-fence successor; resolves the new member as claimed; and binds that member directly to the successor and product operation. Only afterward may ato.workspace/v2 reserve a new workspace ID/generation 1 from the predecessor HEAD using that fresh direct run/member/successor tuple. The execution owner then creates the preallocated pending same-thread continuation intent; a separate fresh T6 Act atomically consumes that exact intent before any credential/Task/SDK access. The old run/member/execution/workspace stays immutable and explicitly retained; ambiguity or dirty state blocks allocation rather than reusing, rebinding or deleting it.",
        "source": "EP-03D A1 allocation, docs/reference/reliability-protocol.md, and current workspace ownership rules"
      },
      {
        "id": "C10",
        "statement": "Codex turn_succeeded is only execution evidence and leaves the Task running. Policy, fresh gate evidence, integration/preservation requirements, completion.accept confirmation and the final Domain CAS remain exclusively owned by createPhase3ProductRuntime; no Codex product result or CLI presentation fabricates completion.",
        "source": "docs/reference/completion-workspace-contract.md, docs/reference/reliability-protocol.md, and EP-03D C5"
      },
      {
        "id": "C11",
        "statement": "Replace the sole unreleased fresh schema-version-1 baseline in place and advance the application-state digest exactly from version 3 to 4 for profile, Codex effect authorization, dispatcher route/member-owner discrimination and product-operation lineage. Backup/restore JSON formats remain version 1 but accept only the one new current database shape; there is no automatic migration or older-shape reader.",
        "source": "docs/reference/persistence-contract.md and docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C12",
        "statement": "The sole ato.api/v1 adds exactly four command paths: codex.profile.activate, codex.profile.inspect, codex.profile.deactivate and codex.dispatch-run. Existing execution.inspect/resume/retry/request-cancel become backend-discriminating over durable state without caller backend/thread/workspace fields. After hostile-shape parsing, execution.resume/retry first perform C19's exact Codex product-idempotency lookup; only absence falls through to the existing live durable-backend discrimination, so Manual behavior stays exact while a post-T4 Codex replay can reach its recorded successor. The only old grammar extension is optional --confirm on execution.resume/retry: it must be absent for Manual and must equal INVOKE CODEX CONTINUATION for Codex. Every previously valid Manual invocation, result and error remains byte-for-byte unchanged; Manual-only report/completion remain Manual-only.",
        "source": "docs/reference/cli-contract.md and current typed product facade"
      },
      {
        "id": "C13",
        "statement": "Every SDK wait and workspace/credential/adapter access occurs outside SQLite writer transactions. T1 Prepare, T5 intent Prepare, point-of-use T6 Act, observation, verification and finalization each revalidate their applicable runtime actor, Project root/profile identities, configuration digest, profile status/revision, current grants, execution fence and workspace tuple. T6 alone atomically CAS-binds one fresh Act to one existing pending intent and marks effect possible; stale workers cannot write, a denied Act leaves the intent pending, and response loss never permits blind replay.",
        "source": "docs/reference/reliability-protocol.md and AGENTS.md"
      },
      {
        "id": "C14",
        "statement": "Tests may exercise real Git/workspace effects only under the task-frozen .task-artifacts root with an injected fake SDK driver and fake credential resolver. The real production SDK driver is inspected and boundary-tested but no account-backed turn runs; externalE2E remains not_run and supportClaim remains false.",
        "source": "docs/reference/validation-policy.md, docs/compatibility/v0.1.md, and repository artifact policy"
      },
      {
        "id": "C15",
        "statement": "The exact new grammar is: codex profile activate requires --project-id, --expected-project-resource-revision, --expected-project-config-revision, --profile-id, --expected-profile-revision, --workspace-root-key, --workspace-root, --codex-home-key, --codex-home, --git-executable, --idempotency-key and --confirm \"ACTIVATE CODEX PROFILE\"; inspect requires the same Project/profile identity and positive expected profile revision only; deactivate adds --idempotency-key and --confirm \"DEACTIVATE CODEX PROFILE\"; codex dispatch-run requires the same Project/profile identity, --task-id, --expected-task-revision, --base-reference, --idempotency-key, --lease-duration-seconds and --confirm \"INVOKE CODEX TASK\". IDs and both root keys are 1..128 ASCII operational identifiers, ordinary revisions are positive safe integers, activation expected-profile-revision is 0 only for absence and otherwise names the current deactivated revision, lease seconds are 30..3600, base-reference is exactly lowercase 40-hex SHA-1, and paths are absolute NFC, control-free, at most 4096 UTF-8 bytes and reopen as the exact direct directory/regular executable identities. First activation requires an empty private Codex home; reactivation requires the exact prior owned Codex-home tuple. Destination, base URL, credential reference/value, Task body, prompt, working directory, run/member/execution/workspace/thread IDs and SDK options are derived, never caller fields. execution.resume/retry alone add optional --confirm; Manual rejects its presence and Codex requires the one exact continuation phrase. No alias, extension map, alternate phrase or implicit selector exists.",
        "source": "docs/reference/cli-contract.md, docs/reference/versioning-compatibility-contract.md, and current parser/product input contracts"
      },
      {
        "id": "C16",
        "statement": "Profile success payload keys are exactly profileId, projectId, projectResourceRevision, projectConfigRevision, profileRevision, status, destination, credentialConfigured, configurationSha256, replayed in that order. Codex dispatch success keys are exactly runId, status, memberId, profileId, profileRevision, destination, baseReference, taskId, taskState, taskRevision, executionId, executionRevision, attemptNumber, fencingToken, workspaceId, workspaceGeneration, workspaceRevision, workspaceStatus, lifecycle, replayed in that order. Existing execution payloads remain exact. Human and JSON wrappers keep the current one-line ordering/escaping. Add exactly CODEX_PROFILE_NOT_FOUND (exit 5, \"The Codex profile was not found.\"), CODEX_PROFILE_INACTIVE (exit 6, \"The Codex profile is not active.\"), CODEX_CREDENTIAL_UNAVAILABLE (exit 7, \"The configured Codex credential is unavailable.\") and CODEX_ADAPTER_FAILURE (exit 7, \"The Codex execution adapter failed.\") after the existing 37 public errors; all other malformed, authorization, confirmation, Project/Task/execution/run, stale revision/fence, conflict, reconciliation, persistence and ambiguity cases reuse their existing exact mappings. No result contains a path, credential reference/value, prompt/Task body, environment, thread ID, SDK item/output/usage or raw error.",
        "source": "docs/reference/cli-contract.md, src/cli-api-model.ts, and docs/security/privacy-and-logging.md"
      },
      {
        "id": "C17",
        "statement": "The sole product-supplied constructor mapping is an internal constant whose canonical identity is {destination:openai-codex-api,sdk:@openai/codex-sdk,sdkVersion:0.153.2,baseUrl:https://api.openai.com/v1,envKeys:[CODEX_HOME],codexPathOverride:null,config:{model_provider:openai},configOverrides:null,thread:{sandboxMode:workspace-write,networkAccessEnabled:false,webSearchMode:disabled,approvalPolicy:never,skipGitRepoCheck:false}}. That static constructor identity is hashed into the profile configuration and every Prepare/Act effect result; the profile configuration separately binds the canonical Codex-home path/key/filesystem identity used as the sole supplied env value, while the ephemeral apiKey and derived workingDirectory are deliberately excluded. The pinned SDK serializes these product inputs and does not inherit ordinary process.env when env is supplied, so same-user ambient configuration cannot select an application input; prohibited repository/private-home members are refused at point of use. This digest is explicitly not an authoritative receipt of the post-managed effective provider, endpoint, model, sandbox, approval policy or hook set. The local OS administrator, installed Codex executable/runtime and all system-managed layers are trusted preconditions capable of overriding or adding those effects; the product does not discover, bypass or attest them. On a host where that administrator boundary is not accepted, invocation is unsupported and must not be used; externalE2E and supportClaim remain false. A constructor seam proves only the exact product-supplied tuple and rejects every added, missing or changed product field before any fake driver call.",
        "source": "pinned @openai/codex-sdk 0.153.2 declarations/README/implementation, official OpenAI managed-configuration documentation, docs/security/threat-model.md, docs/reference/adapter-contracts.md, and EP-03D D9"
      },
      {
        "id": "C18",
        "statement": "Codex orchestration persists one CodexProductOperationRecord per start/resume/retry with C19's unique public idempotency key, complete original typed public command projection and digest; immutable operation/profile/configuration/T1-Prepare IDs; planned run/member/membership/execution/workspace/execution-intent IDs; and nullable exact source execution/turn/workspace receipt tuple. Every sub-owner idempotency key is derived from the product operation ID and role rather than reusing caller input. Its stage is exactly prepared, member_bound, workspace_ready, intent_prepared, effect_possible, effect_terminal or workspace_refreshed; its separate lifecycle is active, recovery_required, finalized or refused. T1 Prepare precedes credential availability and any run mutation; idempotent dispatcher run creation and one-member sealing are T2/T3; initial claim or successor claim/allocation is the single T4 transaction defined by C7/C9; standard workspace reserve/create transactions occur after T4; T5 uses the execution owner to create only the preallocated exact pending intent and its ordinary prepare binding, without credential value or Task bytes; T6 persists a fresh Codex Act request/decision/audit/result plus a new exact confirmation ID, CAS-links that result and the fresh execution-action Act binding to the same pending intent at bindingRevision+1, advances the intent to executing and product stage to effect_possible in one transaction, and names that intent as the Act's sole consumer. The backend journal records the consumed T6 result before the external SDK call. Any T6 denial appends immutable evidence but leaves the intent pending, stage intent_prepared and lifecycle recovery_required; an exact C19 replay must supply the confirmation again and obtain a new current T6, while an unchanged profile configuration may bind a later active revision. A crash after T6 is effect-possible ambiguity and may only inspect/reconcile, never invoke again blindly. DispatcherMemberRecord adds ownerKind=execution-start-intent|codex-product-operation and nullable codexProductOperationId: Manual/scheduled claimed members require the former plus their same execution.start intent and null product ID, while Codex claimed members require the latter plus one exact product operation and direct same execution, with no Manual intent. Every successor uses a fresh run/member, so ato.workspace/v2 retains member.executionId==command.executionId. Refused is terminal only before T4 and requires no claimed member or allocated execution; if T2/T3 already exist, the member must first resolve non-claimed and existing counts map authorization_denied to partial or failed to failed, never completed. recovery_required is always nonterminal and summary-blocking. After T4, a Codex member remains claimed and the product can become finalized only after its exact preallocated intent exists and is finalized plus any effect-possible ambiguity is authoritatively reconciled and the workspace has a final inspect; there is no if-present bypass. Only then may the claimed-member run summary publish under the existing completed sweep semantics. A deactivated historical profile may be inspected/reconciled without credential or Task disclosure; a pending intent may receive a new Act only after the same profile/configuration is active again, while an effect-possible intent is observation-only. Restart and exact public-command replay resume the recorded stage/lifecycle and never allocate or invoke a second tuple.",
        "source": "current dispatcher member/summary decoder, ato.workspace/v2 direct ownership checks, EP-03D successor allocation, and Tier-2 persistence rules"
      },
      {
        "id": "C19",
        "statement": "The product's authoritative public replay identity is a unique 1..128-byte public idempotency key plus a canonical typed command tuple. For codex.dispatch-run that tuple is exactly {apiVersion:ato.api/v1,command:codex.dispatch-run,actorId,projectId,expectedProjectResourceRevision,expectedProjectConfigRevision,profileId,expectedProfileRevision,taskId,expectedTaskRevision,baseReference,idempotencyKey,leaseDurationSeconds,confirmationAction:codex.execution.invoke}. For execution.resume/retry it is exactly {apiVersion:ato.api/v1,command:execution.resume|execution.retry,actorId,projectId,expectedProjectResourceRevision,expectedProjectConfigRevision,taskId,expectedTaskRevision,executionId,expectedExecutionRevision,expectedAttemptNumber,expectedFencingToken,idempotencyKey,continuationReference,requiredActionReceiptId,confirmationAction:codex.execution.invoke}. The validated tuple and its recursively sorted compact-JSON SHA-256 are both durable and decoder-compared; transient confirmation IDs/times are excluded, while every invocation must still carry the exact phrase required by C15. After parser hostile-shape/bound checks and trusted actor/runtime assertion, but before ordinary current profile/Task/execution readiness, CAS or backend discrimination, the facade looks up CodexProductOperationRecord by the unique public idempotency key. Exact actor/command/tuple/digest match resumes only its recorded stage and preallocated IDs; original expected revisions prove command identity and are not incorrectly reapplied as initial live-state predicates after that operation's own T4, while every stage still performs its C18 current readbacks and fresh authorization/confirmation. Any same-key tuple difference returns the existing IDEMPOTENCY_CONFLICT mapping with zero mutation. Only lookup absence may enter first-call live validation and T1 or fall through to unchanged Manual continuation. Finalized/refused exact replay returns the stored bounded result with replayed=true; active/recovery_required exact replay progresses only the legal recorded stage.",
        "source": "docs/reference/reliability-protocol.md semantic identity rules and existing idempotency-first product-runtime/execution-loop owners"
      }
    ],
    "authorization": {
      "allowed": [
        "Modify only declared repository paths in the fresh ep-03f worktree and use repository-owned disposable Git/workspace fixtures with injected fake SDK and credential boundaries.",
        "Use installed local tools, the pinned local @openai/codex-sdk package and cached dependencies for read-only inspection, implementation and offline validation.",
        "Use official OpenAI documentation for the already-approved SDK contract verification without an account-backed call.",
        "Move this plan through proposal, active and completed after independent audits; create the terminal result commit; invoke pathless manifest-bound artifact prune; record exact-head gates; perform FF-only local integration; and use the repository standing grant for ordinary origin/master push."
      ],
      "requires_reapproval": [
        "Any real Codex account/authentication/credential access, SDK turn, external Project/workspace effect, non-disposable Git destination, or Windows/Codex support observation.",
        "Any network package download, installation, registry metadata request, or fresh network-backed dependency advisory audit. The earlier EP-03E audit authorization and result are not silently reused for a changed EP-03F head.",
        "Any attempt to inspect, bypass, rewrite, attest or make a security/support guarantee about administrator-managed Codex configuration, installed-binary integrity, managed hooks or another local-host administrator control; those remain an explicit trusted precondition rather than application evidence.",
        "Any destination other than the fixed OpenAI Codex API identity, credential source other than process-env:CODEX_API_KEY, model/web/network/sandbox/approval-policy widening, App Server, scheduler composition, public Phase 3 CLI family, MCP, daemon, release or deployment.",
        "Any new dependency, port major, schema version number, authorization action beyond the exact five version-8 actions, command beyond the exact four paths, path outside task scope, PR, or coordinator cleanup."
      ],
      "prohibited": [
        "Read, print, hash, persist or disclose a real credential; call a real Codex account; mutate D:\\quant or another real external Project; or enable Codex network/web/tool authority beyond the fixed SDK options.",
        "Treat Task/repository/model content, environment content, a profile alone, a v1-v7 grant, lease expiry, SDK text, a Fake, or disposable fixture evidence as authorization or support evidence.",
        "Describe the C17 constructor capture as proof of effective post-managed configuration, claim that administrator policy can only refuse, or claim endpoint/no-hook isolation against an administrator-managed host.",
        "Create a compatibility shim, dual current contract, hidden Manual/Codex fallback, arbitrary backend selector, automatic cleanup, PR, release, deployment, force/reset/rebase/stash operation, or coordinator cleanup."
      ],
      "persistence": {
        "required": true,
        "action": "Persist one terminal task-result commit containing the completed plan and task-owned implementation, then use the repository Git-flow contract for current-head artifact pruning, exact-head gates, FF-only local integration, and the standing-authorized ordinary origin/master push.",
        "source": "user request, AGENTS.md, docs/plans/README.md, and docs/reference/local-agent-git-flow.md"
      }
    },
    "scope": {
      "task_paths": [
        { "path": "AGENTS.md", "kind": "file" },
        { "path": "ARCHITECTURE.md", "kind": "file" },
        { "path": "CHANGELOG.md", "kind": "file" },
        { "path": "README.md", "kind": "file" },
        { "path": "package.json", "kind": "file" },
        { "path": "migrations/0001-current-baseline.sql", "kind": "file" },
        { "path": "src/application-policy.ts", "kind": "file" },
        { "path": "src/application-service.ts", "kind": "file" },
        { "path": "src/application.ts", "kind": "file" },
        { "path": "src/authorization.ts", "kind": "file" },
        { "path": "src/cli-api-model.ts", "kind": "file" },
        { "path": "src/cli-api-parser.ts", "kind": "file" },
        { "path": "src/cli-api-presentation.ts", "kind": "file" },
        { "path": "src/cli-api-runtime.ts", "kind": "file" },
        { "path": "src/cli-api.ts", "kind": "file" },
        { "path": "src/cli.ts", "kind": "file" },
        { "path": "src/codex-execution-backend.ts", "kind": "file" },
        { "path": "src/codex-product-application.ts", "kind": "file" },
        { "path": "src/codex-product-configuration.ts", "kind": "file" },
        { "path": "src/codex-sdk-worker.ts", "kind": "file" },
        { "path": "src/completion-application.ts", "kind": "file" },
        { "path": "src/dispatcher-application.ts", "kind": "file" },
        { "path": "src/dispatcher.ts", "kind": "file" },
        { "path": "src/execution-loop.ts", "kind": "file" },
        { "path": "src/execution-port.ts", "kind": "file" },
        { "path": "src/index.ts", "kind": "file" },
        { "path": "src/node-builtins.d.ts", "kind": "file" },
        { "path": "src/product-runtime.ts", "kind": "file" },
        { "path": "src/workspace-application.ts", "kind": "file" },
        { "path": "src/workspace-port.ts", "kind": "file" },
        { "path": "src/persistence", "kind": "directory" },
        { "path": "scripts/codex-contract-lib.mjs", "kind": "file" },
        { "path": "scripts/codex-contract.mjs", "kind": "file" },
        { "path": "scripts/lint.mjs", "kind": "file" },
        { "path": "scripts/package-smoke.mjs", "kind": "file" },
        { "path": "scripts/repo-utils.mjs", "kind": "file" },
        { "path": "test", "kind": "directory" },
        { "path": "docs/README.md", "kind": "file" },
        { "path": "docs/adr/README.md", "kind": "file" },
        { "path": "docs/adr/ADR-007-dispatcher-and-scheduler-lifecycle.md", "kind": "file" },
        { "path": "docs/adr/ADR-008-authorization-and-policy-gated-completion.md", "kind": "file" },
        { "path": "docs/adr/ADR-009-workspace-ownership-and-safe-integration.md", "kind": "file" },
        { "path": "docs/compatibility/v0.1.md", "kind": "file" },
        { "path": "docs/feasibility/codex-stable-public-contract.json", "kind": "file" },
        { "path": "docs/feasibility/codex-stable-public-contract.md", "kind": "file" },
        { "path": "docs/reference/adapter-contracts.md", "kind": "file" },
        { "path": "docs/reference/authorization-contract.md", "kind": "file" },
        { "path": "docs/reference/cli-contract.md", "kind": "file" },
        { "path": "docs/reference/completion-workspace-contract.md", "kind": "file" },
        { "path": "docs/reference/contract-ownership.md", "kind": "file" },
        { "path": "docs/reference/observability-contract.md", "kind": "file" },
        { "path": "docs/reference/persistence-contract.md", "kind": "file" },
        { "path": "docs/reference/reliability-protocol.md", "kind": "file" },
        { "path": "docs/reference/scheduler-contract.md", "kind": "file" },
        { "path": "docs/reference/toolchain-contract.md", "kind": "file" },
        { "path": "docs/reference/validation-policy.md", "kind": "file" },
        { "path": "docs/reference/versioning-compatibility-contract.md", "kind": "file" },
        { "path": "docs/security/privacy-and-logging.md", "kind": "file" },
        { "path": "docs/security/threat-model.md", "kind": "file" },
        { "path": "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md", "kind": "file" },
        { "path": "docs/plans/proposal/EP-03F-authorized-codex-product-composition.md", "kind": "file" },
        { "path": "docs/plans/active/EP-03F-authorized-codex-product-composition.md", "kind": "file" },
        { "path": "docs/plans/completed/EP-03F-authorized-codex-product-composition.md", "kind": "file" },
        { "path": "docs/plans/evidence/EP-03F", "kind": "directory" }
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "The unique EP-03E predecessor, EP-03D allocation, exact profile/effect authorization model, product-supplied SDK constructor identity, explicit trusted-host-administrator limitation, closed CLI grammar/result/error surface and scheduler noncomposition are frozen and independently approved.",
        "validation_ids": ["V1", "V2", "V3"]
      },
      {
        "id": "M2",
        "outcome": "Fresh schema/digest state and one typed Codex product owner durably coordinate profile lifecycle, exact C18 product/member ownership, targeted run/claim, workspace reserve/create, per-effect authorization, asynchronous start and post-turn workspace observation without changing Manual or scheduler behavior.",
        "validation_ids": ["V4", "V5", "V6", "V11"]
      },
      {
        "id": "M3",
        "outcome": "Inspect, cancellation, resume and retry reconcile exact durable evidence; every successor has a fresh targeted run/member that directly owns its new fence and ready workspace while stale workers, dirty/ambiguous predecessors and response loss fail closed.",
        "validation_ids": ["V7", "V8", "V9"]
      },
      {
        "id": "M4",
        "outcome": "Credential resolution, Task disclosure, workspace retention, completion separation, redaction and no-support-claim boundaries are executable and corruption-safe.",
        "validation_ids": ["V10", "V12", "V13"]
      },
      {
        "id": "M5",
        "outcome": "Exact ato.api/v1 CLI/product/package surfaces, documentation, focused suites, full offline gate and dependency evidence agree on the supported local Codex composition and its explicit nonclaims.",
        "validation_ids": ["V14", "V15", "V16"]
      },
      {
        "id": "M6",
        "outcome": "Fresh independent A1 and every required closure-safe A2 accept one exact candidate, and the plan reaches completion readiness before the separately ordered result-commit/prune/gate/integration/push lifecycle.",
        "validation_ids": ["V17"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "Predecessor and chain identity",
        "criterion": "terminal-resolve uniquely returns c78b07e9c70f86fcec19feb40c4f2149b82e366a for completed EP-03E, the fresh ep-03f base equals it, chain-check accepts EP-03E/EP-03F, and no other proposal or worktree is used as design authority."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Finite vocabulary-8 Codex stage",
        "criterion": "Fresh bootstrap remains version 1; one confirmed contiguous upgrade advances 7 to 8 exactly once and adds only the five exact Codex actions for a total of 55; renewal reproduces the exact set; activate/deactivate/invoke are high risk; v1-v7, skipped, stale, revoked, expired, wildcard, content-derived and wrong-scope authority cannot create a profile or Codex effect result."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Profile configuration and activation",
        "criterion": "Hostile-shape, path and identity tests accept only one Project-scoped exact profile with fixed product destination, exact C17 constructor-configuration digest, allowlisted credential reference, current Project root, exact immutable Git executable, disjoint existing workspace root and separate private Codex-home identity; first activation at expected revision 0 requires absence plus an empty direct Codex home, and later activation requires the exact current deactivated profile and owned Codex-home tuple. Activation/deactivation use their exact fresh phrases and atomic request/decision/audit/profile readback, while inspect is read-only. Stale/active-replacement/reparse/overlapping/root/config/profile revisions or prohibited private-home config/auth/rules/skills/plugin/MCP members fail before effect, and no secret value or raw path is accepted into a public result, persisted outside the authoritative profile store or displayed. Tests and docs explicitly do not claim inspection or attestation of administrator-managed layers."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Targeted run, claim and owned workspace",
        "criterion": "A current authorized codex.dispatch-run persists T1 Prepare, verifies credential availability without reading its value, then creates and seals exactly one routeKind=codex-start run/member before the single T4 claim transaction transitions only the requested eligible ready Task, creates its initial sequence/execution and binds a codex-product-operation member without a premature execution intent. The unchanged ato.workspace/v2 direct owner check then reserves and creates exactly one generation under the profile root with the supplied verified SHA-1 base reference. T5 creates the preallocated pending execution.start intent; only a distinct fresh T6 single-consumer Act plus exact profile, run/member/product-operation/execution/fence/workspace readbacks may advance it to executing and reach credential/Task/SDK access. Manual/scheduled members retain execution-start-intent ownership; denial or failure cannot fall back, include another candidate or create a partial alternate owner tuple."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Per-effect Codex authorization",
        "criterion": "Start/resume/retry each persist T1 Prepare before availability inspection and one fresh T6 Act lineage binding the constructor digest, credential/profile/Task/execution/workspace effect and exact existing pending intent before Task bytes cross the adapter. Start requires INVOKE CODEX TASK and continuation requires INVOKE CODEX CONTINUATION at T1 and obtains a new exact confirmation ID again for every T6 attempt, while Manual continuation rejects --confirm and remains unchanged. T6 revalidates every current grant, active same-configuration profile revision, Project root, constructor digest, fence and workspace; in one transaction it appends the next Act binding, names the intent as sole consumer and advances pending to executing. Denied/throwing confirmation, inactive/replaced configuration, revoked/expired grants and point-of-use races create immutable denial only, keep the intent pending/recovery_required and cause zero credential resolution, Task disclosure or SDK calls. C19 exact replay is found before live revisions, creates a new decision/confirmation and may CAS-bind only the unchanged recorded intent; same-key/different-tuple conflicts and old allows/denials never replay."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Async SDK start and post-turn workspace refresh",
        "criterion": "Injected-driver product tests prove the preallocated pending execution intent is created only after member_bound/workspace_ready, T6 atomically moves it to executing/effect_possible, and credential resolution, Task loading and the SDK call occur only afterward and outside writer transactions with exact ephemeral Task bytes, fixed network-disabled/workspace-write/approval-never product options and verified cwd. A backend journal records the consumed T6 result before the driver. Thread and terminal evidence follow the existing reliable protocol; after terminal observation, workspace.inspect independently records the actual complete clean HEAD as the current ready revision and only then may finalize C18. Missing/invalid/dirty workspace evidence cannot become completion-ready or a terminal run summary."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Backend-discriminating inspect and cancellation",
        "criterion": "Existing execution.inspect and request-cancel derive Manual versus Codex only from exact durable ownership. Codex inspect/reconcile uses no Task disclosure or credential, remains available for retained/deactivated historical profiles, and never calls the model; cancellation additionally requires current codex.execution.cancel plus execution.cancel and truthfully returns terminal/no-effect/ambiguous outcomes without cross-family access or Manual regression."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Successor execution and workspace allocation",
        "criterion": "For expired-lease resume and failed-turn retry, exact predecessor observation plus an authoritative complete clean predecessor workspace HEAD are mandatory. T1 Prepare precedes a fresh routeKind=codex-continuation run, immutable one-member membership and source tuple; one T4 claim/allocation transaction advances the Task and sequence, supersedes the old attempt, creates one higher-fence successor, and binds the new member/product operation directly to that successor. The unchanged workspace owner check accepts only that new member/execution and allocates one new workspace ID/generation 1 from the predecessor HEAD; T5 then creates the preallocated pending same-thread intent and T6 alone makes it effect-possible. Competing writers yield one complete winner, and old members/fences, dirty/partial/ambiguous workspaces, missing receipts or wrong threads create no alternate run, workspace or SDK replay."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Crash, restart and reconciliation",
        "criterion": "Every C18 boundary across profile decision, T1 Prepare, credential availability, targeted run creation, membership sealing, atomic T4 allocation, workspace reserve/create, T5 pending-intent Prepare, atomic T6 Act/CAS, SDK journal/effect, observation/receipt/finalization, workspace inspect and product/run finalization is failpoint-tested. The identical original C19 command after T4, workspace readiness and T5 is looked up before now-stale live revisions and resumes the one recorded stage; same key with any changed tuple returns IDEMPOTENCY_CONFLICT. Crash after T5/before T6 plus confirmation failure, deactivation/reactivation, config change, grant revocation/expiry and fence/workspace drift leave one pending intent, immutable denial and zero credential/Task/SDK access. Crash after T6 is effect-possible and observation-only. Pre-T4 refused has no claimed member/execution; post-T4 recovery_required is nonterminal and blocks summary; credential disappearance after T6 finalizes through the exact intent. No replay creates or invokes a second run/member/execution/workspace/intent/SDK tuple."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "Credential, destination, disclosure and redaction",
        "criterion": "The production resolver accepts only process-env:CODEX_API_KEY and never reads it before a current Prepare result. A constructor seam proves exact equality with the product-supplied C17 tuple: baseUrl=https://api.openai.com/v1, apiKey only at the final boundary, env containing exactly the profile-bound CODEX_HOME, config containing exactly model_provider=openai, omitted codexPathOverride/configOverrides, and exact thread options; same-user ambient/caller base/provider/proxy/key/model/executable/config additions, private-home identity/prohibited-member drift or any constructor digest mismatch cause zero fake-driver calls. Tests separately prove the pinned SDK argument order and its documented key/originator/native PATH injection, but do not label either as effective post-managed proof. Threat-model, CLI, probe and package assertions name the OS administrator/installed runtime/managed layers as TCB, make no endpoint/no-hook guarantee against them, and retain externalE2E=not_run/supportClaim=false. Sentinel tests prove credential value, Task body, prompt, Project/workspace/Git/Codex-home paths, destination URL internals, SDK item text, commands, output, usage and raw errors are absent from SQLite outside the authoritative profile store, audits, events, results, CLI, diagnostics, feasibility files and committed evidence."
      },
      {
        "id": "V11",
        "type": "automated",
        "target": "Fresh persistence and typed corruption closure",
        "criterion": "The sole schema-version-1 migration, exact checksum/fingerprint, combined decoder, application-state digest version 4, backup/restore/doctor/restart and corruption suites cover every profile, Codex effect authorization, routeKind, member owner union, C18 stage/lifecycle/binding field and C19 public tuple/digest exactly once. Decoder matrices require a unique product public idempotency key; exact typed tuple/hash agreement; derived sub-owner keys; Manual/scheduled claimed members to own one same-execution manual execution.start intent and Codex claimed members to own one exact same-execution product operation; refused only before T4 with no claim/execution; recovery_required always nonterminal; T6 Act exactly one-to-one with an existing intent/binding revision; effect_possible exactly executing; every successor a distinct run/member; workspace ownership direct equality; and every claimed Codex summary requires finalized product operation plus its exact finalized intent and final workspace inspection. Old digest/schema shapes, duplicate/mismatched replay identities, mixed owner arms, missing/duplicate Act consumers, illegal terminal states, substituted lineage, partial rows and noncurrent databases refuse before writable use."
      },
      {
        "id": "V12",
        "type": "automated",
        "target": "Completion separation and predecessor retention",
        "criterion": "Codex turn success plus refreshed workspace evidence leaves the Task running and cannot create a generic or Phase 3 completion decision. Only the existing injected Phase 3 policy/gate/integration/preservation/completion path can complete it. Predecessor executions/workspaces remain immutable owned retained evidence through successors, are excluded from current completion, and are never automatically deleted or reused."
      },
      {
        "id": "V13",
        "type": "automated",
        "target": "Manual and scheduler noncomposition",
        "criterion": "All existing Manual dispatch/report/completion/recovery tests remain exact; dispatch.run and every accepted scheduled tuple still create only manual-local members; no scheduler config/target/delivery can select a Codex profile, credential, workspace or SDK; the scheduler probe still reports adapterImplemented=false, externalE2E=not_run and supportClaim=false."
      },
      {
        "id": "V14",
        "type": "automated",
        "target": "ato.api/v1 CLI and product contract",
        "criterion": "Parser/source/build/installed tests prove exactly 37 commands and the complete C15 option/bound/confirmation matrix, including absent/manual and exact-phrase/Codex continuation branches; default and explicit ato.api/v1 parity; retired/future versions refuse before runtime open; and no backend/thread/workspace/destination/credential/SDK selector. Source/order tests prove C19 lookup occurs only after hostile parsing/trusted runtime assertion but before first-call profile/Task/execution readiness and before Manual fallback, with exact tuple match/replayed=true and existing IDEMPOTENCY_CONFLICT on mismatch. C16 exact ordered payloads and terminal asynchronous status emit one bounded line, exactly four new public errors extend 37 to 41, every internal outcome maps exhaustively, forbidden fields are absent, and every previously valid Manual invocation/result/error remains byte-for-byte compatible."
      },
      {
        "id": "V15",
        "type": "automated",
        "target": "Architecture, package and focused regression suite",
        "criterion": "Module-DAG, public-export, package-consumer and hostile-boundary tests prove one application/persistence/authorization owner, one supported Codex product factory with closed production credential/profile/workspace construction and private injected test seams, one internal C17 constructor mapping, one C18 product/member state machine, one C19 idempotency-first replay owner, unchanged direct ato.workspace/v2 ownership, no exported secret-bearing object or test Fake, and no second reliability protocol. AGENTS.md and every current-state owner agree on v8/digest4/bounded product composition plus the administrator TCB/no-effective-attestation limitation while preserving all nonclaims. All profile/product/Codex/workspace/dispatcher/authorization/persistence/completion/security/CLI/package tests pass with zero fail, skip or todo and no task-artifact drift."
      },
      {
        "id": "V16",
        "type": "automated",
        "target": "Full offline toolchain, dependency and capability truth",
        "criterion": "At one exact candidate, the unmodified pnpm verify:offline route exits zero through lint, strict typecheck, build, complete tests, docs, dependency shape, package smoke, SQLite, Codex and scheduler probes; the Codex probe reports productComposition=true but externalE2E=not_run and supportClaim=false. git diff --check passes. A fresh network advisory query runs only after separate current authorization; without it, no current vulnerability-status claim is made and offline lockfile/dependency evidence remains exact."
      },
      {
        "id": "V17",
        "type": "manual",
        "target": "Independent audit and terminal readiness",
        "criterion": "Fresh independent A1 has no unresolved finding; every confirmed in-scope HIGH/MEDIUM repair has a fresh closure-safe A2; every other validation is terminal at one exact material state; and exec_plan.py trace reports no error, outside-scope path, overlap, pre-existing-dirty mismatch or blocker other than V17/M6/final-summary fields closed by the terminal edit before result persistence."
      }
    ],
    "risks": [
      { "id": "R1", "risk": "Adding Codex capability can silently reinterpret existing Manual grants or let a profile act as standing effect authority." },
      { "id": "R2", "risk": "Credential or Task content can leak through configuration, environment inheritance, SDK events, errors, persistence or CLI output." },
      { "id": "R3", "risk": "Targeted dispatch and multi-stage workspace creation can leave a running Task or claimed member stranded after a crash." },
      { "id": "R4", "risk": "Async SDK response loss or stale fences can duplicate a turn or write into a replaced execution/workspace." },
      { "id": "R5", "risk": "Resume/retry can reuse a dirty predecessor, lose changes, cross threads, or orphan unowned workspaces." },
      { "id": "R6", "risk": "A post-turn HEAD change can make stale create evidence look completion-ready or bind gates to the wrong commit." },
      { "id": "R7", "risk": "CLI and package exports can expose arbitrary destination, executable, credential, workspace or backend selection." },
      { "id": "R8", "risk": "Codex product wiring can accidentally change Manual dispatch or let scheduler delivery invoke Codex." },
      { "id": "R9", "risk": "Fake SDK/disposable Git evidence can be misreported as real account E2E or platform support." }
    ]
  },
  "execution_contract": {
    "decisions": [
      { "id": "D1", "statement": "Use completed EP-03E commit c78b07e9c70f86fcec19feb40c4f2149b82e366a as the only predecessor and preserve EP-03E scheduler noncomposition.", "rationale": "The serial chain and completed plan are unambiguous, while EP-03E explicitly rejects an invented EP-03F scheduler obligation." },
      { "id": "D2", "statement": "Add vocabulary version 8 with exactly five Codex actions. Existing execution/workspace/dispatcher actions remain necessary but never sufficient; every Task-disclosing effect also requires current codex.execution.invoke plus a fresh exact confirmation/result.", "rationale": "This closes EP-03D D9 without rewriting the meaning of older grants." },
      { "id": "D3", "statement": "Persist one Project-scoped Codex profile whose fixed destination is openai-codex-api, whose only production credential reference is process-env:CODEX_API_KEY and whose separate private Codex-home identity is profile-bound; activation/deactivation are explicit high-risk application transitions and profile inspect is read-only.", "rationale": "A closed profile makes workspace, state-root and credential-reference selection inspectable without persisting a secret or accepting an arbitrary endpoint or ambient user configuration." },
      { "id": "D4", "statement": "Introduce one typed Codex product application owner with the exact C18 stage/lifecycle state machine. It composes existing dispatcher, execution and workspace owners: the dispatcher remains the only initial/successor claim allocator, the workspace owner retains direct member/execution checks, and the execution owner alone creates the pending reliable intent after a ready workspace and atomically consumes the later Codex Act when moving that intent to executing.", "rationale": "A preallocated cross-owner operation plus an existing-intent single-consumer Act closes both workspace ordering and crash recovery without duplicating an owner or leaving replayable authorization between transactions." },
      { "id": "D5", "statement": "Add codex.dispatch-run as an exact targeted one-member start trigger and create one fresh internal targeted continuation run/member for every Codex successor. Keep dispatch.run and scheduled ingress Manual-only; do not add a caller backend selector or let a Manual/scheduled member use Codex ownership.", "rationale": "A distinct start command and fresh continuation membership make every workspace owner tuple direct and inspectable while preserving existing public Manual and scheduler semantics." },
      { "id": "D6", "statement": "Use two-phase per-effect Codex authorization plus the existing execution binding chain: T1 Prepare binds profile/configuration/destination/credential/planned tuple before availability inspection; after T4 and workspace readiness, T5 creates the exact pending execution intent; T6 obtains a new confirmation and atomically binds one current Codex Act plus the fresh execution-action Act to that intent at the next revision while moving it to executing. Credential value, Task bytes and SDK access occur only afterward. Denials remain history and never advance the binding.", "rationale": "Secret and Task access need a current authorization whose sole consumer already exists; atomic binding and effect-possible transition eliminate the crash gap in which an unconsumed Act could otherwise be replayed." },
      { "id": "D7", "statement": "Map openai-codex-api only to the exact C17 product-supplied pinned SDK constructor identity: hard-coded https://api.openai.com/v1 baseUrl, ephemeral apiKey, one-key non-inherited CODEX_HOME env, fixed model_provider=openai config, no executable/raw-config override, and the existing network-disabled, web-disabled, workspace-write, approval-never thread options. Hash that tuple plus the private-home identity into profile/effect decisions and resolve the secret only at this boundary. Treat the local OS administrator, installed Codex runtime and administrator-managed layers as an explicit TCB rather than pretending constructor capture proves their effective policy.", "rationale": "The pinned SDK makes same-user product inputs closed, but official managed-configuration behavior can override or add effective settings; narrowing the claim to the product-supplied tuple and a trusted-host precondition is the only honest boundary without a post-managed attestation interface." },
      { "id": "D8", "statement": "After every terminal Codex turn, run authoritative workspace.inspect and make its complete clean observed HEAD the latest ready evidence. Codex success alone never completes the Task.", "rationale": "The SDK can legitimately change and commit workspace content, so create-time HEAD evidence cannot feed gates or completion." },
      { "id": "D9", "statement": "For expired resume or failed retry, create a fresh targeted continuation run/member, atomically bind it to a newly allocated execution fence, allocate a new directly owned workspace ID from the exact clean predecessor HEAD, resume the same SDK thread, and retain the old run/member/execution/workspace as immutable owned history. Never reuse, rebind, rewrite or automatically delete it.", "rationale": "A new immutable member for each successor fulfills EP-03D allocation while preserving the existing ato.workspace/v2 direct-owner invariant and preventing stale-worker or descendant-ownership ambiguity." },
      { "id": "D10", "statement": "Keep ato.execution/v2, ato.workspace/v2 and ato.api/v1 as the sole current contract majors; add only the exact profile/effect/product-operation records, dispatcher route/member-owner discriminants, four C15 command paths, conditional continuation confirmation field and four C16 public errors, with fresh-only schema/digest replacement and no compatibility reader. The workspace port request and direct run/member/execution ownership predicate remain exact.", "rationale": "The new ordering lives in typed product and dispatcher persistence rather than a parallel port major or weakened workspace rule, while the complete public delta is closed in advance." },
      { "id": "D11", "statement": "Expose a supported Codex product factory and bounded types from the package root, but keep credential values, concrete resolver instances, raw driver types, test Fakes and SDK payloads private. The console constructs only the closed process-env resolver and fixed destination behavior.", "rationale": "Operational composition needs a supported construction path without turning secrets or arbitrary adapters into public data." },
      { "id": "D12", "statement": "Report productComposition=true only for the locally callable authorized route under C17's trusted-host-administrator precondition; retain externalE2E=not_run, supportClaim=false, no administrator-policy attestation and unverified compatibility until separately authorized evidence exists.", "rationale": "Deterministic fakes, constructor capture, official docs and disposable workspaces prove product mechanics, not post-managed effective policy, provider behavior or platform support." },
      { "id": "D13", "statement": "Freeze C15/C16 as the sole public request/confirmation/result/error delta. Existing Manual commands retain their valid behavior; resume/retry confirmation is inspected after C19 product replay lookup or durable first-call backend discrimination, is forbidden for Manual, and never supplies a backend selector.", "rationale": "A closed public contract is required before implementation, and conditional confirmation is the narrow way to authorize Codex continuation without adding a fifth path or exposing durable thread/workspace inputs." },
      { "id": "D14", "statement": "Make C19's stored original public command the sole pre-intent replay authority. Parse hostile input first, then look up the unique product idempotency key before ordinary live readiness; exact match resumes the durable stage, mismatch uses existing IDEMPOTENCY_CONFLICT, and absence alone may create a new product operation or enter unchanged Manual handling.", "rationale": "T4 intentionally invalidates the original live revisions before the execution intent exists, so idempotency-first semantic matching is required to recover without weakening identity or allocating a duplicate tuple." }
    ],
    "milestone_recovery": [
      { "id": "M1", "recovery": "If A0 finds an unsupported authorization, configuration, successor, API or ownership boundary, retain the report, revise only the proposal and obtain fresh independent A0 before activation." },
      { "id": "M2", "recovery": "After parsing, use C19 to reopen the exact original operation before stale live revisions, then restart from its C18 stage/lifecycle through only the existing owner's idempotent/reconcile path. A pending intent has no effect without T6 and may seek only a new current single-consumer Act; an executing/effect-possible intent may only inspect. recovery_required blocks summary, and no tuple is replaced." },
      { "id": "M3", "recovery": "Keep source and successor tuples, old workspaces and every partial result. Use higher fences and exact inspection; never reset, delete, reuse a dirty workspace or blindly resume a thread." },
      { "id": "M4", "recovery": "Any secret/content disclosure or automatic-completion path is a blocking security finding. Remove the unsafe projection, invalidate only disposable evidence and rerun every affected persistence/package/security gate." },
      { "id": "M5", "recovery": "Any material change invalidates state-bound validation. Repair within scope, rerun focused plus full offline routes, preserve truthful not-run external evidence, and request separate authorization before a network audit." },
      { "id": "M6", "recovery": "Confirmed HIGH/MEDIUM findings require repair and fresh A2. Do not complete, commit, prune, gate, integrate or push until trace reports completion readiness." }
    ],
    "validation_bindings": [
      { "id": "V1", "state_binding": "approval" },
      { "id": "V2", "state_binding": "material" },
      { "id": "V3", "state_binding": "material" },
      { "id": "V4", "state_binding": "material" },
      { "id": "V5", "state_binding": "material" },
      { "id": "V6", "state_binding": "material" },
      { "id": "V7", "state_binding": "material" },
      { "id": "V8", "state_binding": "material" },
      { "id": "V9", "state_binding": "material" },
      { "id": "V10", "state_binding": "material" },
      { "id": "V11", "state_binding": "material" },
      { "id": "V12", "state_binding": "material" },
      { "id": "V13", "state_binding": "material" },
      { "id": "V14", "state_binding": "material" },
      { "id": "V15", "state_binding": "material" },
      { "id": "V16", "state_binding": "material" },
      { "id": "V17", "state_binding": "material" }
    ],
    "risk_controls": [
      { "id": "R1", "mitigation": "Require the new invoke action, fresh confirmation and exact durable effect result in addition to existing grants; decoder tests reject every missing/substituted conjunct.", "recovery": "Deactivate the profile, retain evidence and repair the sole product authorization owner before any new effect." },
      { "id": "R2", "mitigation": "Allowlist one opaque reference, bind the C17 product constructor plus private-home identities, resolve at the last boundary into exact baseUrl/apiKey/one-key-env/fixed-provider options, reject same-user ambient/private-home additions, drop SDK item/raw errors and sentinel-scan all durable/default surfaces. Explicitly exclude administrator-managed effective policy from the claim and keep supportClaim=false.", "recovery": "Treat any application-controlled disclosure, state-root drift or constructor mismatch as blocking; if the administrator TCB is not accepted, do not invoke the route rather than pretending the product can attest it." },
      { "id": "R3", "mitigation": "Persist C19's original command/idempotency identity and the C18 operation/preallocated IDs before sub-owner calls; use atomic T4 allocation, T5 pending intent, atomic T6 Act, and failpoint-test every transition.", "recovery": "After hostile parsing, exact-match the product operation before live revisions and reopen only its stage. Pre-T6 stays pending and needs a new confirmed Act; post-T6 is inspect-only. recovery_required and missing/unfinalized claimed intent block summary; mismatch conflicts and never replaces the tuple." },
      { "id": "R4", "mitigation": "Use a one-consumer T6 binding, pre-SDK journal, independent inspect, authorization refresh and fence CAS; test response loss at every boundary.", "recovery": "Retain effect-possible ambiguity and require inspect; never infer absence or invoke again from a lost response, and never reuse a prior Act." },
      { "id": "R5", "mitigation": "Require clean complete predecessor inspection, a fresh continuation run/member, atomic new execution fence, directly owned new workspace identity and exact same-thread binding; preserve the old owned tuple.", "recovery": "Block continuation and leave every source and planned successor fact unchanged until authoritative inspection or reconciliation can resume the exact C18 stage." },
      { "id": "R6", "mitigation": "Always refresh workspace evidence after the SDK terminal event and require the latest ready receipt in Phase 3 binding.", "recovery": "Invalidate stale gate/completion work and rerun workspace inspection and gates against the current HEAD." },
      { "id": "R7", "mitigation": "Keep destination and credential source closed, validate exact Git/workspace/private-home identities and disjointness, expose only the C15 grammar/C16 projections, constructor-capture only the C17 product inputs, name the administrator TCB limitation, and use parser/root/private-layer/package inventory tests.", "recovery": "Remove any arbitrary selector, nonexact public field or overclaim about effective managed policy and rerun CLI, architecture, package and security matrices." },
      { "id": "R8", "mitigation": "Use a distinct targeted trigger and assert Manual/scheduled source-target identities and outputs remain exact.", "recovery": "Fail the candidate, restore the separate route boundary and rerun every dispatcher/scheduler regression." },
      { "id": "R9", "mitigation": "Keep real account calls prohibited, use fake-driver labels, and require probes/docs to state productComposition=true only for local mechanics plus administratorPolicyAttestation=not_run, externalE2E=not_run and supportClaim=false.", "recovery": "Correct any effective-policy/provider/platform capability overclaim before completion and rerun documentation/package/probe gates." }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "c78b07e9c70f86fcec19feb40c4f2149b82e366a",
      "current_material_base": "c78b07e9c70f86fcec19feb40c4f2149b82e366a",
      "base_transitions": []
    },
    "milestone_progress": [
      { "id": "M1", "status": "complete", "updated_at": "2026-09-05 08:57:48+08:00" },
      { "id": "M2", "status": "complete", "updated_at": "2026-09-05 08:57:48+08:00" },
      { "id": "M3", "status": "complete", "updated_at": "2026-09-05 08:57:48+08:00" },
      { "id": "M4", "status": "complete", "updated_at": "2026-09-05 08:57:48+08:00" },
      { "id": "M5", "status": "complete", "updated_at": "2026-09-05 08:57:48+08:00" },
      { "id": "M6", "status": "complete", "updated_at": "2026-09-05 09:16:29+08:00" }
    ],
    "validation_results": [
      { "id": "V1", "status": "passed", "method": "exec_plan.py terminal-resolve/chain-check evidence from the accepted revision-4 A0 and current trace", "evidence": "Completed EP-03E uniquely resolves to c78b07e9c70f86fcec19feb40c4f2149b82e366a, which remains both EP-03F material bases and current task HEAD. Fresh A0 bound the exact 52724-byte approval contract at B3888468FE1D3735571C413063F71661AE3CC420F78CDA13B9D22BFBA8D5D2BD with no finding.", "state_id": "approval-sha256:B3888468FE1D3735571C413063F71661AE3CC420F78CDA13B9D22BFBA8D5D2BD" },
      { "id": "V2", "status": "passed", "method": "authorization, application-service, atomicity, persistence and full discovered tests", "evidence": "Fresh bootstrap and seven separately confirmed contiguous upgrades reach exact vocabulary version 8 with 55 actions; the fifth new Codex action set is exact, high-risk classification is exhaustive, renewal is exact, and skipped/stale/revoked/expired/wrong-scope authority plus every upgrade failpoint refuses without partial state.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V3", "status": "passed", "method": "Codex product profile/configuration tests, constructor capture, decoder corruption and documentation review", "evidence": "Activation/inspect/deactivation enforce the exact Project/profile/revision tuple, fixed openai-codex-api destination, process-env:CODEX_API_KEY reference, immutable Git/workspace/private-home identities, empty/direct first home, same owned reactivation, global workspace disjointness and prohibited-member refusal. Actor/config/creator/alternating-history corruption fails closed; no real credential or administrator-policy attestation was read or claimed.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V4", "status": "passed", "method": "targeted Codex product, dispatcher, workspace and direct-owner integration tests", "evidence": "The targeted start persists T1 before credential availability, creates exactly one codex-start run/member, allocates the initial execution in atomic T4, creates one directly owned workspace, then T5 pending intent and T6 effect transition. Existing Manual/scheduled members retain execution-start-intent ownership and cannot select Codex.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V5", "status": "passed", "method": "C19/T1-T6 authorization order, confirmation, grant-conjunction and zero-disclosure tests", "evidence": "Start and continuation require their exact phrases; C19 exact replay precedes stale live checks while mismatched tuples conflict. T6 persists the versioned canonical required-grant set, every exact usable witness and its digest plus the identical core Act consumer before credential/Task/SDK access. Missing, stale, substituted, detached, revoked, expired, false, throwing and actor-changing cases reject with the required no-effect shape.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V6", "status": "passed", "method": "injected SDK-driver start, terminal, journal, final workspace-inspect and package-boundary tests", "evidence": "The backend journals before SDK access, accepts only one thread.started plus closed turn events, drops item/raw-error payloads, persists bounded terminal evidence, and refreshes authoritative clean HEAD before product/run finalization. Duplicate/missing/malformed terminal/thread evidence and dirty or substituted workspaces cannot summarize or become completion-ready.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V7", "status": "passed", "method": "backend-discriminating inspect/cancel tests over active, deactivated and physically changed historical profiles", "evidence": "Manual remains byte-exact. Codex inspect/cancel derive family only from durable ownership and use historical durable profile/workspace evidence after home absence, inode substitution or structural change with zero credential/model access. Cancellation requires both current Codex and execution authority and retains terminal/no-effect/ambiguous truth.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V8", "status": "passed", "method": "Codex retry/resume successor, direct workspace ownership, concurrency and stale-fence tests", "evidence": "Continuation first proves the exact complete clean predecessor HEAD, then a fresh codex-continuation run/member atomically allocates one higher-fence successor and a new generation-1 workspace from that HEAD. Source evidence remains immutable; wrong thread, dirty/ambiguous/partial predecessor, missing receipt, old fence or competing worker creates no alternate tuple or second SDK effect.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V9", "status": "passed", "method": "every-stage product/reliable-loop failpoint, response-loss, restart and cross-process dispatcher reopening tests", "evidence": "Exact replay resumes the single recorded C18 stage across T2/T4/T5/T6/effect/workspace refresh. Five new-process checkpoints reopen the stable targeted owner while a foreign live owner is refused. After T6, exact journal absence authoritatively permits a fresh-authorized first call; a present unknown/active turn stays observation-only and never calls twice. Credential disappearance finalizes one bounded stored failure.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V10", "status": "passed", "method": "credential/configuration/constructor taxonomy, SDK option capture, sentinel scan and capability probe", "evidence": "Only the opaque fixed process reference is recognized; value resolution occurs after T6 and only as the ephemeral SDK apiKey. Product constructor capture proves the fixed base URL, one-key CODEX_HOME environment, OpenAI provider, null overrides and closed thread options. Credential absence, identity/config drift and constructor/resolver failures remain distinct bounded outcomes; durable/default surfaces contain no secret, Task, path, SDK item, output, usage or raw error. administratorPolicyAttestation=not_run, externalE2E=not_run and supportClaim=false.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V11", "status": "passed", "method": "fresh migration/checksum, combined decoder/digest, corruption, backup/restore/doctor and restart tests", "evidence": "The sole schema-version-1 LF baseline checksum is 6F336B76BFA2A526A69D66B8A8FF554FE45E3415F4852A259EB4345455935E67 and application digest is version 4. Profile creator/actor/config/history, required-grant/core-Act lineage and every terminal public field are reconstructable; surgical deletion/substitution and impossible lifecycle/result combinations refuse as corruption. Backup formats remain version 1 and only the current fresh shape reopens.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V12", "status": "passed", "method": "Codex product, reliable execution and adjacent Phase 3 completion tests", "evidence": "A terminal Codex success leaves the Task running and creates no generic or policy-gated completion decision. Only the existing injected Phase 3 owner can complete with fresh policy/gate/integration/preservation evidence and CAS; predecessor execution/workspace records remain retained and are neither reused nor automatically deleted.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V13", "status": "passed", "method": "complete Manual dispatcher/product regressions and scheduler application/trigger/probe suite", "evidence": "Existing Manual dispatch/report/recovery/completion behavior passes unchanged; scheduled ingress still creates only manual-local execution and cannot select a Codex profile or SDK. The scheduler probe remains ato.scheduler/v1 with adapterImplemented=false, externalE2E=not_run and supportClaim=false.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V14", "status": "passed", "method": "CLI parser/table/runtime/source/build/installed parity and architecture tests", "evidence": "ato.api/v1 has exactly 37 commands and 41 public errors. The four new paths, option bounds, ordered redacted payloads and conditional continuation confirmation are exact; unsupported majors stop before runtime. C19 lookup ordering and Manual absence/fallback are source-asserted and exercised. No caller backend/thread/workspace/destination/credential/SDK selector exists.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V15", "status": "passed", "method": "strict lint/typecheck/build, module-DAG/export tests, package smoke, docs check and incremental doc-gardener review", "evidence": "Lint passed 330 files/63 production sources; strict TypeScript and declarations build passed. Package smoke passed 252 files plus consumer types, exports, persistence, source/build/installed console parity and uninstall. docs:check passed 170 Markdown files/268 links/23 fragments/zero forbidden. Incremental gardener under repository policy ded78c74e14a9dbd7e4321ddf01e788fca5b17c96ea39dbdddc2d14b36f37ab7 scanned/gated 58 docs with issues=0, review_candidates=0 and unverified=0; manual source/config/test semantic review found no current-owner contradiction or capability overclaim.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V16", "status": "passed", "method": "unmodified pnpm verify:offline plus git diff --check at the frozen candidate", "evidence": "The complete offline route exited zero end to end: lint 330/63; strict typecheck/build; 731/731 tests with fail/cancel/skip/todo all zero and artifactHygiene passed at baselineEntries=terminalEntries=3475; docs 170/268/23/0; exact dependency shape; package smoke 252; SQLite 3.53.3/schema 1 with zero surviving generation members; Codex productComposition=true with administratorPolicyAttestation=not_run, externalE2E=not_run and supportClaim=false; scheduler adapterImplemented=false with no E2E/support. git diff --check exited zero with informational line-ending notices only. No network advisory audit ran and no current vulnerability-status claim is made.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" },
      { "id": "V17", "status": "passed", "method": "fresh independent read-only A2 attempt 1 plus parent terminal convergence review", "evidence": "At exact frozen state git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b, fresh independent A2 reproduced a clean trace with approval bytes 52724/SHA-256 B3888468FE1D3735571C413063F71661AE3CC420F78CDA13B9D22BFBA8D5D2BD and errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[]. It independently reviewed the complete task diff, all twelve parent-confirmed A1 repairs, late public-declaration isolation and offline package-smoke removal, and the Tier-2 persistence/recovery boundaries; findings=[] and closes exactly F-A1-EP03F-001 through F-A1-EP03F-012. The exact-absence recovery branch is a newly authorized first SDK call after authoritative proof that the SDK boundary was not reached; every present unknown/active journal remains observation-only. Parent accepts the closure, all other validations are terminal at the same state, and no real credential/account/network/external Project or support claim was introduced.", "state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b" }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "Codex /root/ep03d_a0_3 — fresh independent EP-03F revision-4 A0 attempt 5",
        "independence": "Reviewer did not draft, revise, or implement EP-03F and did not participate in revisions 3/4 or A0 attempts 3/4. The conclusion was independently reconstructed from the complete current approval contract, repository authorities, historical evidence, current implementation, and tests. The review was read-only and performed no file, Git/index, coordinator, dependency, credential, network, Codex-account, SDK-turn, or external-Project mutation.",
        "scope": "Complete EP-03F revision-4 approval and execution contracts; all repository and ExecPlan authorities; Tier-2 persistence; historical A0 attempts 1-4; completed EP-03D/EP-03E boundaries; current authorization, product, CLI, execution, dispatcher, workspace, persistence, Codex SDK adapter, package-boundary, feasibility and test sources.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-05 02:39:57+08:00",
        "approval_sha256": "B3888468FE1D3735571C413063F71661AE3CC420F78CDA13B9D22BFBA8D5D2BD",
        "reviewed_material_base": "c78b07e9c70f86fcec19feb40c4f2149b82e366a",
        "evidence": "no_findings. One required trace exactly reproduced approval_contract_bytes=52724, approval SHA-256 B3888468FE1D3735571C413063F71661AE3CC420F78CDA13B9D22BFBA8D5D2BD, material base/head c78b07e9c70f86fcec19feb40c4f2149b82e366a, and state git-sha1:af905857e8d1c98021441a611fdad0425a71df0f; errors, outside_scope, overlap, and pre_existing_dirty were empty. Independent duplicate-key-rejecting, recursively sorted compact UTF-8 canonicalization matched exactly. The sole W_PREFLIGHT_A0_CONVERGENCE advisory records immutable finding-bearing attempts 1-4 and does not hide a stale-state or scope failure. All F-A0-EP03F-001 through F-A0-EP03F-007 are closed; C19's leaseDurationSeconds field matches the current public typed ingress; no HIGH, MEDIUM, LOW, or scope-contradiction finding remains. Full report: docs/plans/evidence/EP-03F/a0-attempt-5.md.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/ep03d_a0 — A1 attempt 1",
        "independence": "Fresh independent read-only A1. The reviewer did not participate in EP-03F implementation or repair and made no file, Git/index, coordinator, dependency, credential, network, real-Codex, external-Project, or external-state mutation.",
        "scope": "Complete EP-03F material diff and stable task scope at the frozen state; active plan and authorities; Tier-2 persistence lens; authorization, product, dispatcher, execution, workspace, SDK worker, CLI, package, documentation, migration, decoder, security, recovery, and tests; V1-V17 evidence and nonclaims.",
        "reviewed_at": "2026-09-05 07:23:30+08:00",
        "evidence": "Frozen-state trace passed with errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[] at git-sha1:b223a78a0e033550d0aab04c2d11631fa1e752a3, base/head c78b07e9c70f86fcec19feb40c4f2149b82e366a and exact 52724-byte approval SHA-256 B3888468FE1D3735571C413063F71661AE3CC420F78CDA13B9D22BFBA8D5D2BD. git diff --check, typecheck, docs, dependency shape and Codex product probe passed; lint failed on the stale production-source count. The reviewer found nine HIGH and three MEDIUM implementation findings. Full report: docs/plans/evidence/EP-03F/a1-attempt-1.md.",
        "reviewed_state_id": "git-sha1:b223a78a0e033550d0aab04c2d11631fa1e752a3",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-A1-EP03F-001",
            "severity": "HIGH",
            "summary": "Codex continuation replay and active progression bypass the required exact confirmation phrase.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "After C19 lookup and exact durable family discrimination, require byte-exact INVOKE CODEX CONTINUATION before any Codex continuation path can return or mutate; continue rejecting confirmation for Manual and test absent/wrong phrases at every stage.",
            "closure_evidence": "Repaired at git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b: CLI parsing requires the exact phrase, then the runtime checks it only after C19 lookup and durable Codex-family discrimination; Manual forbids it. Absent/wrong/exact cases cover terminal and active stages with zero mutation on rejection. Fresh independent A2 attempt 1 closes this finding at the same state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03F-002",
            "severity": "HIGH",
            "summary": "Process-random targeted dispatcher ownership cannot survive restart before claim or summary.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Reopen or safely take over the exact targeted run through existing dispatcher ownership semantics before owner-bound claim/finalization, preserving C19 identity and rejecting live concurrent takeover.",
            "closure_evidence": "Repaired at git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b: targeted Codex runs use the stable trusted actor/runtime execution-owner identity and reopenTargetedRun before owner-bound claim/finalization, while ordinary Manual workers retain fresh process owners. New-ingress close/reopen passes after targeted-run-created, targeted-member-bound, intent-prepared, effect-possible and workspace-refreshed; a foreign live owner gets LEASE_NOT_EXPIRED. Fresh independent A2 attempt 1 closes this finding at the same state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03F-003",
            "severity": "HIGH",
            "summary": "A crash after T6 but before backend-turn journal creation is treated as permanently ambiguous despite authoritative no-effect evidence.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Inspect the backend journal first; under the current fence, exact turn absence must take the fresh-authorized first-call/no-effect recovery branch while any present uncertain turn remains inspect-only.",
            "closure_evidence": "Repaired at git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b: executing recovery first reads the exact local Codex journal; row absence under the current fence proves the backend never reached the SDK and permits a fresh-authorized first call, while a present unknown/active row remains observation-only. Both pre-journal crash and post-journal response-loss tests pass without a second SDK call. Fresh independent A2 attempt 1 closes this finding at the same state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03F-004",
            "severity": "HIGH",
            "summary": "The T6 durable authorization record omits the versioned required-grant-set digest and prerequisite conjunction evidence.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Persist the exact required-action-set digest and reconstructable linkage/evaluation for every T6 prerequisite at trusted time; decoder corruption tests must reject each missing, stale, or substituted conjunct.",
            "closure_evidence": "Repaired at git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b: the schema/model/writer/decoder persist requiredGrantSetVersion/Json/Sha256 and the exact core Act decision/binding; start and continuation reconstruct their ordered conjunct sets, scopes, grant revisions/usability, policies and consumer equality. Removing any start conjunct or substituting grant revision, owner, policy, runtime scope or core Act fails closed. Fresh independent A2 attempt 1 closes this finding at the same state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03F-005",
            "severity": "HIGH",
            "summary": "The combined decoder accepts semantically false terminal product results and does not bind product Act to the exact core Act consumer.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Reconstruct every terminal result field from authoritative rows, close error/result combinations, and require the allowed product Act to equal the current core Act consumer/binding with no later contradiction.",
            "closure_evidence": "Repaired at git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b: the combined decoder reconstructs every stored terminal public field from finalization/run/member/Task/execution/workspace/intent/observation state, validates the closed success/failure combinations, and requires one-to-one product/core Act binding. Substitution of each dispatch field, unrelated failure replacement or detached core Act is rejected. Fresh independent A2 attempt 1 closes this finding at the same state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03F-006",
            "severity": "HIGH",
            "summary": "Codex-home physical disjointness from every current and historical workspace generation is not enforced.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Bind a reconstructable workspace path/root-identity inventory into activation and effect-time checks and fail closed when global disjointness cannot be proved, including aliases and historical generations.",
            "closure_evidence": "Repaired at git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b: activation and effect-time configuration reconstruct every profile workspace root and deterministic current/historical generation path, canonicalize every existing ancestor and prove global physical disjointness. Nested roots, candidate-home aliases, post-T6 root substitution and aliased historical generations all reject before credential/model access. Fresh independent A2 attempt 1 closes this finding at the same state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03F-007",
            "severity": "HIGH",
            "summary": "Profile mutations and T1 reuse actor/time captured before confirmation.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Reacquire canonical actor/principal/runtime and time immediately after confirmation, require exact continuity, and evaluate and persist using the refreshed context.",
            "closure_evidence": "Repaired at git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b: profile activate/deactivate and start/continuation T1 reacquire canonical actor/principal/runtime and trusted time after confirmation, require continuity, and re-evaluate current state and grants. Profile actor change, start grant expiry/revocation and continuation actor change tests leave no lifecycle/product/effect/successor mutation. Fresh independent A2 attempt 1 closes this finding at the same state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03F-008",
            "severity": "HIGH",
            "summary": "Historical Codex inspect/reconciliation is blocked by current Codex-home drift or unavailability.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Separate effect-time configuration validation from observation-time durable profile/workspace binding so historical inspect/cancel never requires credential, model, or a live Codex home.",
            "closure_evidence": "Repaired at git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b: public historical inspect/cancel discriminate from durable backend ownership and validate durable Project/effect evidence without reopening live profile configuration or Codex home. Deactivated-home absence, inode substitution and structural change all preserve inspect/cancel access with zero credential/model calls. Fresh independent A2 attempt 1 closes this finding at the same state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03F-009",
            "severity": "HIGH",
            "summary": "Profile persistence and decoder do not reconstruct creator, actor, configuration, and contiguous lifecycle history.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Persist or otherwise reconstruct the exact creator/actor/configuration/resulting-status relation and require one initial activation plus a contiguous alternating revision chain matching the current profile projection.",
            "closure_evidence": "Repaired at git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b: profiles persist immutable creatorOperationId/actorId; operations persist configurationSha256/resultingStatus; SQL guards and decoder require one creator activation followed by an exact contiguous alternating revision history with actor/config/status/time linkage. Missing, duplicate, substituted, skipped and impossible histories all reject. Fresh independent A2 attempt 1 closes this finding at the same state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03F-010",
            "severity": "MEDIUM",
            "summary": "The SDK worker accepts duplicate identical thread.started events.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Track observed thread-start events independently from a preloaded resume ID and reject every duplicate for both start and resume streams.",
            "closure_evidence": "Repaired at git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b: the SDK worker tracks the observed thread-start event separately from a preloaded resume identity and rejects every duplicate, whether equal or changed, for both start and resume streams. The six SDK worker tests pass. Fresh independent A2 attempt 1 closes this finding at the same state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03F-011",
            "severity": "MEDIUM",
            "summary": "Resolver, configuration, and SDK-constructor failures are durably misreported as credential unavailability.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Use a bounded redacted discriminated preparation result so credential absence, identity/configuration drift, and constructor/adapter failure retain truthful durable/public taxonomy.",
            "closure_evidence": "Repaired at git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b: driver preparation returns the closed credential_unavailable/configuration_changed/adapter_failure union and maps each to distinct bounded durable/public outcomes. Credential disappearance, resolver throw, SDK constructor throw, config.toml drift and workspace-root substitution tests pass without raw disclosure; the package declaration seam no longer leaks the SDK's undeclared MCP development type. Fresh independent A2 attempt 1 closes this finding at the same state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03F-012",
            "severity": "MEDIUM",
            "summary": "The required lint/offline gate fails because the production-source count invariant is stale.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Update the sole strict production-source inventory invariant consistently and rerun lint plus the complete exact-head offline gate.",
            "closure_evidence": "Repaired at git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b: the exact production-source inventory is 63 and the Node built-in map includes the new product path owner. Lint passes 330/63 and the unmodified complete offline gate passes 731/731 tests plus docs, dependency, 252-file package smoke, SQLite, Codex and scheduler probes. Fresh independent A2 attempt 1 closes this finding at the same state.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "Codex /root/ep03d_a0_2 — fresh independent EP-03F A2 attempt 1",
        "independence": "The reviewer did not participate in EP-03F A1 or repair. It independently rebuilt the conclusion from the frozen plan, A1 report, complete base-to-current task diff, authoritative contracts, source, migration, combined decoder and tests. Review was read-only and performed no file, Git/index, coordinator, dependency, network, credential, real-Codex/SDK-account, or external-Project/workspace mutation.",
        "scope": "Exact closure review of F-A1-EP03F-001 through F-A1-EP03F-012 at the frozen state, including Tier-2 persistence ownership/atomicity/fencing/decoder/corruption/restart/history/redaction, C19 and T1-T6 authorization/replay semantics, targeted dispatcher restart ownership, current/historical workspace disjointness, CLI/Manual/scheduler separation, late public declaration isolation and the offline package-smoke uninstall repair.",
        "reviewed_at": "2026-09-05 09:12:48+08:00",
        "evidence": "Fresh exec_plan.py trace exited zero at git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b with exact approval bytes 52724/SHA-256 B3888468FE1D3735571C413063F71661AE3CC420F78CDA13B9D22BFBA8D5D2BD and errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[]. Fresh lint passed 330/63, typecheck and git diff --check passed; the reviewer also independently inspected every repair and corresponding focused regression rather than treating the parent's 731/731 offline and 252-file package-smoke results as semantic proof. Exact absence of both pre-SDK durable records is authoritative no-effect proof and therefore permits only a newly confirmed/current-authorized first call; any present unknown/active journal remains observation-only. All twelve A1 findings close, later declaration/offline-uninstall repairs are accepted, the Tier-2 audit passes, and no new finding remains. Real-account E2E, administrator-policy attestation and platform/support validation remain not_run/not_claimed.",
        "reviewed_state_id": "git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b",
        "parent_disposition": "complete",
        "closes": [
          "F-A1-EP03F-001",
          "F-A1-EP03F-002",
          "F-A1-EP03F-003",
          "F-A1-EP03F-004",
          "F-A1-EP03F-005",
          "F-A1-EP03F-006",
          "F-A1-EP03F-007",
          "F-A1-EP03F-008",
          "F-A1-EP03F-009",
          "F-A1-EP03F-010",
          "F-A1-EP03F-011",
          "F-A1-EP03F-012"
        ],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-EP03F-001",
          "F-A0-EP03F-002",
          "F-A0-EP03F-003"
        ],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 reproduced the exact 29465-byte approval contract at SHA-256 DBDC7CAA6E0BFB7790354949415DB525389518588D994A1FE860ED0A48577ED0 and base c78b07e9c70f86fcec19feb40c4f2149b82e366a, then found one MEDIUM and two HIGH approval gaps. The parent confirmed all three: AGENTS.md was outside task scope despite necessarily stale current-state claims; the 37-command ato.api/v1 delta lacked exact request/confirmation/result/error semantics, especially Codex continuation confirmation; and openai-codex-api was not mapped to a closed SDK options/environment identity. Revision 1 added the missing authority path, froze C15/C16, and bound C17 to the pinned product constructor plus a profile-owned private CODEX_HOME and fixed OpenAI provider. Full report: docs/plans/evidence/EP-03F/a0-attempt-1.md; attempt 2 later showed that Revision 1 still overclaimed administrator-managed effective policy and left workspace owner ordering open."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-EP03F-003",
          "F-A0-EP03F-004"
        ],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 reproduced the exact 38041-byte approval contract at SHA-256 8B89CA96DB61799EB3700F933D0D4ADCA7D0EFDFEE573A48A415B94EC6250892 and base c78b07e9c70f86fcec19feb40c4f2149b82e366a. It confirmed F-A0-EP03F-001/002 closed but retained F-A0-EP03F-003 because official managed layers can override or add effective policy beyond SDK constructor capture, and added F-A0-EP03F-004 because initial and successor workspaces lacked a non-circular direct dispatcher-member owner tuple. The parent confirmed both HIGH findings. Revision 2 narrowed C17 to product-supplied inputs under an explicit trusted-host-administrator TCB and added C18 plus fresh continuation runs/members. Full report: docs/plans/evidence/EP-03F/a0-attempt-2.md; attempt 3 confirmed those roots closed but found the new Act-consumption and summary matrix insufficient."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-EP03F-005",
          "F-A0-EP03F-006"
        ],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 reproduced the exact 45181-byte approval contract at SHA-256 278FC42AA8F4284BF40428F3D95BB22B5D2AFDAFB2CC8EB0EF8641D3AC82C2CE and base c78b07e9c70f86fcec19feb40c4f2149b82e366a. It confirmed all historical F-A0-EP03F-001..004 closed, then found two HIGH gaps introduced by Revision 2: T5 Act preceded its intent and therefore lacked an atomic one-consumer/recovery rule; and C18 allowed a claimed member to summarize when the planned intent did not exist while refused/recovery_required terminal truth was undefined. The parent confirmed both. Revision 3 made T5 the pending-intent Prepare, T6 one atomic fresh Act/binding/CAS, defined terminal truth and removed the summary bypass. Full report: docs/plans/evidence/EP-03F/a0-attempt-3.md; attempt 4 confirmed both closed but found pre-intent product replay identity/order still incomplete."
      },
      {
        "audit": "A0",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-EP03F-007"
        ],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 reproduced the exact 49242-byte approval contract at SHA-256 A38FA9F0626EAA77E3BA969C5BFB5B78790A04009F6BAF2682269EC59EFB772C and base c78b07e9c70f86fcec19feb40c4f2149b82e366a. It confirmed F-A0-EP03F-001..006 closed and found one HIGH residual: T4 makes the original public revisions stale before T5 creates an execution intent, but the product record/ingress did not freeze a full original command identity or idempotency-first lookup, so a valid replay could be permanently rejected or a relaxed replay could mix tuples. The parent confirmed it. Revision 4 adds C19's unique key, exact typed start/resume/retry public tuples and digest, requires hostile parse then product lookup before live readiness/backend discrimination, exact-match stage recovery, existing conflict on mismatch, derived sub-owner keys and binary post-T4/workspace/T5 replay tests. Full report: docs/plans/evidence/EP-03F/a0-attempt-4.md; fresh independent A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 5,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "accepted",
        "reason": "Fresh independent read-only A0 reproduced the exact 52724-byte approval contract at SHA-256 B3888468FE1D3735571C413063F71661AE3CC420F78CDA13B9D22BFBA8D5D2BD, base/head c78b07e9c70f86fcec19feb40c4f2149b82e366a and state git-sha1:af905857e8d1c98021441a611fdad0425a71df0f. It confirmed F-A0-EP03F-001..007 closed and found no HIGH, MEDIUM, LOW, or scope contradiction. The parent accepts readiness for activation. Full report: docs/plans/evidence/EP-03F/a0-attempt-5.md."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V16",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-09-05 08:57:48+08:00",
        "evidence": "The first complete pnpm verify:offline reached 731/731 tests, docs and dependency checks, then failed the packed declaration consumer because the supported Codex product declaration indirectly exposed @openai/codex-sdk's undeclared development-only @modelcontextprotocol/sdk type import. The internal injection seam was narrowed without adding a dependency; strict typecheck/build and the complete package consumer subsequently passed.",
        "state_id": null
      },
      {
        "validation_id": "V15",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-05 08:57:48+08:00",
        "evidence": "After the declaration repair, package smoke reached uninstall but pnpm 11 attempted denied registry metadata fetches while re-verifying the already constructed isolated lockfile despite npm_config_offline=true. No registry request succeeded and no network escalation was requested. The final script injects pnpm_config_trust_lockfile=true only for removal of the just-tested local tarball; it introduces no dependency and the complete isolated smoke then passed offline.",
        "state_id": null
      },
      {
        "validation_id": "V15",
        "attempt": 2,
        "classification": "invalid_invocation",
        "at": "2026-09-05 08:57:48+08:00",
        "evidence": "Two immediate candidate syntaxes, remove --offline and remove --trust-lockfile, were rejected by pnpm before mutation because those install options are not remove command flags. Read-only local pnpm configuration parsing established pnpm_config_trust_lockfile as the supported scoped channel used by the passing final invocation.",
        "state_id": null
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-09-05 01:03:02+08:00",
        "summary": "After fresh A0 attempt 1, added AGENTS.md as the sole missing highest-authority current-state path; froze the complete four-path plus conditional continuation confirmation grammar, bounds, ordered redacted results and four public errors; and mapped openai-codex-api to one digest-bound pinned SDK baseUrl/apiKey/private-CODEX_HOME/fixed-provider/thread-options constructor identity. No real credential/account call, scheduler composition, Phase-3 CLI family, platform-support claim, dependency, port major, schema number or adjacent external authority was added.",
        "previous_approval_sha256": "DBDC7CAA6E0BFB7790354949415DB525389518588D994A1FE860ED0A48577ED0"
      },
      {
        "at": "2026-09-05 01:29:50+08:00",
        "summary": "After fresh A0 attempt 2, removed the false assertion that incompatible administrator-managed Codex policy can only refuse: C17 now binds only exact product-supplied constructor inputs, explicitly treats the OS administrator/installed runtime/system-managed layers as TCB, and makes no post-managed endpoint/no-hook attestation or support claim. Added the C18 product-operation/member owner union and transaction ordering. Initial start uses a codex-start member whose atomic claim allocates its execution before direct workspace ownership; every resume/retry uses a fresh codex-continuation run/member whose atomic claim allocates the successor, preserving the unchanged ato.workspace/v2 member/execution equality. No real secret/account/network effect, administrator-policy inspection, port major, public command, scheduler route or support claim was added.",
        "previous_approval_sha256": "8B89CA96DB61799EB3700F933D0D4ADCA7D0EFDFEE573A48A415B94EC6250892"
      },
      {
        "at": "2026-09-05 01:56:04+08:00",
        "summary": "After fresh A0 attempt 3, retained the accepted administrator TCB and direct workspace-owner design but repaired C18's authorization and terminal matrix. T5 now creates the exact pending execution intent before Act; T6 atomically persists fresh Codex and execution Act evidence, a new confirmation, one-consumer intent binding and pending-to-executing/effect-possible CAS before credential or Task access. Denials do not advance the binding; crash after T6 is inspect-only ambiguity. Product stage/lifecycle are separate; refused is pre-T4 only, and every claimed Codex member requires its exact finalized intent plus final workspace inspection before summary. No new command, action, port major, external effect or support claim was added.",
        "previous_approval_sha256": "278FC42AA8F4284BF40428F3D95BB22B5D2AFDAFB2CC8EB0EF8641D3AC82C2CE"
      },
      {
        "at": "2026-09-05 02:15:45+08:00",
        "summary": "After fresh A0 attempt 4, retained the accepted T5/T6 and summary matrix and added C19 as the missing pre-intent recovery identity. CodexProductOperation now stores a unique public idempotency key plus the complete original typed public command and canonical digest; sub-owner keys are derived. After hostile parsing/trusted actor assertion the facade looks up that record before current profile/Task/execution readiness and before Manual fallback. Exact match resumes only recorded IDs/stage with fresh stage authorization; mismatch returns existing IDEMPOTENCY_CONFLICT; absence alone performs first-call validation. Failpoint/decoder/API tests cover replay after T4, workspace readiness and T5 without duplicate tuple/effect. No new public field/error/action, external effect or support claim was added.",
        "previous_approval_sha256": "A38FA9F0626EAA77E3BA969C5BFB5B78790A04009F6BAF2682269EC59EFB772C"
      }
    ],
    "final_summary": "EP-03F completes only the approved fresh local Codex product composition at exact material state git-sha1:b7f0f104983a91d1312fcd90edaea58a6db0911b: authorization vocabulary v8/55, Project-scoped trusted Codex profile lifecycle, exact C19 public replay identity, T1-T6 fresh per-effect authorization with full required-grant/core-Act lineage, one targeted Codex dispatcher/member owner, ato.workspace/v2 initial and successor ownership, durable Codex journal/reconciliation, and the sole ato.api/v1 surface at 37 commands/41 errors. Manual dispatch/completion and scheduler library behavior remain separate, and a successful Codex turn still does not complete a Task. The unmodified offline route passes lint, strict typecheck/build, 731/731 tests with zero fail/cancel/skip/todo, docs, dependency shape, 252-file package smoke, SQLite, Codex and scheduler probes; git diff --check passes. Fresh A0 accepted the exact 52724-byte approval contract; A1's nine HIGH and three MEDIUM findings are all repaired and closed by fresh independent A2 at the same material state with findings=[]. No real credential/account/SDK E2E, administrator-policy attestation, external Project effect, network advisory audit, provider/platform support, scheduler composition, MCP, release or deployment is delivered or claimed. The result commit, standing-authorized pathless artifact prune, exact-head gates, FF-only local integration and applicable ordinary origin/master push remain subsequent coordinator actions; cleanup remains separately unauthorized."
  }
}
```

## Context

EP-03D 已实现 package-private、non-composed 的 Codex SDK backend，并明确把 operational product composition 与 successor execution/workspace allocation 留给 EP-03F。EP-03E 只交付 scheduler library/ingress，且明确没有给 EP-03F 分配 scheduler 组合义务。当前默认产品与 CLI 仍是 Manual；Phase 3 policy/gate/completion/integration/workspace 是显式注入式库；当前 vocabulary 为 v7、数据库 schema 为 1、application-state digest 为 3、ato.api/v1 为 33 commands。官方与本地 pinned SDK 证据只证明本地 TypeScript SDK 可 start/continue/resume thread，并支持显式 apiKey、env 与 workingDirectory；它们不证明真实账号、平台支持或授权。
