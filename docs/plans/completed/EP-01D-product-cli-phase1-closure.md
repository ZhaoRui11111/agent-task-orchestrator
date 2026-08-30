# ExecPlan: deliver the local Phase 1 product CLI and lifecycle surface

EP-01D started at the unique EP-01C product terminal and closes only the local
Phase 1 Project/Task-management product. Execution, adapters, dispatch, and all
EP-02 state remain outside this plan.

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-30 00:35:52+08:00",
    "updated_at": "2026-08-30 10:29:10+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user delegation for complete EP-01D implementation",
        "at": "2026-08-30 00:35:52+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "current user delegation for task commits, coordinator FF-only local integration, and eligible ordinary origin/master push",
        "at": "2026-08-30 00:35:52+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Starting from the unique completed EP-01C terminal, deliver and validate EP-01D as a genuinely usable and composable local Phase 1 product CLI: establish one trusted local actor and explicit finite runtime authorization, route every Project/Task/dependency command and authorized query through the EP-01C application service, expose safe persistence-owned backup, explicitly confirmed restore, and read-only doctor workflows, publish one versioned strict human/JSON CLI contract with stable exit/error semantics, and make source, built, packed-installed, restart, migration, documentation, and truthful capability behavior converge without implementing any EP-02 execution capability.",
    "non_goals": [
      "Do not create, activate, implement, reserve, or pre-allocate EP-02, Manual or Codex ExecutionBackend, running/completed execution flow, execution attempts, claim, lease, fence, completion acceptance, dispatcher, scheduler, port, adapter, workspace, gate, external intent/effect, MCP, Skill, plugin, Git/Project mutation, or network operation.",
      "Do not edit, regenerate, reorder, or replace the committed 0001, 0002, or 0003 migration bytes, completed plans, or historical evidence, and do not allocate any execution, intent/effect, workspace, scheduler, claim/lease/fence, gate, completion, adapter, MCP, or dispatcher table.",
      "Do not introduce team accounts, RBAC, cloud identity, a default wildcard administrator, an implicit all-powerful grant, or any authority derived from Project/Task content, repository files, prompts, tool output, Agent text, errors, environment content, or prior decisions.",
      "Do not expose arbitrary shell, SQL, filesystem read/write, repair, cleanup, diagnostic export, raw database access, raw error/stack output, or caller-selected lifecycle descendant paths.",
      "Do not modify D:/quant or another repository, touch a real external Project, access a secret/account, download a dependency, run an online dependency audit, create a PR, release, deploy, force, rebase, reset, stash, clean, run coordinator cleanup, or perform any external write except the exact repository-authorized ordinary origin/master push after all prerequisites.",
      "Do not add a production dependency, change Node 24.19.0, pnpm 11.19.0, or TypeScript 5.9.3, and do not claim hosted CI, release readiness, telemetry, multi-user isolation, non-Windows support, or supported platform/API behavior from local evidence.",
      "Do not rewrite the fixed EP-01A -> EP-01B -> EP-01C -> EP-01D -> EP-02 product chain or use EP-01D evidence to change historical outcomes."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "Completed EP-01C has exactly one terminal commit, 511f444f44d5404459875452f42b0055cc94785c. That commit is the strict product predecessor and the initial/current material base; another commit may be accepted only through the schema-v3 base-transition rules without rewriting product history.",
        "source": "Current user decision; docs/plans/README.md; read-only terminal-resolve and historical scope evidence"
      },
      {
        "id": "C2",
        "statement": "The CLI is an interface owner only: it parses bounded typed input, establishes trusted local actor/current confirmation, invokes the application service or the named persistence lifecycle owner, sanitizes output, and maps stable result codes. Project, Task, dependency, revision, transition, hierarchy, DAG, registry, policy, grant, transaction, and persistence judgments remain in their existing owners and are not copied into CLI code.",
        "source": "Current user decision; ARCHITECTURE.md dependency constraints; docs/reference/validation-policy.md public-interface route"
      },
      {
        "id": "C3",
        "statement": "One new authoritative CLI/API contract exclusively owns the complete Phase 1 command tree, option grammar and bounds, ato.api/v1 JSON envelopes, human projection, confirmation phrases, redacted field allowlists, stable error codes, and exit codes. Unknown command, option, field, version, duplicate, control character, malformed number/time/identifier, injection-bearing structural input, and over-limit input are rejected before runtime mutation.",
        "source": "Current user decision; docs/reference/versioning-compatibility-contract.md; docs/security/threat-model.md"
      },
      {
        "id": "C4",
        "statement": "Trusted local identity is derived only in persistence/local-ingress from Node os.userInfo({encoding:'utf8'}) plus the already verified runtime root; no environment value is read. Username is required nonempty NFC, free of C17 forbidden code points, <=256 UTF-8 bytes, and normalized with toLocaleLowerCase('en-US'); uid/gid must be finite safe integers and platform is the exact nonempty process.platform token. `principalSha256` is uppercase SHA-256 of persistence canonicalJson over exactly `{domain:'ato.local-principal/v1',platform,username,uid,gid}`; `actorId` is `local-v1:` plus uppercase SHA-256 of canonicalJson over exactly `{domain:'ato.local-actor/v1',principalSha256,runtimeRootKey}`. Fresh vocabulary-v4 bootstrap stores trusted_principal exactly equal to principalSha256, and the identity row principal_sha256 must equal it; migrated vocabulary-v3 trusted_principal bytes remain unchanged historical data and are never attested. Only actorId, principalSha256, platform, derivation version 1, and verified root key are persisted for new identity; raw OS attributes and paths are never output. Same inputs are restart-stable; unavailable/malformed/changed identity maps OS_IDENTITY_UNAVAILABLE/mismatch to RUNTIME_UNSAFE/AUTHORIZATION_DENIED without mutation. Identity is never accepted from CLI payload, environment content, Project/Task text, or stored Agent/tool output. Bootstrap, renewal/adoption, grant issue/revoke, restore, and every other high-risk command require an exact separate current CLI confirmation bound to parsed command and request; normal currently granted commands do not prompt again.",
        "source": "Current user authorization-experience decision; docs/reference/authorization-contract.md; docs/security/threat-model.md N3/N11"
      },
      {
        "id": "C5",
        "statement": "Authorization remains the finite single-user grant model frozen in C20/C21/C28. Fresh bootstrap grants only the exact current nineteen-action vocabulary for at most 31 days and atomically records the C4 identity. A migrated version-3 bootstrap retains its historical actor/principal/grants unchanged and initially has no local-identity row; the sole allowed identity transition is one high-risk-confirmed C20 `adopted` renewal under the safe owner-issued root, with no active identity row and no live revoked legacy-origin grant. That transaction atomically records the current C4 identity, request/decision/audit, first epoch, and nineteen current-actor grants; it neither attests nor rewrites the historical principal and can never rebind. A Domain-only legacy state with no bootstrap uses ordinary init, not adoption. Thereafter only the exact C20 current-origin transition may append the next root-capability epoch through the non-grantable same-bound-local-actor/root confirmed CAS; a live partial revocation is never superseded, a requested epoch always extends beyond the next seven days but no later than 31 days, and every epoch is atomic, append-only, versioned, non-recursive, bounded, and decoded with exact request/audit/grant provenance. Ordinary delegated issuance still requires both current administrative and source capability, is limited by both, and the CLI can name only the bound current OS actor.",
        "source": "Current user once-initialized/daily-friction decision; existing finite authorization owner; Tier-2 persistence lens"
      },
      {
        "id": "C6",
        "statement": "EP-01D may append exactly one Phase 1-only migration, 0004, for the minimum CLI authorization vocabulary and capability-epoch records required by C4/C5. It preserves 0001/0002/0003 bytes and all earlier data, uses one authoritative writer/decoder, upgrades every shipped prefix with verified pre-upgrade backup, and allocates no EP-02 table or placeholder.",
        "source": "Current user staged-schema authorization; docs/reference/persistence-contract.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C7",
        "statement": "CLI output is allowlist-first. Neither human nor JSON output contains Task body/cancellation reason, Project/runtime full path or filesystem identity, trusted principal, actor/correlation/request/decision/audit identity, secret, environment value, raw SQL/database page, raw exception/stack/cause, or unclassified tool/source text. Exact Project/Task/grant/backup identifiers needed for the requested local operation remain bounded operational data; every other sensitive value is omitted or represented only by a stable public code/count/boolean.",
        "source": "Current user disclosure boundary; docs/security/privacy-and-logging.md"
      },
      {
        "id": "C8",
        "statement": "Backup, restore, primary identity, lifecycle locking, active-use refusal, immutable generation verification, restore intent/receipt, and terminal readback stay exclusively in the existing persistence lifecycle owners. The CLI never copies a live database, opens SQLite directly, invents a backup identity, selects descendant paths, deletes retained data, repairs state, or rewrites migration/history evidence.",
        "source": "Current user decision; docs/reference/persistence-contract.md"
      },
      {
        "id": "C9",
        "statement": "Restore requires a current explicit runtime.restore grant, exact current high-risk confirmation, a verified exact-current-schema manual backup created by the product CLI, explicit data-loss acknowledgement, closed current store, zero other connection receipts, exact current primary CAS, and terminal application decode. Missing/wrong/corrupt/stale/pre-upgrade/newer/ambiguous/active-use material fails closed before protected mutation; any post-intent interruption remains RESTORE_RECOVERY_REQUIRED and is never described as rollback.",
        "source": "Current user restore decision; persistence restore contract; Tier-2 transition lens"
      },
      {
        "id": "C10",
        "statement": "Doctor is a no-create, no-write, no-repair, no-delete, no-checkpoint, read-only persistence diagnostic. It reports only fixed redacted status/code/schema/count/boolean fields and distinguishes not initialized, partial runtime topology, active use, pending/ambiguous restore, unsafe/path-identity state, newer schema, checksum/history/fingerprint mismatch, corrupt row/integrity failure, invalid backup inventory, and healthy state without changing any byte, timestamp, receipt, page, migration, or filesystem member.",
        "source": "Current user doctor boundary; docs/reference/persistence-contract.md writer/reader closure; privacy contract"
      },
      {
        "id": "C11",
        "statement": "EP-01D uses the full Tier-2 persistence lens: each new field/table/status/file has one writer and enumerated readers; identity binds the semantic runtime/schema/application/backup inputs; typed ingress is decoded once; every mutation validates eligibility before its first write; lock/stage/CAS/no-follow and terminal receipts remain in the existing owner; restart, contention, partial publication, stale state, and exception propagation have explicit safe stop points.",
        "source": "harness-exec-plan persistence lens; current user requirement"
      },
      {
        "id": "C12",
        "statement": "The product package remains private-by-default zero-production-dependency ESM. The ato source entry, compiled bin, packed-installed bin, package export, migration inventory, smoke flow, install-facing docs, and capability status expose the same Phase 1 behavior and stable exit/output contract. Local Windows observations do not become a release or platform-support claim.",
        "source": "Current user package/install requirement; docs/reference/toolchain-contract.md; versioning contract"
      },
      {
        "id": "C13",
        "statement": "The CLI exposes only the exact C16 inventory: initialization and explicit finite renewal; bounded current-actor grant list/show/issue/revoke and policy evaluation; Project register/show/update/disable; Task create/show/update-body/set/clear-parent/mark-ready/cancel; dependency add/remove; authorized status; authorized backup create; authorized and confirmed restore; and grant-independent read-only doctor. It exposes no running/completed transition or execution-shaped command and cannot select a Domain event outside the EP-01C application command vocabulary plus the exact EP-01D query/lifecycle authorization commands.",
        "source": "Current user command boundary; docs/reference/domain-contract.md"
      },
      {
        "id": "C14",
        "statement": "Fresh independent A0 is required before activation, fresh independent A1 after the stable fully validated diff, and fresh independent A2 after any confirmed in-scope HIGH or MEDIUM repair. The implementer cannot substitute for an independent reviewer and every material change makes bound evidence stale according to schema v3.",
        "source": "Current user requirement; harness-exec-plan audit contracts"
      },
      {
        "id": "C15",
        "statement": "One task-owned terminal commit, current-head pathless .task-artifacts prune receipt, exact-head gate receipts, coordinator ready, FF-only local integration, and the standing-authorized ordinary origin/master push occur only after completion readiness. Coordinator cleanup and every adjacent external action remain unauthorized.",
        "source": "Current user authorization; AGENTS.md; docs/reference/local-agent-git-flow.md"
      },
      {
        "id": "C16",
        "statement": "The baseline invocation grammar is exactly `ato [--format human|json] [--api-version ato.api/v1] [--runtime-root ABSOLUTE] COMMAND_PATH [--name value ...]`: COMMAND_PATH is one token only for `status`, `doctor`, `init`, or `restore`, and exactly two tokens for every other command; globals precede COMMAND_PATH, command options follow it as duplicate-free `--name value` pairs, and defaults are human plus ato.api/v1. Short/combined/equals/response-file/repeated/empty/positional-data/post-command-global forms are invalid. The closed paths, serialized IDs, and option sets are: `status`->status {}; `doctor`->doctor {}; `init`->init {expires-at,confirm}; `restore`->restore {generation-id,confirm,acknowledge-data-loss}; `authorization renew|list|show|issue|revoke|evaluate` -> authorization.renew {expires-at,confirm}, authorization.list {limit, optional after-grant-id}, authorization.show {grant-id,expected-grant-revision}, authorization.issue {action,scope, optional project-id/expected-resource-revision/expected-config-revision,not-before,expires-at,confirm}, authorization.revoke {grant-id,expected-grant-revision,confirm}, authorization.evaluate {project-id,expected-resource-revision,expected-config-revision,action}; `project register|show|update|disable` -> project.register {project-id,root,confirm}, project.show {project-id,expected-resource-revision}, project.update/project.disable {project-id,expected-resource-revision,expected-config-revision,confirm}; `task create|show|update-body|set-parent|clear-parent|mark-ready|cancel` -> task.create {project-id,expected-project-resource-revision,task-id,body,optional supersedes-task-id}, task.show {project-id,expected-project-resource-revision,task-id,expected-task-revision}, task.update-body adds body, task.set-parent adds parent-id, task.clear-parent/task.mark-ready use the show set, task.cancel adds reason; `dependency add|remove` -> dependency.add/dependency.remove {project-id,expected-project-resource-revision,task-id,expected-task-revision,dependency-id,expected-dependency-revision}; and `backup create`->backup.create {}. A failure uses the exact serialized ID only after COMMAND_PATH matches one closed path; otherwise its ID is `unknown`. No other path, option, query, mutation, alias, completion, repair, or recovery command is ato.api/v1.",
        "source": "Current user command boundary; A0 F-EP01D-A0-001 parent disposition"
      },
      {
        "id": "C17",
        "statement": "Before selecting, creating, or opening a runtime, the parser limits the argument vector after the executable to 64 tokens and 32768 UTF-8 bytes, rejects NUL, U+0001..U+001F, U+007F..U+009F, bidi/format code points, unpaired surrogates, and non-NFC identifier/content values, and enforces: Project/Task/dependency identifiers are NFC UTF-8 1..128 bytes; operational/request/grant/cursor identifiers are ASCII `[A-Za-z0-9][A-Za-z0-9._:-]{0,127}`; generation IDs are lowercase RFC-4122 version-4 UUIDs and persistence revalidates them; `--runtime-root` and Project `--root` are absolute local paths of at most 1024 UTF-8 bytes with no `.` or `..` component, with runtime-root additionally required by local ingress to be the selected root itself or a direct child of the trusted per-user application-data directory; body is 1..16384 UTF-8 bytes; cancellation reason 1..4096; timestamps exactly `new Date(value).toISOString()===value`; revisions canonical decimal safe integers in 1..9007199254740991; list limit is a canonical decimal integer whose range 1..100 is checked before runtime, with a syntactically valid out-of-range value mapping only to RESULT_LIMIT_EXCEEDED. Bootstrap expiry is in (now,now+31 days]; renewal expiry is in (now+7 days,now+31 days]; issuance parser checks not-before>=now and expiry>not-before, while the application transaction alone selects current administrative/source grants and enforces expiry <= both selected expiries, returning SCOPE_EXPANSION_DENIED on excess. Scope=runtime forbids all Project scope fields; scope=project requires all three. Missing or wrong command confirmation maps to CONFIRMATION_REQUIRED, not parser failure; the only exact phrases are `INITIALIZE LOCAL RUNTIME`, `RENEW LOCAL CAPABILITIES`, `ISSUE LOCAL GRANT`, `REVOKE LOCAL GRANT`, `REGISTER LOCAL PROJECT`, `UPDATE LOCAL PROJECT`, `DISABLE LOCAL PROJECT`, and `RESTORE LOCAL BACKUP`; restore acknowledgement missing/wrong maps to DATA_LOSS_ACK_REQUIRED and only accepts `DISCARD CURRENT LOCAL DATA`. Trusted ingress binds an accepted phrase to one fresh request/correlation/action/actor/root; phrases and content never grant authority.",
        "source": "Current user strict-ingress and current-confirmation decision; A0 F-EP01D-A0-001/F-EP01D-A0-002"
      },
      {
        "id": "C18",
        "statement": "Format selection scans only the leading global pairs: exactly one well-formed `--format json` selects JSON even when a later token fails; exactly one `--format human` or no format selects human; a missing/unsupported/repeated format value is invalid input rendered in human, so failure format is deterministic. JSON mode writes exactly one LF-terminated UTF-8 line: success `{\"apiVersion\":\"ato.api/v1\",\"command\":\"ID\",\"ok\":true,\"result\":OBJECT}` or failure `{\"apiVersion\":\"ato.api/v1\",\"command\":\"ID_OR_unknown\",\"ok\":false,\"error\":{\"code\":\"PUBLIC_CODE\",\"message\":\"FIXED_MESSAGE\"}}`, with those keys/orders and no whitespace or extra/details/cause field. The encoder uses RFC-8259 JSON primitives, escapes quotation, reverse-solidus, U+0000..001F, U+2028/U+2029, preserves other NFC Unicode, rejects non-finite numbers, and never reflects input in an error. Human success is `OK ID key=<compact-json-value> ...` with result fields in C23 order; failure is `ERROR ID code=\"PUBLIC_CODE\" message=\"FIXED_MESSAGE\"`; separators are one ASCII space, strings remain JSON-quoted/escaped, null is `null`, arrays/objects are compact JSON in contract key order, and the line has no ANSI or prompt. Closed success shapes are frozen in C23. Task body/cancellation reason, roots/paths/file identity, actor/principal, request/correlation/decision/audit/lifecycle/restore identifiers, state hashes, environment, raw errors, SQL, stack/cause, and unclassified content are never serialized.",
        "source": "Current user machine/human output and disclosure decision; A0 F-EP01D-A0-001"
      },
      {
        "id": "C19",
        "statement": "The code/exit/fixed-message table is exact: exit 2 CLI_INVALID_INPUT=`The command input is invalid.` and CLI_UNSUPPORTED_VERSION=`The requested API version is unsupported.`; exit 3 RUNTIME_NOT_INITIALIZED=`The local runtime is not initialized.`, RUNTIME_ALREADY_INITIALIZED=`The local runtime is already initialized.`, CAPABILITY_RENEWAL_NOT_DUE=`Local capabilities are not eligible for renewal.`; exit 4 AUTHORIZATION_DENIED=`Current explicit authorization denied the operation.`, CONFIRMATION_REQUIRED=`The exact current confirmation is required.`, SCOPE_EXPANSION_DENIED=`The requested authorization scope exceeds current authority.`; exit 5 PROJECT_NOT_FOUND=`The Project was not found.`, TASK_NOT_FOUND=`The Task was not found.`, GRANT_NOT_FOUND=`The grant was not found.`, BACKUP_NOT_FOUND=`The backup generation was not found.`; exit 6 STALE_REVISION=`The expected revision is stale.`, DOMAIN_REJECTED=`The requested Task operation was rejected.`, PROJECT_ALREADY_REGISTERED=`The Project is already registered.`, PROJECT_REGISTRY_REJECTED=`The Project registry rejected the operation.`, RESULT_LIMIT_EXCEEDED=`The requested result limit is invalid.`, OPERATION_CONFLICT=`The operation conflicts with current state.`; exit 7 RUNTIME_UNSAFE=`The local runtime identity or topology is unsafe.`, RUNTIME_ACTIVE=`The local runtime is active.`, SCHEMA_UNSUPPORTED=`The runtime schema is unsupported.`, MIGRATION_INVALID=`The runtime migration history is invalid.`, STATE_CORRUPT=`The runtime state is corrupt.`, BACKUP_INVALID=`The backup generation is invalid.`, PERSISTENCE_UNAVAILABLE=`Local persistence is unavailable.`; exit 8 DATA_LOSS_ACK_REQUIRED=`The exact data-loss acknowledgement is required.`, RESTORE_CONFLICT=`Restore conflicts with current state.`, RESTORE_BLOCKED=`Restore is blocked.`, RESTORE_RECOVERY_REQUIRED=`Restore requires manual recovery.`; exit 9 INTERNAL_ERROR=`The operation failed internally.`; exit 0 is success only. C24 is the exhaustive internal mapper. Output is always the selected C18 envelope on stdout, stderr is empty, and source/build/install exit exactly once with the table code.",
        "source": "Current user stable-code and no-raw-error decision; A0 F-EP01D-A0-001"
      },
      {
        "id": "C20",
        "statement": "The schema-v4 finite grant vocabulary, in canonical order, is exactly `authorization.grant.issue`, `authorization.grant.inspect`, `authorization.grant.revoke`, `policy.evaluate`, `project.register`, `project.update`, `project.disable`, `project.inspect`, `task.create`, `task.update`, `task.mark_ready`, `task.cancel`, `task.inspect`, `dependency.add`, `dependency.remove`, `authorization.grant.list`, `runtime.status`, `runtime.backup`, `runtime.restore`. Fresh v4 bootstrap creates one runtime-scoped grant per action for the C4 actor and the immutable C28 identity row. Root origin revision 0 is that bootstrap request and exact vocabulary-version set; otherwise the current origin is the unique highest capability-epoch revision and its exact nineteen grants. `authorization.capability.renew` is non-grantable/non-delegable, requires fresh confirmation and requested expiry in (now+7 days,now+31 days], and has exactly two entry forms. Adoption requires version-3 bootstrap, absent local identity and epoch, the current verified root plus current C4 identity, and an exact decoded legacy origin with no grant revoked while unexpired; it inserts the immutable local identity and epoch revision 1. Ordinary renewal requires an existing local identity whose actor/principal digest/platform/root/version exactly match current C4 derivation and the exact decoded current origin; a v4 origin is eligible only when common expiry <=now+7 days, an expired origin is eligible, and any live revoked current-origin grant makes renewal not due until common origin expiry. Neither form updates/unrevokes an old grant or attests a stored legacy principal. Preflight captures identity presence, highest epoch revision, and current state digest; BEGIN IMMEDIATE rechecks all three and eligibility, inserts the request/decision/audit/next epoch/nineteen grants plus identity only for adoption atomically, and terminal decode rechecks the set, so a concurrent winner makes the loser STALE_REVISION and later replay is CAPABILITY_RENEWAL_NOT_DUE. Grant list requires authorization.grant.list, returns only the bound current actor's grants in grant_id BINARY ascending order after an exclusive cursor, at most limit items, and nextCursor is the last emitted ID iff another matching row exists, otherwise null; it writes its accepted request/decision/audit before returning. Status requires runtime.status and counts the terminal post-command state including its own accepted request/decision/audit. Manual backup/restore require runtime.backup/runtime.restore respectively; doctor alone is grant-independent and classification-only.",
        "source": "Current user finite daily-capability decision; A0 F-EP01D-A0-002 parent disposition"
      },
      {
        "id": "C21",
        "statement": "Migration 0004 preserves every 0003 column/affinity/PK/FK/CHECK except the exact delta here and C28 owns literal nullability/keys/checks/FKs for every new relation. application_requests.action is ordered C20 plus authorization.capability.renew; target_kind is runtime|project|task|grant|backup; result is bootstrap|allow|deny|renewal. Checks are one-way for bootstrap (`result=bootstrap` requires action=authorization.grant.issue and target runtime, while ordinary grant.issue may be allow/deny) and biconditional for renewal (`action=authorization.capability.renew` iff result=renewal, with target runtime). authorization_bootstrap adds `vocabulary_version INTEGER NOT NULL CHECK IN (3,4)` and UNIQUE(actor_id,runtime_root_key); copied rows are 3 and new bootstrap is 4. authorization_grants.action is C20, adds nullable `capability_epoch_id TEXT`, UNIQUE(capability_epoch_id,action), epoch FK, and exactly one provenance form: bootstrap=(issuer/source/epoch null), delegated=(issuer/source nonnull, epoch null), or epoch=(issuer/source null, epoch nonnull); revoke-only update makes epoch provenance immutable. authorization_decisions action and application_audit event enums add only C20/renew and `capability.renewed`, `grant.listed`, `runtime.status.inspected`, `backup.authorized`, `restore.authorized`. The three new STRICT immutable relations are authorization_local_identity, authorization_capability_epochs, and application_lifecycle_authorizations exactly as C28. Epoch and lifecycle actor/root FKs target the immutable local identity, not historical bootstrap actor; lifecycle uses stable grant_id FK only, with C25 defining evaluated historical revision. All mandatory identity, operation, temporal, digest, count, provenance, and request-link columns are explicitly NOT NULL; only the named grant epoch and prior 0003 nullable columns remain nullable. All three new tables have no-update/no-delete triggers; all five rebuilt tables retain 0003 immutability/indexes with the exact expanded vocabulary.",
        "source": "Tier-2 schema/writer-reader closure; A0 F-EP01D-A0-003 parent disposition"
      },
      {
        "id": "C22",
        "statement": "For backup, trusted ingress allocates a new generation before authorization; for restore, the parser supplies an existing generation and trusted ingress validates/binds it without allocating or rewriting it. The application service atomically writes one request, allow decision, accepted audit, and immutable lifecycle row bound to operation/generation/actor/root/evaluated grant id+historical revision, the C25 state digest, terminal request/decision/audit counts, issued time, and expiry=min(grant expiry,issued+5 minutes), then returns a nonpublic typed handoff. Persistence evaluates no policy. Manual backup acquires the lifecycle lock plus an exclusive PersistenceStore application-write barrier honored by every bound application transaction, requires its own connection receipt to be the sole current receipt, and validates primary/decoder/lifecycle row/actor/root/operation/generation/current exact grant revision with no revocation/allow decision/accepted audit/digest/counts/time<expiry/physical CAS. It clones to an owned stage, verifies it, begins IMMEDIATE, repeats every check and proves the staged state digest equals the authorized digest, commits the no-write transaction while retaining both barriers, writes the schema-2 manifest, then atomically renames the generation. Any failure through commit or before rename removes only the unpublished owned stage. The successful rename is the sole backup publication linearization: after it, the generation is immutable valid terminal evidence; an observed post-rename exception is reverified and returned as success, a process interruption leaves the generation valid for doctor/restart inventory, and retry creates a distinct newly authorized generation without overwriting/deleting it. Restore closes the store, requires zero receipts, and under lifecycle lock repeats the authorization/digest/CAS checks immediately before schema-2 intent publication. Expiry, revocation or grant-revision advance, later application row, target substitution, or mismatch before backup rename/restore intent leaves protected state unchanged; anything after restore intent is RESTORE_RECOVERY_REQUIRED. Successful restore retains the prior primary authorization, publishes only backup-time state, links it by receipt, terminal-decodes, and survives restart.",
        "source": "Tier-2 authorization-to-lifecycle transition; A0 F-EP01D-A0-004 parent disposition"
      },
      {
        "id": "C23",
        "statement": "Success result types and field order are exact. status={initialized:boolean(always true),schemaVersion:integer(always 4),projectCount/taskCount/dependencyCount/grantCount/auditCount:nonnegative safe integers}. doctor={health:healthy|not_initialized|upgrade_required|partial_runtime|runtime_active|restore_pending|restore_ambiguous|runtime_unsafe|schema_newer|migration_invalid|state_corrupt|backup_invalid,initialized:boolean|null,schemaVersion:positive-safe-integer|null,activeUse:boolean|null,backupInventory:not_checked|empty|valid|invalid,restoreState:not_checked|none|pending|ambiguous}; precedence is runtime_unsafe,partial_runtime,restore_ambiguous,restore_pending,runtime_active,schema_newer,migration_invalid,state_corrupt,backup_invalid,upgrade_required,not_initialized,healthy. Projections: absent safe topology => not_initialized,false,null,false,empty,none; recognized schema 1/2 => upgrade_required,false,version,false,verified inventory/restore; schema 3 exact initialized application => upgrade_required,true,3,false,verified inventory/restore, while either wholly empty Domain/application or valid Domain-only state with zero ProjectRegistry/bootstrap/grant/request/decision/audit rows => upgrade_required,false,3,false,verified inventory/restore; other partial application relations are state_corrupt. Schema 4 exact initialized identity/application => healthy,true,4,false,verified inventory/restore; wholly empty or valid Domain-only state with zero ProjectRegistry/bootstrap/identity/grant/epoch/request/decision/audit/lifecycle rows => not_initialized,false,4,false,verified inventory/restore and permits only init/doctor until init. Init preserves any valid Domain-only rows while atomically adding bootstrap/identity/grants; C29 then permits root binding for each preserved Project. Unsafe/partial use null/not_checked for unestablished facts; newer schema reports observed version and initialized null. init/authorization.renew={mode:initialized|adopted|renewed,expiresAt:canonical UTC,capabilityCount:19,epochRevision:nonnegative safe integer}; init alone is initialized/revision 0, legacy identity renewal adopted/revision 1, later renewal renewed/revision>0. authorization.list={grants:grant[],nextCursor:string|null}; show/issue/revoke return grant={grantId:string,revision:positive integer,action:C20,scopeKind:runtime|project,projectId:string|null,resourceRevision/configRevision:positive integer|null,notBefore/expiresAt:canonical UTC,status:not_yet_valid|active|expired|revoked}, status precedence revoked,not_yet_valid,expired,active at ingress now. evaluate={action:C20,policy:allow|deny|read_not_applicable,projectId:string,resourceRevision:positive integer}. Project={projectId:string,enabled:boolean,configRevision/resourceRevision:positive integers}. Task/dependency={projectId/taskId:string,status:idea|ready|running|waiting|completed|cancelled,revision:positive integer,parentId:string|null,dependencyIds:string[] Domain order,supersedesTaskId:string|null}. backup.create={generationId:UUID,kind:manual,sourceSchemaVersion:4,createdAt:canonical UTC,verified:true}; restore={backupGenerationId:UUID,targetSchemaVersion:4,restoredAt:canonical UTC,dataLossAcknowledged:true}. Null/arrays are explicit; no other property/value is accepted.",
        "source": "A0 attempt-two F-EP01D-A0-001 exact public values"
      },
      {
        "id": "C24",
        "statement": "The CLI mapper input is a closed tagged union and maps exhaustively: parser structure/type/bound/normalization failures and application INVALID_INPUT -> CLI_INVALID_INPUT, except that a syntactically valid canonical authorization.list limit outside 1..100 maps only to RESULT_LIMIT_EXCEEDED; unsupported api -> CLI_UNSUPPORTED_VERSION; BOOTSTRAP_REQUIRED -> RUNTIME_NOT_INITIALIZED; BOOTSTRAP_ALREADY_CONSUMED -> RUNTIME_ALREADY_INITIALIZED; renewal ineligible/replay -> CAPABILITY_RENEWAL_NOT_DUE and renewal CAS loss -> STALE_REVISION; missing/wrong high-risk phrase or authorization reason confirmation_required -> CONFIRMATION_REQUIRED; AUTHORIZATION_DENIED and expired/revoked/missing lifecycle grant -> AUTHORIZATION_DENIED; SCOPE_EXPANSION_DENIED, including issuance expiry beyond either selected source grant, stays SCOPE_EXPANSION_DENIED; PROJECT_NOT_FOUND/TASK_NOT_FOUND/GRANT_NOT_FOUND unchanged; verified generation lookup NOT_FOUND -> BACKUP_NOT_FOUND; application STALE_REVISION and persistence REVISION_CONFLICT -> STALE_REVISION; DOMAIN_REJECTED and every nested Domain rejection code, explicitly including NO_OP, map only to DOMAIN_REJECTED; PROJECT_ALREADY_REGISTERED unchanged; PROJECT_REGISTRY_REJECTED plus PROJECT_IDENTITY_CHANGED/UNCERTAIN and all Project-root rejection codes -> PROJECT_REGISTRY_REJECTED; BACKUP_CONFLICT, CONNECTION_RECEIPT_CHANGED, LIFECYCLE_IDENTITY_CHANGED, and a later semantic digest/count -> OPERATION_CONFLICT; OS_IDENTITY_UNAVAILABLE/UNSAFE_RUNTIME_ROOT/PATH_IDENTITY_CHANGED -> RUNTIME_UNSAFE; ACTIVE_CONNECTIONS/LIFECYCLE_BUSY/BUSY -> RUNTIME_ACTIVE; SCHEMA_NEWER/SCHEMA_UNSUPPORTED -> SCHEMA_UNSUPPORTED; MIGRATION_CHECKSUM_MISMATCH/MIGRATION_HISTORY_MISMATCH/MIGRATION_FAILED -> MIGRATION_INVALID; CORRUPT_ROW/INTEGRITY_ERROR or malformed lifecycle lineage -> STATE_CORRUPT; BACKUP_INVALID -> BACKUP_INVALID; SQLITE_OPEN_FAILED/CONNECTION_POLICY_FAILED/TRANSACTION_FAILED/STORE_CLOSED/ASYNC_TRANSACTION_FORBIDDEN -> PERSISTENCE_UNAVAILABLE; missing/wrong restore acknowledgement or RESTORE_ACK_REQUIRED -> DATA_LOSS_ACK_REQUIRED; RESTORE_CONFLICT/RESTORE_BLOCKED/RESTORE_RECOVERY_REQUIRED map identically. An internal persistence INVALID_INPUT after accepted CLI parsing, impossible adapter tag, non-Error/unknown throw, or any unlisted value maps only to INTERNAL_ERROR. Error code determines the sole C19 message and exit; internal message/details are discarded.",
        "source": "A0 attempt-two F-EP01D-A0-001 exhaustive mapper"
      },
      {
        "id": "C25",
        "statement": "The schema-v4 semantic/rebuild contract is exact. `action_set_sha256` is uppercase SHA-256 of persistence canonicalJson applied to the C20 ordered array (recursive lexicographic object keys, array order preserved, compact JSON plus one LF). The lifecycle state digest uses the same function over exactly `{domain,registry,bootstrap,identity,grants,epochs,requests,decisions,audit}` after authorizing request/decision/audit and before lifecycle insertion; decoded collections are sorted by primary identity and lifecycle rows are excluded. Bootstrap version 3 has exactly the original fifteen historical bootstrap-origin grants and may have no identity only before adoption; version 4 has exactly C20 and must have the C4/C28 identity whose bootstrap/adoption requests both equal the bootstrap request. An adopted version-3 state has one identity whose bootstrap request equals the historical bootstrap request and adoption request equals epoch revision 1's renewal request; identity actor need not equal historical actor and the legacy principal is never treated as attested. Root-origin grants share their own origin actor/request/not-before/expiry and action set; epoch revisions are contiguous from 1, request action/result/event are renew/renewal/capability.renewed, epoch actor/root match local identity, and expiry obeys C20; delegated lineage remains EP-01C. Each lifecycle row stores evaluated historical revision: at issuance grant_revision equals the allow decision and then-live unrevoked grant revision. Later decode accepts the still-live revision or a historical row only when current revision=stored+1, both revocation fields are nonnull, revocation time>=issued_at, immutable revocation relation is valid, and original allow decision matches; no further revision exists. Persistence use requires current revision exactly stored and both revocation fields null. Each lifecycle FK resolves to same-identity operation request, accepted authorization event, exact digest/counts, and 0<expiry-issued<=5 minutes. 0004 runs inside the runner's BEGIN IMMEDIATE with foreign_keys ON and `PRAGMA defer_foreign_keys=ON`: drop only ten owned triggers/two grant indexes, rename five rebuilt tables `_v3`, create rebuilt parents then identity/epoch/grant/decision/audit/lifecycle children in FK-safe order, copy requests, bootstrap, grants, decisions, audit with vocabulary_version=3 and null epoch, drop `_v3` children-to-parent, recreate indexes/triggers, assert identical row counts/content projections, assert no identity/epoch/lifecycle row, and require empty foreign_key_check before fingerprint/commit. Any failure rolls the whole migration back unchanged.",
        "source": "A0 attempt-two F-EP01D-A0-003 Tier-2 closure"
      },
      {
        "id": "C26",
        "statement": "Lifecycle file schema 2 is closed. The only lifecycle authorization hash preimage is the decoded row projected exactly as `{authorizationId,operation,backupGenerationId,actorId,runtimeRootKey,grantId,grantRevision,requestId,decisionId,auditId,authorizedStateSha256,expectedRequestCount,expectedDecisionCount,expectedAuditCount,issuedAt,expiresAt}`: every value is a decoded string except grantRevision and the three expected counts, which are JSON integers; field names are exactly this camelCase spelling, no SQL name or extra field participates, and uppercase SHA-256 is computed over persistence canonicalJson with recursive lexicographic object-key order, compact JSON, and one LF. A backup manifest has exactly the schema-1 fields plus, in schema-2, `provenanceKind`=application|pre_upgrade_internal, `lifecycleAuthorizationId` string|null, `lifecycleAuthorizationSha256` uppercase SHA-256|null, and `sourceApplicationStateSha256` uppercase SHA-256|null: manual requires application, schema 4, all three nonnull, a matching runtime.backup lifecycle row inside the cloned database, matching generation/state/row digest, and terminal decoder; pre_upgrade requires pre_upgrade_internal, kind pre_upgrade, all three null, and is never CLI-restorable. Schema-1 generations remain read-only verifiable history only. Restore-intent schema 2 has exactly schema-1 fields plus backupManifestSchemaVersion=2, backupAuthorizationId, backupAuthorizationSha256, restoreAuthorizationId, restoreAuthorizationSha256, restoreAuthorizedStateSha256; receipt schema 2 has exactly schema-1 fields plus backupManifestSha256 and the same five authorization fields. Authorization hashes always use the exact projection above; manifest/intent/receipt object hashes use persistence canonicalJson of their respective exact schema-2 object. Intent fields must match the verified manual manifest and current runtime.restore lifecycle row, receipt must byte-for-byte repeat those links plus the intent physical CAS/target facts, retained prior primary must contain the restore authorization, restored target must contain the backup authorization/state, and recovery/verification rejects any missing/extra/mismatched field. Existing schema-1 intent/receipt parsing remains only for historical interrupted-state detection/recovery internals and creates no ato.api/v1 restore route.",
        "source": "A0 attempt-two F-EP01D-A0-007 exact artifact binding"
      },
      {
        "id": "C27",
        "statement": "Manual-backup publication has one exhaustive terminal matrix while both C22 barriers remain held. Any caught error before successful rename, including allocation/clone/staged verification/terminal recheck/commit/manifest write, removes only the ownership-verified current stage and records no generation; the already-open store retains its sole connection receipt until normal close. Process termination at any durable pre-rename point can run no cleanup: the UUID-named stage, whatever exact subset of database/manifest exists, the initiating store's authoritative connection receipt, and the already-held authoritative lifecycle.lock crash residue are retained. Inventory classifies every retained safe stage as invalid (or unsafe identity as runtime_unsafe), but the public surface follows C23/C24 precedence. For lock-plus-receipt plus stage-or-generation residue, doctor reports runtime_active; normal PersistenceStore open, an otherwise-authorized ordinary non-lifecycle CLI command, backup, restore, and primary-identity inspection each fail LIFECYCLE_BUSY mapped publicly to RUNTIME_ACTIVE before another receipt/stage/intent, and each route preserves the exact lock, crash-receipt, and stage-or-generation bytes, file/directory identity, modification timestamps, and inventory. The primary bytes remain unchanged and are readable only through the existing persistence-owned low-level read path used by the targeted diagnostic test; that test path preserves the same residue and creates no product bypass. For receipt-only/no-lock residue, doctor reports runtime_active; isolated current-schema normal-store and otherwise-authorized ordinary non-lifecycle CLI routes succeed under the existing multi-reader rule, create and normally release only their own receipt, and preserve the exact crash-receipt bytes, identity, timestamps, and final inventory; isolated backup, restore, and primary-identity routes fail typed ACTIVE_CONNECTIONS mapped to RUNTIME_ACTIVE and preserve that same receipt evidence. For safe-stage/no-lock/empty-receipt residue, doctor reports backup_invalid; isolated backup and restore routes fail BACKUP_INVALID; isolated current-schema normal-store and otherwise-authorized ordinary non-lifecycle CLI routes succeed and normally release only their own receipt; isolated primary-identity inspection succeeds; every route preserves the exact stage bytes, directory/file identity, modification timestamps, and inventory. No open/doctor/retry path deletes, completes, renames, or trusts any lock, receipt, or stage residue; there is no stale-lock/receipt deletion, automatic recovery, or CLI cleanup API. Successful atomic rename makes that generation present and immutable; normal return verifies and reports it. A caught exception after rename reverifies the exact generation: valid returns the same success after normal lock release, verification failure retains it and returns BACKUP_INVALID, except unsafe/path identity maps RUNTIME_UNSAFE. Process termination after rename retains the terminal generation, initiating connection receipt, and lock residue: direct generation verification preserves its valid/invalid classification while the same lock-plus-receipt route matrix applies. Retry after a valid terminal generation, normal lock release, and normal initiating-store close uses new authorization/allocation and a distinct generation; retry while either a pre-rename stage residue or lifecycle lock residue exists fails without overwrite/delete.",
        "source": "A0 attempt-three F-EP01D-A0-014 publication-linearization disposition"
      },
      {
        "id": "C28",
        "statement": "The new-table canonical DDL is exact. `authorization_local_identity` columns are singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton=1), identity_version INTEGER NOT NULL CHECK(identity_version=1), actor_id TEXT NOT NULL CHECK(length(actor_id) BETWEEN 1 AND 128), principal_sha256 TEXT NOT NULL CHECK(length(principal_sha256)=64 AND principal_sha256 NOT GLOB '*[^0-9A-F]*'), platform TEXT NOT NULL CHECK(length(platform) BETWEEN 1 AND 32), runtime_root_key TEXT NOT NULL CHECK(length(runtime_root_key)>0), bootstrap_request_id TEXT NOT NULL UNIQUE, adoption_request_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL CHECK(length(created_at)>0), UNIQUE(actor_id,runtime_root_key), FK bootstrap_request_id->authorization_bootstrap(request_id), and FK adoption_request_id->application_requests(request_id). `authorization_capability_epochs` columns are epoch_id TEXT PRIMARY KEY NOT NULL CHECK(length(epoch_id) BETWEEN 1 AND 128), epoch_revision INTEGER NOT NULL UNIQUE CHECK(epoch_revision>0), actor_id TEXT NOT NULL CHECK(length(actor_id) BETWEEN 1 AND 128), runtime_root_key TEXT NOT NULL CHECK(length(runtime_root_key)>0), vocabulary_version INTEGER NOT NULL CHECK(vocabulary_version=4), action_set_sha256 TEXT NOT NULL CHECK(length(action_set_sha256)=64 AND action_set_sha256 NOT GLOB '*[^0-9A-F]*'), request_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL CHECK(length(created_at)>0), expires_at TEXT NOT NULL CHECK(length(expires_at)>0), UNIQUE(epoch_id,request_id), composite FK actor_id/runtime_root_key->authorization_local_identity(actor_id,runtime_root_key), and request FK. `application_lifecycle_authorizations` columns are authorization_id TEXT PRIMARY KEY NOT NULL CHECK(length(authorization_id) BETWEEN 1 AND 128), operation TEXT NOT NULL CHECK(operation IN ('runtime.backup','runtime.restore')), backup_generation_id TEXT NOT NULL CHECK(length(backup_generation_id) BETWEEN 1 AND 128), actor_id TEXT NOT NULL CHECK(length(actor_id) BETWEEN 1 AND 128), runtime_root_key TEXT NOT NULL CHECK(length(runtime_root_key)>0), grant_id TEXT NOT NULL CHECK(length(grant_id) BETWEEN 1 AND 128), grant_revision INTEGER NOT NULL CHECK(grant_revision>0), request_id TEXT NOT NULL UNIQUE, decision_id TEXT NOT NULL UNIQUE, audit_id TEXT NOT NULL UNIQUE, authorized_state_sha256 TEXT NOT NULL CHECK(length(authorized_state_sha256)=64 AND authorized_state_sha256 NOT GLOB '*[^0-9A-F]*'), expected_request_count INTEGER NOT NULL CHECK(expected_request_count>=1), expected_decision_count INTEGER NOT NULL CHECK(expected_decision_count>=1), expected_audit_count INTEGER NOT NULL CHECK(expected_audit_count>=1), issued_at TEXT NOT NULL CHECK(length(issued_at)>0), expires_at TEXT NOT NULL CHECK(length(expires_at)>0), composite identity FK, stable grant_id FK, and request/decision/audit FKs. Every FK is ON UPDATE RESTRICT ON DELETE RESTRICT; all three tables are STRICT and each has exactly named `<table>_no_update` and `<table>_no_delete` unconditional abort triggers. Decoders additionally require canonical timestamps, UUID generation, C4 identity semantics, cross-row equality, created/issued<expires, and exact hashes/counts. Negative direct-SQL tests insert NULL into every listed mandatory column and must fail before any row persists.",
        "source": "A0 attempt-four F-EP01D-A0-020 exact-nullability disposition"
      },
      {
        "id": "C29",
        "statement": "A valid Domain-only legacy state is one terminally decoded schema-2/3/4 Domain snapshot, empty ProjectRegistry, and no bootstrap/identity/grant/epoch/request/decision/audit/lifecycle row; nonempty Projects/Tasks/dependencies are permitted and remain authoritative Domain data. Migration preserves it byte-semantically and creates no authority. At schema 4, confirmed init is the only mutating pre-bootstrap command and adds authorization state without changing Domain. Thereafter project.register remains application-owned and has exactly two modes under the same authorization, confirmation, root inspection, request/decision/audit, and atomic transaction: if the Project is absent from Domain and registry it performs the existing EP-01C Domain+registry registration; if the Project already exists in preserved Domain but is absent from registry it inserts only that ProjectRegistry binding, leaves the Domain Project/Tasks/dependencies/revisions byte-semantically unchanged, and returns the bound Project. Existing registry remains PROJECT_ALREADY_REGISTERED; any root/id/revision/Domain decode ambiguity fails atomically. Until bound, show/update/disable/task/dependency operations for that legacy Project return PROJECT_NOT_FOUND and never infer a filesystem root. This transition is not identity adoption, migration fabrication, or EP-02 behavior.",
        "source": "A0 attempt-four F-EP01D-A0-019 Domain-only legacy disposition"
      },
      {
        "id": "C30",
        "statement": "The schema-4 pre-adoption state is a fully decoded migrated vocabulary-version-3 bootstrap/application history with its exact historical grants, optional delegated grants and Project/Task data, no local identity, no epoch, and no lifecycle row. Doctor projects it as `{health:'upgrade_required',initialized:true,schemaVersion:4,activeUse:false,backupInventory:verified empty|valid|invalid,restoreState:verified none|pending|ambiguous}` subject to C23 higher precedence. After valid CLI parsing the closed command table is: doctor returns that projection without a grant; authorization.renew with exact current confirmation/expiry performs C20 adoption and returns mode adopted; missing/wrong confirmation returns CONFIRMATION_REQUIRED with no write; init returns RUNTIME_ALREADY_INITIALIZED with no write; status and every other C16 command return AUTHORIZATION_DENIED with no request/decision/audit/identity/epoch/target write. Parser errors retain C17-C19 precedence. Restart preserves this table until adoption; successful adoption makes the normal identity-bound schema-4 state healthy, and re-adoption follows ordinary renewal eligibility rather than rebinding.",
        "source": "A0 attempt-five F-EP01D-A0-021 pre-adoption disposition"
      },
      {
        "id": "C31",
        "statement": "A successful authorization.capability.renew operation has one exact relation that is the sole exception to the inherited generic request/decision equality and grant-required-allow rules. The request is action authorization.capability.renew, target runtime/id runtime/revision null, result renewal, current identity actor, and operation correlation/time. Its unique decision has the same request/actor/action/time, result allow, reason allowed, policy_result allow, and grant_id/grant_revision/project_id/resource_revision all null. Its unique audit has that decision id, event capability.renewed, result accepted, the same actor/correlation/runtime target/time, reason accepted, and exact canonical details for renewal/accepted/runtime/null revision. Exactly one next epoch references the request, and exactly nineteen epoch-provenance grants use created_request_id=request id; on adoption exactly one identity uses adoption_request_id=request id, otherwise no identity row is inserted. The decoder expects nineteen created grants for renewal, no revoked grant, one allow decision despite request result renewal, one accepted audit, and exact actor/root/time/expiry/action-set relations. Every other request retains EP-01C equality/cardinality; any mismatch in this tuple is CORRUPT_ROW and transaction/failpoint tests prove all-or-none.",
        "source": "A0 attempt-five F-EP01D-A0-022 renewal-relation disposition"
      },
      {
        "id": "C32",
        "statement": "C28 table options are exact: authorization_local_identity is created `STRICT, WITHOUT ROWID`, so explicit NULL singleton cannot auto-allocate a rowid and must fail; authorization_capability_epochs and application_lifecycle_authorizations are STRICT rowid tables with their explicitly NOT NULL text primary keys. Schema fingerprint and migration assertions include those exact options. The V5 NULL matrix uses explicit bound NULL for every mandatory column, including identity singleton on an empty pre-adoption database, and each statement must fail with zero rows and unchanged surrounding state.",
        "source": "A0 attempt-five F-EP01D-A0-024 singleton-null disposition"
      }
    ],
    "authorization": {
      "allowed": [
        "Read repository material and modify only task-owned paths in the coordinator-owned task/ep-01d worktree.",
        "Create, activate, implement, audit, validate, complete, and persist the unique EP-01D schema-v3 ExecPlan and its task-owned evidence.",
        "Implement the exact local Phase 1 CLI/API contract, trusted local ingress, finite capability epoch/restore authorization, one additive 0004 migration, application/persistence narrow extensions, backup/restore/doctor surface, tests, package smoke, and truthful documentation named by this contract.",
        "Run local offline tests that use only creator-owned .task-artifacts generations and disposable runtime/Project fixtures, including deliberate malformed input, corruption, contention, migration, reparse/path-identity, backup, restore, interruption, and restart cases that preserve external targets.",
        "Use fresh independent read-only subagents for A0, A1, and any required A2; record their reports and parent dispositions without granting reviewer mutation authority.",
        "Create task-owned implementation and terminal commits, explicitly invoke the frozen pathless artifact prune after the result commit, record real exact-head gates, perform coordinator FF-only local integration, and invoke the repository standing-authorized ordinary origin/master push only when every prerequisite remains exact."
      ],
      "requires_reapproval": [
        "Any change to the product goal, EP chain, public/data/security outcome, CLI major or command envelope, schema allocation, task-path envelope, external-path set, required gate set, binary validation criterion, Tier-2 guarantee, dependency/toolchain, terminal persistence action, or authorization boundary.",
        "Any implementation or allocation for EP-02, execution, running/completed flow, attempts, claim/lease/fence, dispatcher, scheduler, port, adapter, workspace/completion, external intent/effect, gate, MCP, Skill/plugin, Git/Project mutation, arbitrary shell/SQL/filesystem access, diagnostic export, telemetry, network action, release, deployment, or platform support.",
        "Any network action except the exact repository standing-authorized ordinary origin/master push after prerequisites, any dependency download/audit query, secret/account use, mutation of another repository or real user runtime/Project, PR, release, deployment, non-standing push, destructive cleanup, or force/rebase/reset/stash/clean operation.",
        "Any restore/recovery behavior that deletes retained bytes, guesses ambiguous topology, automatically recovers an intent, accepts a non-current or non-manual backup, or weakens exact current authorization/confirmation/data-loss acknowledgement."
      ],
      "prohibited": [
        "Modify D:/quant, another repository, a real external Project, user runtime data, secrets, or accounts; create a PR; release or deploy.",
        "Use arbitrary network access, force push, rebase, reset, stash, clean, force/destructive cleanup, coordinator cleanup, history rewriting, or edits to completed plans/evidence or migrations 0001/0002/0003.",
        "Commit databases, WAL/SHM files, backups, restore material, logs, diagnostics, dependency stores, build/package output, ignored scratch, prompts, source excerpts, credentials, personal paths, or sensitive actor/correlation values.",
        "Interpret Project/Task/repository/prompt/tool/Agent content, environment content, a Domain-ready state, a policy allow, a prior decision, a plan, test, CLI output, or error message as permission.",
        "Claim EP-02 execution, an adapter, scheduler, MCP, external effect, supported platform/API, hosted CI, release, deployment, multi-user/RBAC/cloud security, telemetry, automatic repair, or automatic recovery."
      ],
      "persistence": {
        "required": true,
        "action": "task-owned commits culminating in one completed-plan terminal commit, then manifest-backed prune, exact-head gates, coordinator FF-only local integration, and the standing-authorized ordinary origin/master push",
        "source": "Current user delegation plus AGENTS.md/local Git-flow standing grants"
      }
    },
    "scope": {
      "task_paths": [
        { "path": "AGENTS.md", "kind": "file" },
        { "path": "ARCHITECTURE.md", "kind": "file" },
        { "path": "CHANGELOG.md", "kind": "file" },
        { "path": "README.md", "kind": "file" },
        { "path": "docs/compatibility/v0.1.md", "kind": "file" },
        { "path": "docs/README.md", "kind": "file" },
        { "path": "docs/plans/proposal/EP-01D-product-cli-phase1-closure.md", "kind": "file" },
        { "path": "docs/plans/active/EP-01D-product-cli-phase1-closure.md", "kind": "file" },
        { "path": "docs/plans/completed/EP-01D-product-cli-phase1-closure.md", "kind": "file" },
        { "path": "docs/plans/evidence/EP-01D", "kind": "directory" },
        { "path": "docs/reference/authorization-contract.md", "kind": "file" },
        { "path": "docs/reference/cli-contract.md", "kind": "file" },
        { "path": "docs/reference/contract-ownership.md", "kind": "file" },
        { "path": "docs/reference/persistence-contract.md", "kind": "file" },
        { "path": "docs/reference/toolchain-contract.md", "kind": "file" },
        { "path": "docs/reference/validation-policy.md", "kind": "file" },
        { "path": "docs/reference/versioning-compatibility-contract.md", "kind": "file" },
        { "path": "docs/security/privacy-and-logging.md", "kind": "file" },
        { "path": "docs/security/threat-model.md", "kind": "file" },
        { "path": "migrations/0004-phase1-cli.sql", "kind": "file" },
        { "path": "package.json", "kind": "file" },
        { "path": "scripts/package-smoke.mjs", "kind": "file" },
        { "path": "scripts/repo-utils.mjs", "kind": "file" },
        { "path": "src/application.ts", "kind": "file" },
        { "path": "src/authorization.ts", "kind": "file" },
        { "path": "src/cli-api.ts", "kind": "file" },
        { "path": "src/cli.ts", "kind": "file" },
        { "path": "src/index.ts", "kind": "file" },
        { "path": "src/node-builtins.d.ts", "kind": "file" },
        { "path": "src/persistence/application-repository.ts", "kind": "file" },
        { "path": "src/persistence/backup.ts", "kind": "file" },
        { "path": "src/persistence/database.ts", "kind": "file" },
        { "path": "src/persistence/doctor.ts", "kind": "file" },
        { "path": "src/persistence/errors.ts", "kind": "file" },
        { "path": "src/persistence/index.ts", "kind": "file" },
        { "path": "src/persistence/local-ingress.ts", "kind": "file" },
        { "path": "src/persistence/migrations.ts", "kind": "file" },
        { "path": "src/persistence/runtime.ts", "kind": "file" },
        { "path": "src/persistence/store.ts", "kind": "file" },
        { "path": "test/application-atomicity.test.mjs", "kind": "file" },
        { "path": "test/application-service.test.mjs", "kind": "file" },
        { "path": "test/authorization.test.mjs", "kind": "file" },
        { "path": "test/cli-contract.test.mjs", "kind": "file" },
        { "path": "test/cli-e2e.test.mjs", "kind": "file" },
        { "path": "test/cli-security.test.mjs", "kind": "file" },
        { "path": "test/configuration.test.mjs", "kind": "file" },
        { "path": "test/domain-architecture.test.mjs", "kind": "file" },
        { "path": "test/domain-property-state-machine.test.mjs", "kind": "file" },
        { "path": "test/domain-unit.test.mjs", "kind": "file" },
        { "path": "test/persistence-backup-restore.test.mjs", "kind": "file" },
        { "path": "test/persistence-concurrency.test.mjs", "kind": "file" },
        { "path": "test/persistence-doctor.test.mjs", "kind": "file" },
        { "path": "test/persistence-path-security.test.mjs", "kind": "file" },
        { "path": "test/persistence-repository.test.mjs", "kind": "file" },
        { "path": "test/persistence-schema-migrations.test.mjs", "kind": "file" },
        { "path": "test/persistence-smoke.test.mjs", "kind": "file" },
        { "path": "test/persistence-test-helpers.mjs", "kind": "file" },
        { "path": "test/scaffold.test.mjs", "kind": "file" }
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "The unique schema-v3 EP-01D plan binds the exact EP-01C terminal/current base, freezes the CLI, finite authorization, schema-v4, restore, doctor, privacy, and Tier-2 boundaries, passes fresh independent A0, and becomes active without changing historical plans or EP-02.",
        "validation_ids": ["V1", "V16"]
      },
      {
        "id": "M2",
        "outcome": "One immutable additive 0004 migration and existing authorization/application owners implement C4/C28 one-time local identity binding, exact four new granted actions, non-grantable bound-actor finite epoch CAS, C29 legacy Domain root binding, and C22 lifecycle handoff, preserve earlier bytes/data, and atomically reject replay, rebind, expansion, expiry, revocation, corruption, stale revision, and failure.",
        "validation_ids": ["V3", "V5", "V13"]
      },
      {
        "id": "M3",
        "outcome": "The authoritative ato.api/v1 CLI parser, trusted local actor/confirmation ingress, human/JSON allowlist projection, stable errors, and exit codes reject every unknown, malformed, over-limit, control-character, injected, or content-self-authorization input before target mutation.",
        "validation_ids": ["V2", "V3", "V6"]
      },
      {
        "id": "M4",
        "outcome": "Every Project, Task, dependency, grant, status, and exact-query CLI command calls the EP-01C application service and produces the same accepted/denied state, revision, Domain, authorization, request, decision, and audit outcomes without a second business-rule implementation or Task-body/path disclosure.",
        "validation_ids": ["V4", "V10", "V13"]
      },
      {
        "id": "M5",
        "outcome": "Backup creation, current-authorized and explicitly confirmed restore, and no-write doctor exclusively consume the persistence lifecycle owners, survive restart, fail closed for stale/corrupt/active/ambiguous/path-invalid state, and expose only redacted terminal evidence.",
        "validation_ids": ["V7", "V8", "V9", "V10"]
      },
      {
        "id": "M6",
        "outcome": "Source, built, packed-installed, package-export, migration, status, smoke, and install-facing documentation surfaces agree on the complete local Phase 1 capability and stable output/exit contract while execution and support claims remain absent.",
        "validation_ids": ["V11", "V12", "V14"]
      },
      {
        "id": "M7",
        "outcome": "The stable candidate first proves all non-review material gates and exact task ownership, then passes fresh independent A1 and every required A2, records audit closure, and reaches ExecPlan completion readiness, with unavailable/unauthorized routes recorded truthfully for later coordinator-only terminal transitions.",
        "validation_ids": ["V13", "V14", "V15", "V17", "V18", "V19"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "strict EP-01C predecessor and current material base",
        "criterion": "terminal-resolve returns only 511f444f44d5404459875452f42b0055cc94785c for completed EP-01C; historical scope at that commit is completed and clean; Git proves the task initial/current base equals that terminal; chain-check with the unique EP-01D plan has no error, second predecessor, or later product dependency."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "versioned strict CLI grammar, output schema, and exit taxonomy",
        "criterion": "Contract tests exhaust C16-C24 command-path/ID/option signatures, conditional fields, bounds, confirmation/acknowledgement mapping, result types/enums/order, canonical JSON and human escaping, list cursor/count semantics, every fixed message, exhaustive internal map, and ato.api/v1 envelopes; every accepted command has one exact ID/output/exit 0. A syntactically valid canonical authorization.list limit outside 1..100 returns RESULT_LIMIT_EXCEEDED/6; malformed, noncanonical, or unsafe limits return CLI_INVALID_INPUT/2. Every concrete Domain error including NO_OP is nested application DOMAIN_REJECTED and maps only to public DOMAIN_REJECTED/6. Every unknown/alias/short/equals/repeated/post-global command or option, missing/extra value, other malformed version/path/number/time/identifier, forbidden character, injection token, or overflow returns the exact safe code/exit before selecting, creating, or opening runtime state."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "trusted local actor, confirmation, finite grant, and content-self-authorization boundary",
        "criterion": "Tests prove C4 principal/actor preimages/digests against OS/root vectors, stable restart, fresh bootstrap trusted_principal equals both C4 and identity principalSha256, no raw OS/path output, and fail-closed identity change; identifiers cannot come from CLI/environment/content. Real schema-3 fixtures preserve arbitrary historical principal bytes, restart in exact C30 pre-adoption state, expose only doctor and confirmed adoption, reject init/status/every other command with the exact no-write code, then adopt once without rewriting history and reject rebind/concurrency/mismatch. C31 success and every field-level corruption vector prove renewal request=renewal, allow/no-grant decision, accepted audit, identity/epoch/nineteen-grant cardinality and atomic failpoints. Confirmation, eligibility, revocation, scope, expiry, expansion, and injection negatives cannot mutate/leak."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "CLI-to-application parity and absence of duplicate business rules",
        "criterion": "For every Project/Task/dependency/grant/exact-query CLI command, paired tests compare sanitized CLI outcome and durable state with a direct typed application-service call. C29 tests bind a preserved Domain-only Project without changing its Project/Task/dependency bytes or revisions, while new registration still mutates Domain+registry and ambiguity fails atomically. Illegal transition, cycle, cross-Project parent, duplicate/self dependency, disabled Project, terminal mutation, stale Project/Task/dependency/grant revision, and denied policy are rejected atomically, and static dependency checks find no Domain/authorization/ProjectRegistry/persistence rule implementation in the CLI."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "immutable schema-v4 migration, capability epochs, and upgrade matrix",
        "criterion": "Checksums 0001/0002/0003 equal EP-01C; registry 1/2/3/4; fresh and real 1/2/3->4 upgrades require verified backup; C21/C25/C28/C32 literal affinities/nullability/table options/enums/keys/FKs/checks/triggers/digests/rebuild pass with FK ON and empty foreign_key_check. Explicit bound NULL into every mandatory column, especially singleton in empty STRICT WITHOUT ROWID identity, fails with zero rows. Legacy bytes/relations decode unchanged at vocabulary 3 with absent identity/epoch; fresh bootstrap, adoption and renewal produce C4/C31 lineage. Lifecycle historical/use rules pass. Failed rebuild, concurrency/replay/partial identity/epoch/lifecycle, checksum/history/fingerprint drift, storage/provenance/revision/digest/count, and schema 5 fail atomically with no EP-02 object."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "safe runtime-root selection and path identity",
        "criterion": "CLI and persistence tests prove default/explicit runtime data stays under one owner-issued user-data root outside source and registered Projects; relative/root/traversal/overlap, missing/partial existing topology, case/Unicode ambiguity, symlink/junction/reparse, identity substitution, unknown descendant, and environment-content injection fail closed without touching the target or printing a full path."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "product backup creation and restart verification",
        "criterion": "An initialized CLI runtime creates a manual backup only after a current runtime.backup application decision and C22 handoff from the sole receipt-owning open store. Barrier/receipt/failpoint tests cover allocation, before/after clone, terminal BEGIN IMMEDIATE recheck, commit, manifest, before rename, and after rename. Caught pre-rename failure removes only owned stage and normal store close removes only its own receipt. Real child-process kill at every durable pre-rename stage retains exact stage plus the initiating connection receipt and lifecycle.lock residue; post-kill isolated fixtures cover doctor, normal store open, an otherwise-authorized ordinary non-lifecycle CLI command, backup, restore, primary identity, and persistence-owned low-level primary read, with exact C27 outcomes and terminal lock/receipt/stage bytes, identities, modification timestamps, and inventory unchanged after every route. Separate receipt-only/no-lock isolated fixtures cover doctor, store, ordinary CLI, backup, restore, and primary identity with exact C27 outcomes; successful readers remove only their own receipt and every route preserves the crash receipt's exact bytes, identity, timestamps, and final inventory. Separate safe-stage/no-lock/empty-receipt isolated fixtures cover the same six routes, prove exact backup_invalid/BACKUP_INVALID or success outcomes, and preserve exact stage bytes, identities, modification timestamps, and inventory. Post-rename caught valid material succeeds after reverification, normal lock release, and normal initiating-store close; child-process termination retains a directly verifiable terminal generation plus initiating receipt and runtime_active lock residue under the same isolated-route preservation matrix, while invalid material is retained/classified. A normal valid retry after normal close uses a distinct generation. Schema-2 C26 generation binds authorization/restart and returns C23 only; missing/extra/reparse/changed/corrupt/newer/wrong-application/legacy/non-manual material is rejected without leakage. Pre-upgrade backups remain distinct."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "current-authorized explicit restore and data-loss consequence",
        "criterion": "Restore tests cover absent/wrong confirmation, absent/expired/revoked runtime.restore grant, missing data-loss phrase, handoff expiry during close/stage, later application write/revocation, digest/count/request/decision/audit/grant/actor/root/generation substitution, malformed/wrong/corrupt/stale/legacy/pre-upgrade/newer backup, wrong physical CAS, active connection, pending/ambiguous intent, and path substitution as pre-intent typed refusal. A successful exact-current schema-2 manual restore retains the authorizing prior primary, publishes/validates a schema-2 intent/receipt binding both authorizations, discards post-backup data as disclosed, does not fabricate target audit, terminal-decodes the restored application state, and reads expected backup-time Project/Task/grant/audit plus receipt facts after restart; every post-intent interruption is recovery-required."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "doctor diagnostic coverage and physical read-only proof",
        "criterion": "Grant-independent doctor reports only C23/C30 projection/precedence. Fixtures prove absent; schema 1/2; nonempty Domain-only 2->3->4; empty/initialized 3/4; migrated bootstrap pre-adoption as exact upgrade_required,true,4 and its closed command table across restart; successful adoption to healthy; C29 binding; partial/active/restore/unsafe/newer/migration/corrupt/lifecycle/generation/stage outcomes. Domain-only/pre-adoption are never falsely corrupt and transitions preserve history/revisions. No sensitive identifiers/counts leak. Recursive no-follow inventories and byte/hash/time identities are identical before/after doctor; no bootstrap/grant/request/audit/identity/receipt/repair/delete/checkpoint/migration/open-write/path/raw error occurs."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "empty-runtime Phase 1 workflow, restart, and durable readback",
        "criterion": "Separate CLI processes complete init -> Project register/show -> Task create/update/mark-ready/show -> dependency add/remove -> status/exact query -> backup; another process reads the same sanitized Project/Task status, authorization/audit counts, schema, and verified backup facts, while Task body and full paths remain absent and every failed step leaves no partial target mutation."
      },
      {
        "id": "V11",
        "type": "automated",
        "target": "source, built, and packed-installed CLI parity",
        "criterion": "A parity matrix invokes the source CLI, dist/cli.js, and isolated packed-installed ato with the same disposable runtime inputs and verifies identical command IDs, JSON schemas, redacted fields, stable errors, and exit codes; human mode is stable and safe; install/uninstall and package-root declarations succeed offline; no runtime/build/package artifact survives."
      },
      {
        "id": "V12",
        "type": "automated",
        "target": "frozen toolchain, package boundary, and dependency shape",
        "criterion": "Strict TypeScript 5.9.3 typecheck/build, lint, dependency shape, exact four-migration/source inventories, package declarations, and package smoke pass under Node 24.19.0/pnpm 11.19.0 with zero production dependencies and no interface import of node:sqlite, raw SQL, feasibility, vendor, EP-02, network, or undeclared built-in code."
      },
      {
        "id": "V13",
        "type": "automated",
        "target": "EP-01C Domain/application/authorization/persistence regression and concurrency",
        "criterion": "All existing Domain unit/property/state-machine, ProjectRegistry, authorization, application parity/atomicity/failpoint, migration, repository, backup/restore, runtime path, SQLite FK/WAL/concurrency/CAS, restart/corruption, and artifact-hygiene tests pass with zero fail/skip/todo; new lifecycle authorization/CLI behavior cannot select running/completed or weaken any previous rejection."
      },
      {
        "id": "V14",
        "type": "manual",
        "target": "authoritative documentation, privacy, and capability truthfulness",
        "criterion": "Exact-case repository links pass and manual authority/privacy/capability review finds one owner for CLI/API, authorization epochs, schema, lifecycle operations, diagnostic fields, error/exit mapping, and validation; README/install/status/changelog/contracts claim exactly implemented local Phase 1 CLI behavior, name Windows evidence without a support claim, and keep EP-02, MCP, adapters, external effects, hosted CI, release, telemetry, repair, and automatic recovery unimplemented/unverified."
      },
      {
        "id": "V15",
        "type": "automated",
        "target": "complete offline repository gate",
        "criterion": "With network disabled and the frozen local dependency, pnpm verify:offline exits 0 end to end, every discovered Node test and targeted persistence route passes with zero fail/skip/todo, package/SQLite checks pass, Codex externalE2E remains not_run with supportClaim=false, git diff --check passes, and .task-artifacts returns to its exact baseline."
      },
      {
        "id": "V16",
        "type": "manual",
        "target": "ExecPlan independent activation audit",
        "criterion": "Before activation, the unique proposal passes fresh independent A0 at the exact accepted EP-01C base and current approval digest; the parent closes or revises every finding; trace reports a0_ready=true with no schema, authorization, scope, chain, base, warning, outside-scope, overlap, or stale-A0 error."
      },
      {
        "id": "V17",
        "type": "manual",
        "target": "unsupported and unauthorized route truthfulness",
        "criterion": "Final evidence names online audit, hosted CI, real external E2E, non-Windows platform support, secret/account, D:/quant/other repository, PR, release, deployment, cleanup, EP-02, execution, adapter, scheduler, MCP, external effect, network, telemetry, automatic repair, and ambiguous restore recovery as not run/unimplemented/unauthorized as applicable, with no dependent claim or action."
      },
      {
        "id": "V18",
        "type": "automated",
        "target": "pre-review material validation and task ownership",
        "criterion": "Before A1, a fresh schema-v3 trace at the stable candidate proves only approved regular task-owned material, no historical completed-plan/evidence or 0001/0002/0003 byte change, exact approval/base/material binding, terminal V1-V17, completed M1-M6, and no error, outside-scope path, overlap, stale A0/material validation, or blocker other than pending A1/V19/M7/final-summary and V18 recording itself. V19 is not required here; terminal commit/prune/gates/ready/integration/push remain coordinator-only facts outside tracked plan material."
      },
      {
        "id": "V19",
        "type": "manual",
        "target": "ExecPlan independent implementation-audit closure",
        "criterion": "At the exact stable V18 material state, fresh independent A1 is complete and parent-disposed; every confirmed in-scope HIGH/MEDIUM repair has fresh independent A2 closure at the final repaired state; all finding dispositions and closure evidence satisfy schema v3; V1-V18 and M1-M6 are terminal/current; and a fresh trace permits only V19's own result, M7, and final_summary to remain pending. The parent then records V19, completes M7/final_summary, and requires a final completion-ready trace before moving active to completed; V19 never requires its own record or already-completed M7/final_summary."
      }
    ],
    "risks": [
      {
        "id": "R1",
        "risk": "A CLI parser or output mapper could become a second business-rule owner, accept ambiguous input, or disclose Task bodies, paths, actor/request identities, raw errors, or injected content."
      },
      {
        "id": "R2",
        "risk": "OS actor derivation, bootstrap renewal/adoption, or confirmation handling could silently broaden authority, change actor, recurse, or let content/environment data forge a current grant."
      },
      {
        "id": "R3",
        "risk": "Schema-v4 action/epoch changes could edit earlier migration bytes, fabricate new authority during v3 upgrade, break append-only/provenance relations, or allocate later-phase state."
      },
      {
        "id": "R4",
        "risk": "Restore authorization and persistence mutation are separated by store close, so stale/active/changed state or a post-intent interruption could be misreported as success or rollback."
      },
      {
        "id": "R5",
        "risk": "Doctor could create missing directories, open writable SQLite, update timestamps/pages, repair history, delete residue, or leak raw diagnostics while claiming to be read-only."
      },
      {
        "id": "R6",
        "risk": "Source, built, packed-installed, package exports, docs, status, and migration inventories could diverge or overclaim Phase 1/Windows/release behavior."
      },
      {
        "id": "R7",
        "risk": "Tracked lifecycle evidence could promise post-terminal coordinator receipts and create a material-head cycle or hide an unavailable/unauthorized route."
      }
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Use EP-01C terminal 511f444f44d5404459875452f42b0055cc94785c as both approval and current material base and require strict chain-check before completion.",
        "rationale": "Current master equals the unique predecessor, so no governance delta or substitute product predecessor exists."
      },
      {
        "id": "D2",
        "statement": "Create docs/reference/cli-contract.md as the sole ato.api/v1 command/output/error/exit owner and keep src/cli-api.ts as the testable parser/orchestrator while src/cli.ts is only the executable process adapter.",
        "rationale": "One contract and one implementation ingress prevent source/build/install drift and parallel rule definitions."
      },
      {
        "id": "D3",
        "statement": "Use exact positional command IDs plus a closed duplicate-free option map with command-specific key, type, cardinality, control-character, UTF-8 length, integer, timestamp, and finite-enum checks; do not accept JSON blobs, response-file expansion, shell fragments, SQL, glob, or arbitrary file options.",
        "rationale": "A narrow parser is composable while rejecting structural ambiguity and injection before runtime state is touched."
      },
      {
        "id": "D4",
        "statement": "Put exact C4 OS identity normalization/hashing, UUID issuance, current time, runtime selection, and command-bound confirmation construction in src/persistence/local-ingress.ts; expose no actor/principal setter or raw OS identity and pass only the derived binding plus resulting ApplicationIngress to the application owner.",
        "rationale": "Trusted local facts stay outside untrusted command content and use the same application authorization path as direct callers."
      },
      {
        "id": "D5",
        "statement": "Append 0004 with only C20 four new grants/renewal vocabulary, C21/C28 three exact relations, and C25 deferred-FK rebuild; add no unrelated object. Preserve every legacy row with vocabulary_version=3, null epoch and absent local identity; fresh bootstrap writes version 4 plus identity, confirmed legacy adoption writes the sole identity and revision-1 epoch, and later renewal writes one next-revision nineteen-grant epoch.",
        "rationale": "The reviewed schema allocation supports safe upgrade, finite renewal, authorized lifecycle handoff, and combined decode without silent permission expansion or a second authorization model."
      },
      {
        "id": "D6",
        "statement": "Use the C22 five-minute durable lifecycle handoff for both runtime.backup and confirmed runtime.restore. Persistence validates rather than reevaluates the application decision, serializes the final manual-backup check/publication against application writers, binds exact C26 schema-2 manifest/intent/receipt and physical CAS, preserves restore authorization only in retained evidence, performs terminal typed readback, treats every post-intent failure as recovery-required, and exposes no automatic recovery command.",
        "rationale": "Application owns permission and semantic state binding; persistence owns publication and recovery; the reviewed handoff closes the store-close race without moving policy or fabricating restored history."
      },
      {
        "id": "D7",
        "statement": "Implement doctor in src/persistence/doctor.ts using an existing-layout no-create issuer, no-follow inventories, read-only SQLite/schema/application decode, and backup/restore metadata verification; return only a closed diagnostic result and compare physical pre/post state in tests.",
        "rationale": "The persistence owner can inspect its topology without making CLI a raw filesystem/SQLite reader or a repair owner."
      },
      {
        "id": "D8",
        "statement": "Map application and persistence failures through one closed CLI taxonomy and serialize only per-command allowlisted DTOs; Task show omits body and cancellation reason, Project/status/doctor omit paths, and no output includes trusted actor/principal or raw exceptions.",
        "rationale": "Stable safe automation output and useful human output can share the same sanitized DTO rather than separate disclosure behavior."
      },
      {
        "id": "D9",
        "statement": "Extend the existing exact source/migration/package inventories and offline package smoke to invoke source, built, and installed CLIs against creator-owned runtimes, while retaining zero production dependencies and no release/support claim.",
        "rationale": "The packaged ato behavior is part of the Phase 1 product and must match the source contract exactly."
      }
    ],
    "milestone_recovery": [
      {
        "id": "M1",
        "recovery": "Keep the single plan in proposal if the predecessor, scope, authorization, Tier-2 outcome, or A0 readiness is uncertain; revise the approval contract and rerun fresh A0 rather than activating around a finding."
      },
      {
        "id": "M2",
        "recovery": "Stop before activation or keep the plan active with no completion claim if additive schema/legacy-upgrade/epoch atomicity cannot be proved; never edit earlier migrations or repair a real database."
      },
      {
        "id": "M3",
        "recovery": "Reject the affected command before runtime preparation when parser, actor, confirmation, output, or exit behavior is ambiguous; retain only disposable test fixtures and no fallback parser."
      },
      {
        "id": "M4",
        "recovery": "Remove or narrow any duplicate CLI judgment and route through the application owner; if a use case requires a new business outcome, revise approval and A0 rather than embedding it in the interface."
      },
      {
        "id": "M5",
        "recovery": "Before a restore intent, leave the current runtime and backup unchanged on failure; after an intent, preserve all evidence and report recovery-required. Doctor never repairs. No retained data is deleted."
      },
      {
        "id": "M6",
        "recovery": "Treat any source/build/pack/docs/status difference as a failed material gate, fix the single owner, and rerun the entire parity route without downloading or publishing."
      },
      {
        "id": "M7",
        "recovery": "Keep the task reserved and plan active on failed validation or review; repair only confirmed in-scope findings, refresh all affected material evidence, and obtain required A2 before completion."
      }
    ],
    "validation_bindings": [
      { "id": "V1", "state_binding": "material" },
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
      { "id": "V16", "state_binding": "approval" },
      { "id": "V17", "state_binding": "material" },
      { "id": "V18", "state_binding": "material" },
      { "id": "V19", "state_binding": "material" }
    ],
    "risk_controls": [
      {
        "id": "R1",
        "mitigation": "Closed command schemas, parser-before-runtime ordering, application parity/static dependency tests, output allowlists, secret/injection sentinels, and stable error mapping.",
        "recovery": "Reject the command and change the single CLI contract/mapper; do not emit raw fallback output or bypass the application service."
      },
      {
        "id": "R2",
        "mitigation": "OS-derived opaque actor, runtime identity binding, exact command confirmation, finite same-actor epoch schema, one application authorization owner, and negative expansion/replay/expiry tests.",
        "recovery": "Roll back the atomic application transaction or deny before it; never infer/grant authority from migration, content, or environment values."
      },
      {
        "id": "R3",
        "mitigation": "Immutable checksum assertions, additive 0004 inventory, real prefix upgrades, exact epoch/request/audit/provenance decode, failure/interruption tests, and explicit sqlite_schema exclusion of EP-02 objects.",
        "recovery": "Leave 0004 wholly absent or committed; restore only a verified pre-upgrade backup through the persistence owner and never edit history."
      },
      {
        "id": "R4",
        "mitigation": "Current grant/confirmation decision, store close, exact backup/application/schema binding, active-receipt refusal, primary CAS, durable restore intent, retained bytes, receipt, and terminal typed readback.",
        "recovery": "Before intent, report typed failure with unchanged primary; after intent, preserve topology and report RESTORE_RECOVERY_REQUIRED without rollback or cleanup."
      },
      {
        "id": "R5",
        "mitigation": "Separate no-create runtime inspector, read-only database handle, fixed report schema, physical before/after identity/byte/time comparison, and explicit absence of repair APIs.",
        "recovery": "Return a stable diagnostic code and leave every observed member untouched; an unreadable or ambiguous state stays unresolved."
      },
      {
        "id": "R6",
        "mitigation": "Exact source/migration/tar inventories, source-build-installed parity matrix, package consumer, restart E2E, docs/capability review, and offline full gate.",
        "recovery": "Fail the candidate and update the authoritative owner plus all projections before rerunning; do not publish or claim support."
      },
      {
        "id": "R7",
        "mitigation": "Schema-v3 material identity excludes moving plan lifecycle paths, V18 stops at pre-terminal eligibility, and authoritative coordinator state alone records prune/gates/ready/integration/push.",
        "recovery": "Keep the plan active and report the exact missing transition; never write future coordinator receipts into tracked evidence."
      }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "511f444f44d5404459875452f42b0055cc94785c",
      "current_material_base": "511f444f44d5404459875452f42b0055cc94785c",
      "base_transitions": []
    },
    "milestone_progress": [
      { "id": "M1", "status": "complete", "updated_at": "2026-08-30 08:42:39+08:00" },
      { "id": "M2", "status": "complete", "updated_at": "2026-08-30 08:42:39+08:00" },
      { "id": "M3", "status": "complete", "updated_at": "2026-08-30 08:42:39+08:00" },
      { "id": "M4", "status": "complete", "updated_at": "2026-08-30 08:42:39+08:00" },
      { "id": "M5", "status": "complete", "updated_at": "2026-08-30 08:42:39+08:00" },
      { "id": "M6", "status": "complete", "updated_at": "2026-08-30 08:42:39+08:00" },
      { "id": "M7", "status": "complete", "updated_at": "2026-08-30 10:29:10+08:00" }
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "terminal-resolve, historical scope, chain-check, Git base, and coordinator trace",
        "evidence": "The sole EP-01C terminal, task initial/current base, integration head, and remote-tracking head are all 511f444f44d5404459875452f42b0055cc94785c; terminal-resolve, historical scope, and chain-check returned ok=true with no error, warning, alternate predecessor, or later product dependency. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "ato.api/v1 contract, parser, fixed-error, and process-level negative tests",
        "evidence": "Contract tests exhaust all 24 command paths, exact option maps, confirmation and acknowledgement phrases, canonical JSON/human envelopes, list bounds, fixed public errors/exits, NO_OP nesting, and malformed/unknown/alias/overflow/control/injection rejection before runtime selection or creation. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "local identity, schema-v3 adoption, epoch renewal, authorization, failpoint, and security tests",
        "evidence": "OS/root-derived opaque identity, stable restart, one-time initialization/adoption, exact nineteen-grant epoch renewal, confirmed high-risk operations, revocation/expiry/scope/CAS checks, failpoint rollback, and content-self-authorization negatives passed without raw principal, actor, or path disclosure. A real child-process oracle proves HOME/USERPROFILE cannot redirect the OS-account-rooted authority path. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "CLI/application parity, Domain/registry regression, atomicity, and dependency-direction tests",
        "evidence": "Every Project, Task, dependency, grant, status, and exact-query route uses the typed application owner; Domain-only Project binding, accepted and denied audit shapes, illegal transition/cycle/cross-Project parent/duplicate/self edge/terminal/stale cases, and static no-second-business-owner checks passed atomically. Project mutation output is the safe application-owned terminal DTO and remains exact under a competing writer. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "migration registry, immutable-byte, fresh/prefix upgrade, schema-shape, rollback, and corruption tests",
        "evidence": "Migrations 0001/0002/0003 are byte-identical to EP-01C; registry 1/2/3/4, fresh and each shipped prefix upgrade, verified pre-upgrade backup, FK-on/foreign_key_check, mandatory NULL, rebuild rollback, checksum/history/fingerprint/newer-schema, lineage/provenance/count, and no-EP-02-object cases passed. The shared full schema-v3 application decoder rejects semantic corruption before backup, writable open, or migration. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "runtime ingress, ProjectRegistry, no-follow identity, overlap, and Windows reparse tests",
        "evidence": "Default and explicit runtime candidates remain under the OS-account-derived user-data root; relative/root/traversal/source/Project overlap, partial topology, alias/case/Unicode ambiguity, junction/reparse, identity substitution, unknown inventory, and unsafe environment input fail closed without target mutation or full-path output. The bounded Windows package-virtualization identity case is accepted only inside the same trusted OS home. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "manual-backup authorization, writer-barrier, failpoint, child-process interruption, route-matrix, and verification tests",
        "evidence": "Current runtime.backup handoff, sole initiating receipt, terminal writer recheck, schema-2 publication, caught failure cleanup, pre/post-rename process termination, lock-plus-receipt, receipt-only, safe-stage-only, normal retry, immutable generation, legacy/non-manual refusal, and exact byte/identity/time/inventory preservation matrices all passed. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "restore confirmation/authorization, sixteen-field handoff substitution, physical CAS, interruption, recovery, and restart tests",
        "evidence": "Missing or wrong confirmation/acknowledgement, revoked/expired/pre-adoption/mismatched authority, every lifecycle field substitution, stale/corrupt/legacy/pre-upgrade/wrong-application backup, active or ambiguous state, and physical CAS drift refuse before partial mutation. Backup inventory/generation inspection occurs only after exact application authorization, eliminating the unauthorized validity oracle; successful restore proves disclosed rollback, prior-primary retention, schema-2 intent/receipt, terminal typed readback, restart, and post-intent recovery-required semantics. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "doctor topology/schema/backup/restore classifier tests plus byte, identity, timestamp, and inventory snapshots",
        "evidence": "Absent, partial, unsafe, every schema prefix, Domain-only, pre-adoption, healthy, active lock/receipt, invalid stage/generation, pending/ambiguous restore, migration drift, newer schema, and corruption have exact closed projections. Doctor shares the full schema-v3 decoder and classifies semantic application corruption as state_corrupt, never upgradeable; recursive before/after evidence proves no create, repair, migration, delete, checkpoint, writable open, or sensitive output. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "separate-process source CLI end-to-end, backup/restore rollback, restart, and redaction tests",
        "evidence": "An empty runtime completed init, Project register/show, Task create/update/ready/show, dependency add/remove, status/query, backup, post-backup mutation, confirmed restore, and restart readback; durable data, authorization, audit, and backup facts matched while Task body, cancellation reason, full paths, actor, and raw errors remained absent. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "offline package smoke with source, dist, and isolated packed-installed console parity",
        "evidence": "Package smoke exited 0 with pnpm 11.19.0, frozen TypeScript 5.9.3, exactly 83 packed files, declarations/export/persistence, source-built-installed JSON/human/error/exit parity, uninstall, and creator-owned temporary cleanup all passed. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V12",
        "status": "passed",
        "method": "lint, strict typecheck/build, source/migration/package inventories, dependency shape, and package boundary tests",
        "evidence": "Lint accepted 140 repository files and 20 production sources; strict TypeScript typecheck/build passed; package and exact four-migration/source inventories passed with zero production dependencies and no interface import of raw SQLite/SQL, feasibility, vendor, network, EP-02, or undeclared built-in code. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V13",
        "status": "passed",
        "method": "complete Node suite, focused persistence suite, artifact hygiene, and real Windows SQLite feasibility",
        "evidence": "Complete tests passed 268/268 and focused persistence tests passed 90/90 with zero failure/skip/todo; artifact baselines remained 247->247. Domain property/state-machine, ProjectRegistry, authorization/application atomicity, FK/WAL/concurrency/CAS, migrations, restart/corruption, backup/restore/doctor, path security, all five A1 repair regressions, and absence of running/completed selection all passed. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V14",
        "status": "passed",
        "method": "docs-check, stale-capability search, owner/privacy review, migration-byte comparison, and git diff check",
        "evidence": "Docs accepted 67 Markdown files, 240 exact-case local links, and zero forbidden references; manual review confirmed sole CLI/API, authorization, schema/lifecycle/doctor, and error owners, truthful local Phase 1 capability, historical-only schema-v3 wording, no platform/release/EP-02 overclaim, unchanged 0001-0003 bytes, and a whitespace-clean diff. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V15",
        "status": "passed",
        "method": "network-disabled pnpm verify:offline exact-state repeat plus git diff --check",
        "evidence": "At exact repaired material state git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db, the complete composite route exited 0: lint 140/20, strict typecheck/build, tests 268/268 with artifact 247->247, docs 67/240/0, zero-production dependency check, 83-file package parity, full Windows SQLite matrix with zero surviving generation members, and blocked Codex evidence externalE2E=not_run/supportClaim=false; git diff --check passed. See validation-evidence.md.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V16",
        "status": "passed",
        "method": "fresh independent schema-v3 A0 attempt 12 and parent disposition before activation",
        "evidence": "Independent reviewer /root/ep01d_a0_four reproduced the exact 77,195-byte approval contract and FE62B860D545ED19C859679C3060F11FF00AC6DF25A8A39F3B32D2B2214BC725 digest at EP-01C terminal 511f444f44d5404459875452f42b0055cc94785c, found no issue, and parent disposition completed before active status; trace reported a0_ready=true with no error, warning, scope, overlap, dirty, base, or chain blocker.",
        "state_id": "approval-sha256:FE62B860D545ED19C859679C3060F11FF00AC6DF25A8A39F3B32D2B2214BC725"
      },
      {
        "id": "V17",
        "status": "passed",
        "method": "manual authorization and unsupported-route inventory",
        "evidence": "Validation evidence explicitly records online audit, hosted CI, real external E2E, non-Windows support, secrets/accounts, D:/quant/other repositories, PR/release/deployment, cleanup, EP-02, execution/backend/claim/dispatcher/scheduler/ports/adapters/workspace/MCP/plugin/external effects/network/telemetry/repair/ambiguous recovery as not run, unimplemented, unverified, or unauthorized, with no dependent claim or action.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V18",
        "status": "passed",
        "method": "fresh schema-v3 exact-state trace after A1 repairs, M1-M6, and current V1-V17 recording",
        "evidence": "Fresh JSON trace exited 0 with ok=true, errors=[], warnings=[], outside_scope=[], overlap=[], and pre_existing_dirty=[] at exact repaired material state git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db. It reproduced approval bytes 77,195, digest FE62B860D545ED19C859679C3060F11FF00AC6DF25A8A39F3B32D2B2214BC725, base 511f444f44d5404459875452f42b0055cc94785c, current A0/A1, all M1-M6 and V1-V17 terminal/current, and only the expected A2-required, V18/V19, M7, and final-summary blockers. Migrations 0001-0003 and completed plans/evidence are absent from material_paths; Git-flow holds the EP-01D final-review reservation without a tracked terminal-state claim.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      },
      {
        "id": "V19",
        "status": "passed",
        "method": "fresh independent A1 plus closure-safe A2 and parent completion disposition",
        "evidence": "Fresh independent A1 bound git-sha1:00d198c21e0109aaab41355226a75739a4364ade and identified two HIGH plus three MEDIUM findings. After all five repairs and current-state validation, fresh independent A2 reviewer /root/ep01d_a0_six reproduced git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db, the exact 77,195-byte approval digest, clean trace/scope/diff evidence, closed F-EP01D-A1-001 through F-EP01D-A1-005, and found no new HIGH or MEDIUM issue. Parent disposition accepts the closure-safe report; the pre-completion trace then had only V19, M7, and final_summary pending.",
        "state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/ep01d_a0_four",
        "independence": "Fresh independent read-only reviewer; no proposal or implementation authorship, file/Git/coordinator mutation, test execution, network access, or use of the implementation diff as A1 evidence.",
        "scope": "Complete 77,195-byte schema-v3 approval and execution contracts, repository guidance, A0/PLAN-SCHEMA/Tier-2 persistence rules, cited authoritative contracts, exact-base owners/tests for feasibility, predecessor terminal/scope/chain evidence, and all historical finding families including F-EP01D-A0-025 through F-EP01D-A0-027.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-30 07:12:38+08:00",
        "approval_sha256": "FE62B860D545ED19C859679C3060F11FF00AC6DF25A8A39F3B32D2B2214BC725",
        "evidence": "Fresh trace was exact at approval/current base and HEAD 511f444f44d5404459875452f42b0055cc94785c, material state git-sha1:bae71631168774e1173ffe58d48c986a79956616, errors/warnings/outside_scope/overlap/pre_existing_dirty all empty. Independent canonicalization reproduced 77,195 UTF-8 bytes and FE62B860D545ED19C859679C3060F11FF00AC6DF25A8A39F3B32D2B2214BC725; terminal-resolve, historical scope, and chain-check reproduced the unique EP-01C terminal. The Tier-2 owner walk confirmed exact isolated doctor/store/ordinary-CLI/backup/restore/primary-identity/low-level-read outcomes and residue preservation for lock-plus-initiating-receipt, receipt-only, and safe-stage-only topologies, with no cleanup, product bypass, EP-02 allocation, new permission, or external action. No finding was identified.",
        "parent_disposition": "complete",
        "findings": [],
        "reviewed_material_base": "511f444f44d5404459875452f42b0055cc94785c"
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/ep01d_a0_four",
        "independence": "Fresh independent read-only A1 reviewer; not the implementer. The reviewer made no file edits, Git/coordinator-state writes, test executions, network requests, authorization decisions, or external-state mutations.",
        "scope": "Complete EP-01D material diff at git-sha1:00d198c21e0109aaab41355226a75739a4364ade relative to the unique EP-01C terminal 511f444f44d5404459875452f42b0055cc94785c, including implementation, schema-v4 migration, lifecycle operations, CLI, package surface, tests, authoritative contracts, validation evidence, active ExecPlan, and the Tier-2 persistence lens.",
        "reviewed_at": "2026-08-30 09:05:56+08:00",
        "evidence": "Fresh trace returned ok=true with errors=[], warnings=[], outside_scope=[], overlap=[], and pre_existing_dirty=[] at exact material state git-sha1:00d198c21e0109aaab41355226a75739a4364ade. The reviewer independently reproduced the exact 77,195-byte approval digest FE62B860D545ED19C859679C3060F11FF00AC6DF25A8A39F3B32D2B2214BC725, reviewed the complete material diff and applicable contracts/lenses, and reported two HIGH plus three MEDIUM implementation findings.",
        "reviewed_state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-EP01D-A1-001",
            "severity": "HIGH",
            "summary": "The trusted application-data root used os.homedir(), which can be redirected by HOME or USERPROFILE and therefore lets untrusted environment content select the local authority root.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Derive the Windows owner home from the OS account record rather than environment-sensitive homedir resolution, remove environment-selected root fixtures, and add a real child-process negative oracle proving HOME/USERPROFILE cannot redirect trust.",
            "closure_evidence": "Local ingress now derives the trusted Windows home from os.userInfo().homedir, ignores environment-selected home/data roots, accepts only bounded OS package virtualization inside that same home, and passes a real child-process HOME/USERPROFILE redirection negative. Fresh independent A2 closed this finding at git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db.",
            "closure_state_id": null
          },
          {
            "id": "F-EP01D-A1-002",
            "severity": "HIGH",
            "summary": "Writable schema-v3 upgrade eligibility decoded only Domain state, allowing semantically corrupt application rows to be backed up and migrated before the combined application decoder rejected them; doctor could likewise misclassify them as upgrade-required.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Add one exact read-only schema-v3 application decoder shared by startup, doctor, and pre-upgrade eligibility; reject semantic corruption before writable open, backup, migration, or schema-byte change.",
            "closure_evidence": "Startup and doctor now share the exact released schema-v3 application decoder before any writable open, backup, or migration. Semantic-corruption tests prove exact database bytes/history/schema/inventory stay unchanged and doctor reports state_corrupt. Fresh independent A2 closed this finding at git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db.",
            "closure_state_id": null
          },
          {
            "id": "F-EP01D-A1-003",
            "severity": "MEDIUM",
            "summary": "The restore CLI verified a backup generation before the application owner evaluated current runtime.restore authority, exposing unauthorized generation existence and validity.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Evaluate and persist the bounded authorization handoff first, then let the persistence lifecycle owner verify the selected generation; unauthorized absent and corrupt generations must have the same AUTHORIZATION_DENIED public result as valid ones.",
            "closure_evidence": "Restore preflight defers backup inventory/generation inspection until the application owner has accepted runtime.restore and returned the exact handoff. Revoked, expired, and pre-adoption callers receive the same AUTHORIZATION_DENIED result for valid, absent, and corrupt generations. Fresh independent A2 closed this finding at git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db.",
            "closure_state_id": null
          },
          {
            "id": "F-EP01D-A1-004",
            "severity": "MEDIUM",
            "summary": "Lifecycle command output searched by operation and generation after inserting a new authorization, so a retry could return an older handoff with adverse lexical authorization-ID ordering.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Read back and return the exact newly allocated lifecycle authorization identity from the terminal transaction, never a non-unique operation/generation match, and add an adverse-order retry regression.",
            "closure_evidence": "Application lifecycle commands retain the newly allocated authorization ID and return only that exact terminal row; an adverse lexical-order same-generation retry regression passes. Fresh independent A2 closed this finding at git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db.",
            "closure_state_id": null
          },
          {
            "id": "F-EP01D-A1-005",
            "severity": "MEDIUM",
            "summary": "Project CLI mutations discarded the application result and performed a second unbound registry/Domain read to derive public fields, duplicating cross-owner interpretation and permitting concurrent output drift.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Have the application owner return the exact complete public Project projection from its terminal transaction and serialize that typed result directly in the CLI; prove the returned projection remains bound under a competing writer.",
            "closure_evidence": "The application terminal transaction now returns an allowlisted ProjectCommandResult DTO, the CLI serializes it directly, and a competing-writer regression proves the returned result cannot drift to later registry/Domain state. Fresh independent A2 closed this finding at git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "/root/ep01d_a0_six",
        "independence": "Fresh independent strictly read-only A2 reviewer; not the implementer and did not author the A1 findings or parent disposition. No tests, edits, Git/coordinator writes, network access, authorization decisions, or external actions were performed.",
        "scope": "Complete 52-path EP-01D task-owned material diff at git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db relative to unique EP-01C terminal 511f444f44d5404459875452f42b0055cc94785c, active ExecPlan and evidence, authoritative contracts, all five exact A1 repairs, adjacent authorization/persistence/recovery/concurrency/output/package boundaries, and the IMPLEMENTATION-AUDIT, PLAN-SCHEMA v3, and Tier-2 PERSISTENCE-AUDIT lenses.",
        "reviewed_at": "2026-08-30 10:25:36+08:00",
        "evidence": "Independent trace and canonicalization reproduced errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], exact material state git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db, EP-01C base/terminal 511f444f44d5404459875452f42b0055cc94785c, and the exact 77,195-byte approval digest FE62B860D545ED19C859679C3060F11FF00AC6DF25A8A39F3B32D2B2214BC725; git diff --check passed. Source, contract, and recorded regression review independently closed the OS-account root/environment boundary, shared pre-write schema-v3 decoder, authorization-before-generation restore ordering, exact lifecycle-ID readback, and transaction-bound application Project DTO. Adjacent no-follow, diagnostic read-only, sidecar/object identity, restore handoff/revalidation, schema relation, transaction/concurrency, public projection, and package export review found no new HIGH or MEDIUM issue. The reviewer inspected the recorded 268/268 complete, 90/90 persistence, and offline gate evidence without rerunning tests.",
        "reviewed_state_id": "git-sha1:d5a41c2b4045d591e4922501a7d28e29d82560db",
        "parent_disposition": "complete",
        "closes": ["F-EP01D-A1-001", "F-EP01D-A1-002", "F-EP01D-A1-003", "F-EP01D-A1-004", "F-EP01D-A1-005"],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-EP01D-A0-001", "F-EP01D-A0-002", "F-EP01D-A0-003", "F-EP01D-A0-004", "F-EP01D-A0-005", "F-EP01D-A0-006"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A0 at 2026-08-30 00:58:25+08:00 bound reviewed base 511f444f44d5404459875452f42b0055cc94785c, material state git-sha1:dd79bc4abd4f0b6b375093315676d5dee1b7200c, and approval digest 1792CE48F946EE8ADF410915C81763960E0FE97AD9A7C3A45D55C7A21D0816DE. The parent confirmed all six findings in scope: deferred public CLI envelope; incomplete action/epoch/backup/status/doctor authority; unspecified schema-v4 writer/reader closure; unbound restore decision handoff; mixed A0/A1/A2 validation binding; and omitted docs/README.md scope. C16-C22 now freeze the exact public surface, authority, epoch, schema, and lifecycle handoff; V16/V19 split approval/material evidence; docs/README.md is in scope; fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-EP01D-A0-001", "F-EP01D-A0-002", "F-EP01D-A0-003", "F-EP01D-A0-007", "F-EP01D-A0-008"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A0 at 2026-08-30 01:24:40+08:00 bound reviewed base 511f444f44d5404459875452f42b0055cc94785c, material state git-sha1:dd79bc4abd4f0b6b375093315676d5dee1b7200c, canonical bytes 46354, and approval digest A0DBFE786B30707909341C26A9541D2DC089B152A61FBB419E812E42766FC4DA. The parent confirmed all five current findings: underdetermined public serialization/error/list semantics, renewal recreating live revoked root authority, incomplete exact schema-v4/rebuild closure, backup publication without a writer-serialized terminal authorization check and exact schema-2 artifacts, and circular V18/V19 terminal ordering. C16-C26 now freeze those semantics, C20 preserves live partial revocation and requires renewal beyond seven days, C21/C25 close DDL/rebuild/digest relations, C22/C26 serialize and bind publication, and V18/V19 are acyclic. Attempt-one F-004/F-005/F-006 remain closed; fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": ["F-EP01D-A0-009", "F-EP01D-A0-010", "F-EP01D-A0-011", "F-EP01D-A0-012", "F-EP01D-A0-013", "F-EP01D-A0-014", "F-EP01D-A0-015"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A0 at 2026-08-30 01:50:36+08:00 bound reviewed base 511f444f44d5404459875452f42b0055cc94785c, material state git-sha1:dd79bc4abd4f0b6b375093315676d5dee1b7200c, canonical bytes 57654, and approval digest B4B33D51AF7DB6D3C9FFD3FD6BD85AA6B007AED56E3CA454705CFA7873D16F6B. The parent confirmed all seven findings. C21/C25 replace the impossible live-revision composite relation with stable grant identity plus exact issue-time and post-revocation historical semantics; C21 makes bootstrap one-way; C17/C24/V2 uniquely map list bounds and move source-expiry authority to the application transaction; C22/C26 distinguish backup generation allocation from restore selection and freeze the lifecycle hash projection; C22/C27/V7 close pre/post-rename backup publication outcomes; C23/V9 freeze older/current-uninitialized doctor projections. Fresh A0 is required because these approval changes invalidate attempt three."
      },
      {
        "audit": "A0",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": ["F-EP01D-A0-016", "F-EP01D-A0-017", "F-EP01D-A0-018", "F-EP01D-A0-019", "F-EP01D-A0-020"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A0 at 2026-08-30 02:18:14+08:00 bound base/material 511f444f44d5404459875452f42b0055cc94785c, state git-sha1:dd79bc4abd4f0b6b375093315676d5dee1b7200c, canonical bytes 63728, and approval digest 84B22964148DDBFD1562E940C80C6EC420BC450A4CD0EC40E2BECA84659BA0F1. The parent confirmed one HIGH and four MEDIUM findings. C4/C5/C20/C21/C25/C28 now freeze OS-derived identity and one-time non-attesting legacy adoption; C24/V2 map nested NO_OP only to DOMAIN_REJECTED; C27/V7 define retained pre-rename crash residue and blocked retry; C23/C29/V4/V9 define valid Domain-only upgrade/init/root binding; C21/C28/V5 make every mandatory column explicitly NOT NULL with negative SQL tests. Fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 5,
        "report_status": "complete",
        "finding_ids": ["F-EP01D-A0-021", "F-EP01D-A0-022", "F-EP01D-A0-023", "F-EP01D-A0-024"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A0 at 2026-08-30 02:40:14+08:00 bound base/material 511f444f44d5404459875452f42b0055cc94785c, state git-sha1:dd79bc4abd4f0b6b375093315676d5dee1b7200c, canonical bytes 70666, and approval digest B4D1A8F6445AA7E598F5CB4BA97B0EE93410682C6642339EEE2821B2C5FD1D7A. The parent confirmed two HIGH and two MEDIUM findings. C30/V3/V9 freeze the migrated-bootstrap pre-adoption doctor and command matrix; C31/V3 freezes renewal request/allow-no-grant decision/audit/epoch cardinality; C4/V3 freezes fresh trusted_principal equal to principalSha256 while preserving legacy bytes; C32/V5 makes identity STRICT WITHOUT ROWID and the explicit-NULL oracle feasible. Fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 6,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A0 at 2026-08-30 02:55:09+08:00 bound base/material 511f444f44d5404459875452f42b0055cc94785c, state git-sha1:dd79bc4abd4f0b6b375093315676d5dee1b7200c, canonical bytes 74001, and approval digest 1C15167402316DF0BD0E5D6C956524155F0CC4625856E99650F51D5AD8776C5F. The reviewer found zero findings and the parent completed disposition. During implementation, fresh trace then proved that the approved scope omitted the existing database and persistence-error owner files required by the already approved doctor zero-write and typed lifecycle failure outcomes. The parent reopened A0, added only those two repository paths without changing the product, authorization, persistence, external-action, or validation outcome, and requires fresh independent A0 before reactivation."
      },
      {
        "audit": "A0",
        "attempt": 7,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A0 at 2026-08-30 05:30:47+08:00 bound exact base 511f444f44d5404459875452f42b0055cc94785c, material state git-sha1:167d92d3e2266bf7729732a330aeb4712945702b, canonical bytes 74105, and approval digest 0331FA065CC86A3C1187947B74CD802708762D43F3C8D4F991E7948993B213B4. The reviewer found zero findings and the parent completed disposition. Before implementing the required real child-process backup interruption matrix, the parent proved an approval contradiction: authoritative persistence lifecycle semantics retain an undeletable crash-stale lifecycle.lock, so C23 precedence requires runtime_active/LIFECYCLE_BUSY while C27/V7 incorrectly required backup_invalid/BACKUP_INVALID for the same real crash. C27/V7 now state the exact combined lock/stage topology and separate no-lock stage projection; fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 8,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A0 at 2026-08-30 05:54:42+08:00 bound exact base 511f444f44d5404459875452f42b0055cc94785c, material state git-sha1:d3504c5b72b98e2321d3786bc16837f0ab965e3a, canonical bytes 74862, and approval digest 65862F18502AA61F54BA1ABD927BE316F593E1EBBFE7304573145100B2A6E411. The reviewer found zero findings and the parent completed disposition. Real child-process validation then proved one remaining approval contradiction with the authoritative lifecycle contract: normal PersistenceStore open also acquires lifecycle.lock and therefore fails LIFECYCLE_BUSY on crash residue. C27/V7 now preserve that fail-closed open behavior and limit readable-primary evidence to the existing persistence-owned low-level diagnostic test path; fresh A0 was required."
      },
      {
        "audit": "A0",
        "attempt": 9,
        "report_status": "complete",
        "finding_ids": ["F-EP01D-A0-025"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A0 at 2026-08-30 06:28:15+08:00 bound exact base 511f444f44d5404459875452f42b0055cc94785c, material state git-sha1:bae71631168774e1173ffe58d48c986a79956616, canonical bytes 75210, and approval digest 7B68826144BC9F7C0F148C9CA4A8107B364BAE7C0F6F2D6EFC75F948ABFB0B16. The parent confirmed MEDIUM F-EP01D-A0-025: a manual-backup process kill necessarily retains the initiating store's connection receipt in addition to lock and stage/generation, and receipt-only/no-lock precedence was not frozen. C27/V7 now enumerate lock-plus-receipt and receipt-only topologies, require an empty receipt inventory for the safe-stage-only oracle, preserve exact C23/C24 precedence, and forbid product cleanup; fresh A0 was required."
      },
      {
        "audit": "A0",
        "attempt": 10,
        "report_status": "complete",
        "finding_ids": ["F-EP01D-A0-026"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A0 at 2026-08-30 06:43:16+08:00 bound exact base 511f444f44d5404459875452f42b0055cc94785c, material state git-sha1:bae71631168774e1173ffe58d48c986a79956616, canonical bytes 76227, and approval digest 80F53FB546923261EC520FC685578B356B45D78DF5409617073FC4D85AF066B3. The parent confirmed MEDIUM F-EP01D-A0-026: safe-stage/no-lock/empty-receipt semantics omitted normal current-schema open and primary-identity outcomes. C27/V7 now bind owner-consistent successful open/normal close and successful primary identity in isolated fixtures, with exact stage preservation and no cleanup/bypass; fresh A0 was required."
      },
      {
        "audit": "A0",
        "attempt": 11,
        "report_status": "complete",
        "finding_ids": ["F-EP01D-A0-027"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A0 at 2026-08-30 06:58:32+08:00 bound exact base 511f444f44d5404459875452f42b0055cc94785c, material state git-sha1:bae71631168774e1173ffe58d48c986a79956616, canonical bytes 76780, and approval digest 5F9703A7378116580FE3A1EF2F1CABBFC24D9FE5C39FB2326B6593F5331C2158. The parent confirmed MEDIUM F-EP01D-A0-027: receipt-only/no-lock ordinary non-lifecycle CLI behavior and the full lock-plus-receipt preservation oracle were still implicit. C27/V7 now enumerate doctor, store, ordinary CLI, backup, restore, identity, and low-level read where applicable for each topology, bind exact typed/public outcomes, isolate routes, and require exact terminal residue bytes/identity/timestamps/inventory preservation; fresh independent A0 is required."
      }
    ],
    "validation_attempts": [
      { "validation_id": "V1", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The strict predecessor result remained true, but its pre-A1 material binding was superseded by the five confirmed implementation repairs and current exact-state repeat.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V2", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The pre-A1 CLI contract result preceded the environment-root and restore-oracle negative regressions and was rerun at the repaired state.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V3", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The pre-A1 identity and authorization result used an environment-redirectable home resolver and lacked the post-authorization restore-oracle matrix; current evidence replaces it.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V4", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The pre-A1 application-parity result preceded exact lifecycle-ID readback and the transaction-bound Project result DTO with competing-writer regression.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V5", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The pre-A1 migration result did not fully decode semantic schema-v3 application state before backup/writable migration; the repaired decoder and corruption oracle were rerun.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V6", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The pre-A1 runtime-root result trusted environment-sensitive home resolution; the OS-account-rooted ingress, bounded package-virtualization rule, and child-process redirection oracle replace it.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V7", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The pre-A1 backup result was material-bound before the shared schema-v3 decoder and trusted-root repair; the complete persistence matrix was rerun.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V8", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The pre-A1 restore result inspected generation validity before application authorization; the reordered flow and valid/absent/corrupt unauthorized matrix replace it.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V9", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The pre-A1 doctor result could classify semantically corrupt schema-v3 application state as upgradeable; shared-decoder no-write evidence replaces it.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V10", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The pre-A1 process workflow passed but was material-bound before trusted-root, restore-ordering, and application-output repairs; the complete route was rerun.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V11", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The pre-A1 source/build/installed parity result was stale after CLI and persistence source/test changes; package smoke was rerun with the exact 83-file inventory.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V12", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The pre-A1 code/package result was stale after source, contract, and regression changes; lint, typecheck, build, dependency, and package routes were rerun.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V13", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The accepted 263-test and 88-test persistence results preceded five A1 regressions; the current 268-test and 90-test routes replace them.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V14", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The pre-A1 documentation and owner review preceded the trusted-root, decode-before-migrate, authorization-order, and terminal-result contract repairs; current docs evidence replaces it.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V15", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The complete pre-A1 offline route passed 263 tests but became stale after confirmed A1 repairs; the exact repaired-state route passes 268 tests.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V17", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "Unsupported-route truthfulness remained unchanged but its material evidence record was updated for the A1 repairs and current validation status.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" },
      { "validation_id": "V18", "attempt": 1, "classification": "superseded", "at": "2026-08-30 10:03:01+08:00", "evidence": "The clean pre-A1 trace bound the original review candidate; confirmed HIGH/MEDIUM repairs necessarily invalidated that material binding and require a fresh pre-A2 exact-state trace.", "state_id": "git-sha1:00d198c21e0109aaab41355226a75739a4364ade" }
    ],
    "contract_revisions": [
      {
        "at": "2026-08-30 01:12:28+08:00",
        "summary": "Closed all six A0 attempt-one findings by approval-binding the exact CLI/API surface, complete finite authority and epoch transition, concrete schema-v4 writer/reader allocation, durable backup/restore authorization handoff, split A0 versus A1/A2 lifecycle validation, and documentation navigation scope.",
        "previous_approval_sha256": "1792CE48F946EE8ADF410915C81763960E0FE97AD9A7C3A45D55C7A21D0816DE"
      },
      {
        "at": "2026-08-30 01:30:25+08:00",
        "summary": "Closed A0 attempt-two findings by freezing the complete public value/serialization/error mapper, non-superseding current-origin renewal semantics, exact schema-v4 relations and FK-safe rebuild, writer-serialized backup publication with closed schema-2 artifacts, and an acyclic V18-before-A1-before-V19 completion sequence.",
        "previous_approval_sha256": "A0DBFE786B30707909341C26A9541D2DC089B152A61FBB419E812E42766FC4DA"
      },
      {
        "at": "2026-08-30 02:00:42+08:00",
        "summary": "Closed A0 attempt-three findings by making lifecycle authorization reference stable grant identity with exact historical revision semantics, separating bootstrap from ordinary grant issuance, disambiguating list-limit and delegated-expiry failures, freezing lifecycle hash and generation ownership, completing backup rename terminal behavior, and defining every legacy/current-uninitialized doctor projection.",
        "previous_approval_sha256": "B4B33D51AF7DB6D3C9FFD3FD6BD85AA6B007AED56E3CA454705CFA7873D16F6B"
      },
      {
        "at": "2026-08-30 02:27:51+08:00",
        "summary": "Closed A0 attempt-four findings by freezing versioned OS identity derivation and one-time legacy adoption, unique Domain NO_OP mapping, retained pre-rename crash residue, valid Domain-only upgrade/init/root binding, and literal NOT NULL/key/FK semantics for all three new relations.",
        "previous_approval_sha256": "84B22964148DDBFD1562E940C80C6EC420BC450A4CD0EC40E2BECA84659BA0F1"
      },
      {
        "at": "2026-08-30 02:45:00+08:00",
        "summary": "Closed A0 attempt-five findings with a complete pre-adoption public state/command table, renewal-specific allow-without-grant relation, exact fresh trusted_principal digest binding, and STRICT WITHOUT ROWID singleton semantics.",
        "previous_approval_sha256": "B4D1A8F6445AA7E598F5CB4BA97B0EE93410682C6642339EEE2821B2C5FD1D7A"
      },
      {
        "at": "2026-08-30 05:21:07+08:00",
        "summary": "Corrected the task-owned scope manifest to include the existing SQLite connection-policy owner and persistence-error taxonomy owner required by the already approved no-write doctor and lifecycle authorization outcomes; no product, authorization, persistence, external-action, or validation boundary changed.",
        "previous_approval_sha256": "1C15167402316DF0BD0E5D6C956524155F0CC4625856E99650F51D5AD8776C5F"
      },
      {
        "at": "2026-08-30 05:46:03+08:00",
        "summary": "Resolved the real backup process-termination contradiction by applying the existing lifecycle-lock crash-residue rule and C23 precedence to combined lock/stage and post-rename topology, while retaining separate no-lock stage invalidity, no automatic cleanup/recovery, readable primary data, and exact fail-closed retries.",
        "previous_approval_sha256": "0331FA065CC86A3C1187947B74CD802708762D43F3C8D4F991E7948993B213B4"
      },
      {
        "at": "2026-08-30 06:17:19+08:00",
        "summary": "Aligned backup crash-residue readback with the authoritative lifecycle contract: normal store and CLI open remain LIFECYCLE_BUSY because connection-receipt creation owns lifecycle.lock, while only the existing persistence-owned low-level test path proves unchanged primary bytes readable without creating a product bypass.",
        "previous_approval_sha256": "65862F18502AA61F54BA1ABD927BE316F593E1EBBFE7304573145100B2A6E411"
      },
      {
        "at": "2026-08-30 06:29:24+08:00",
        "summary": "Closed F-EP01D-A0-025 by adding the initiating store connection receipt to every manual-backup kill topology, freezing receipt-only/no-lock active-use precedence, requiring an empty receipt inventory for safe-stage-only invalidity, and preserving owner-only no-cleanup behavior.",
        "previous_approval_sha256": "7B68826144BC9F7C0F148C9CA4A8107B364BAE7C0F6F2D6EFC75F948ABFB0B16"
      },
      {
        "at": "2026-08-30 06:44:35+08:00",
        "summary": "Closed F-EP01D-A0-026 by binding normal current-schema open/close and primary-identity success in isolated safe-stage/no-lock/empty-receipt fixtures while requiring exact stage preservation and no product cleanup or bypass.",
        "previous_approval_sha256": "80F53FB546923261EC520FC685578B356B45D78DF5409617073FC4D85AF066B3"
      },
      {
        "at": "2026-08-30 07:00:41+08:00",
        "summary": "Closed F-EP01D-A0-027 with isolated complete route matrices for lock-plus-receipt, receipt-only, and safe-stage-only residues, including ordinary CLI outcomes and exact byte/identity/timestamp/inventory preservation after every route.",
        "previous_approval_sha256": "5F9703A7378116580FE3A1EF2F1CABBFC24D9FE5C39FB2326B6593F5331C2158"
      }
    ],
    "final_summary": "EP-01D completes the local Phase 1 product surface: one strict versioned ato CLI reuses the typed application owner for finite local authorization and Project/Task/dependency work, while persistence-owned backup, explicitly confirmed restore, and read-only doctor remain fail-closed and restart-readable. Schema v4 is additive, earlier migration bytes and EP-02 remain untouched, source/build/packed behavior converges, all exact-state offline gates pass, and independent A1/A2 closure is complete without expanding external authority or support claims."
  }
}
```

## Context

EP-01C delivered schema-v3 ProjectRegistry, finite single-user runtime grants,
the typed application service, and persistence lifecycle primitives, but the
`ato` binary still prints only capability status. EP-01D turns those existing
owners into the local Phase 1 product surface and closes that phase without
creating an execution runtime.
