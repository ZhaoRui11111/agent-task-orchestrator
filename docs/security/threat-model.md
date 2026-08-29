# Threat model

## Status and scope

This file is the sole owner of security assets, actors, trust boundaries, abuse
cases, mitigations, residual risks, negative-test obligations, and explicit
security non-claims for the planned local-first orchestrator. The repository
implements the Phase 1 persistence and local task-management subset: validated
runtime and Project roots, identity-bound lifecycle/connection files, strict
typed schema-v3 SQLite ingress, one-time runtime-root-bound bootstrap, finite
revision-aware grants, typed application commands/queries, narrowing policy,
separate high-risk confirmation, append-only decisions/audit, and verified
backup/restore recovery. It still has no product CLI, execution runtime, MCP
server, adapter, scheduler, workspace control, external-effect protocol, team
identity/RBAC, or supported platform security boundary.

The model assumes one local operator and treats repository content, Task text,
prompts, adapter responses, tool output, filesystem entries, Git metadata, MCP
input, and external services as untrusted. It does not convert design controls
into a support claim.

## Assets

- Task/Project state, revisions, hierarchy, dependencies, and audit history.
- SQLite database, WAL/SHM state, migrations, backups, manifests, intents,
  receipts, leases, fencing tokens, gates, and authorization grants.
- Source repositories, Git refs, workspaces/worktrees, unpublished stages, and
  external repository/service state.
- Prompts, Task bodies, source content, personal data, credentials, tokens,
  environment values, and configuration.
- Adapter, scheduler, MCP, CLI, diagnostic, and policy identities and versions.
- Operational logs, diagnostic bundles, compatibility evidence, and the user's
  authorization decisions.

## Actors

- The local human operator and explicitly delegated local services.
- Core processes, dispatcher workers, schedulers, and configured adapters.
- A legitimate MCP/CLI client, which is still untrusted until schema and
  authorization checks pass.
- Malicious or compromised repository content, Task/prompt content, dependency,
  tool, plugin, adapter, MCP client, external API, or remote repository actor.
- Another local process, including a stale worker or same-user process able to
  race files or database state.
- Operating-system administrator or hardware attacker, which is outside the
  isolation guarantee stated below.

## Trust boundaries

1. Human/CLI/MCP input crossing into typed application ingress.
2. Untrusted Project, prompt, source, Git, and tool output crossing into core or
   an execution backend.
3. Core crossing the SQLite repository/transaction boundary.
4. Dispatcher crossing execution, workspace, policy, completion, scheduler, and
   external service adapters.
5. Trusted runtime/workspace roots crossing filesystem path, link, junction,
   mount, and reparse boundaries.
6. Durable intent/lease state crossing process death, retry, takeover, and
   publication boundaries.
7. Scheduler or operating-system trigger delivery crossing into a dispatcher
   run.
8. Structured operational data crossing into logs, diagnostics, display, or an
   external disclosure destination.

## Abuse cases and required mitigations

| ID | Abuse case | Required mitigation | Residual risk |
| --- | --- | --- | --- |
| T1 | Traversal, symlink/junction/reparse substitution, case/normalization ambiguity, or path-swap race escapes a managed root or targets user data. | For the implemented runtime root, use the absolute/non-root/non-overlap, no-follow identity, owner-derived descendant, inventory, and refusal rules in the [persistence contract](../reference/persistence-contract.md#runtime-root-and-path-ownership). ProjectRegistry separately requires an absolute normalized local directory, no alias/reparse component, no runtime overlap, a canonical device/inode/mode receipt, final pre-transaction filesystem revalidation, and in-transaction receipt/revision comparison without writing the target. Future managed workspaces use the stronger rules in the [completion/workspace contract](../reference/completion-workspace-contract.md). Reject the operation when the applicable owner cannot prove the path. | Same-user replacement between checks, platform reparse semantics, privileged mutation, and process-memory compromise can exceed application-level containment; no Windows ACL or platform-support claim is made. |
| T2 | Prompt, Task, repository, issue, tool output, or adapter response injects instructions to reveal data, broaden scope, or perform a tool/external mutation. | Treat content as data; route every structured command through schema ingress and the [authorization envelope](../reference/authorization-contract.md); expose only narrow versioned ports; never treat model text as a grant, receipt, or policy decision. | A chosen execution backend may still produce unsafe suggestions or modify files inside its already authorized workspace. |
| T3 | A timeout/crash causes duplicate, fabricated, or destructively rolled-back external mutation. | Persist semantic intent before effects; independently observe and verify receipts; fence stale workers; CAS finalization; retain actual partial success and ambiguity under the [reliability protocol](../reference/reliability-protocol.md). | Some external systems cannot provide authoritative inspection or idempotency; those operations remain ambiguous and need human resolution. |
| T4 | Secrets are stored in Tasks, database rows, prompts, receipts, command lines, logs, diagnostics, or error bodies. | Apply the [privacy and logging contract](privacy-and-logging.md): external credential references, least disclosure, secret-value omission, fail-closed redaction, and separately authorized backend disclosure. | A secret deliberately included in source/prompt content may reach the configured backend; best-effort pattern detection cannot find every secret. |
| T5 | Logs or diagnostic bundles disclose personal data, source paths/content, prompts, external identifiers, or credentials. | Current application audit uses only fixed allowlisted metadata and omits Task bodies and Project paths under the [privacy contract](privacy-and-logging.md). Future operational logs/diagnostics require pre-sink redaction from the [observability contract](../reference/observability-contract.md), authorization for read/export, a disclosed bundle manifest, and default no telemetry. | Stable actor, correlation, target IDs, timing, counts, and operator-approved future bundles can still be sensitive metadata. |
| T6 | SQLite corruption, disabled foreign keys, forged migration history, stale/partial backup, concurrent writer, or newer-schema access causes silent state loss or false completion. | Enforce the [persistence contract](../reference/persistence-contract.md): verified connection settings, one application product ingress, bounded transactions, immutable migration checksums, backup-before-upgrade, combined typed decoding, integrity checks, read-only failure, and restore to a private generation. | SQLite/OS/hardware defects and loss of every valid backup can make recovery impossible. |
| T7 | Duplicate/missed scheduler triggers or worker death duplicates execution, skips reconciliation, or loses candidate outcomes. | Require the [scheduler contract](../reference/scheduler-contract.md) reconcile-first sequence and the reliability claim/fence/idempotency/fan-out records. Treat delivery as at least once. | Extended scheduler outage delays work; it does not provide availability or deadlines. |
| T8 | MCP exposes arbitrary shell, SQL, filesystem, cleanup, or external actions; malformed/oversized input bypasses application rules. | Offer only narrow versioned command schemas; validate size/type/version server-side; call the same application/authorization owners as CLI; omit arbitrary shell/SQL/filesystem endpoints; require distinct grants for destructive/external actions. | A vulnerable MCP host/plugin or compromised local account is outside the narrow server's application checks. |
| T9 | A stale lease holder, replayed receipt, or stale gate writes after takeover or HEAD/policy change. | Bind fencing token, Task/resource revision, policy/config revision, workspace generation, and HEAD to every mutation; reject stale values before write; use the [gate freshness owner](../reference/completion-workspace-contract.md#gate-identity-and-freshness). | External effects already performed by an old worker may still require reconciliation. |
| T10 | A policy adapter, dependency, or external API changes behavior/version without detection. | Use exact port/version negotiation, policy revision binding, evidence-bound support claims, and incompatibility errors from the [adapter](../reference/adapter-contracts.md) and [versioning](../reference/versioning-compatibility-contract.md) owners. | A correctly versioned but compromised dependency can still act maliciously within granted OS permissions. |

## Negative-test obligations

An implementation cannot close its security route until automated tests
produce binary evidence for every applicable row.

The current Phase 1 implementation covers the runtime-root and ProjectRegistry
portions of N1, the local content/authorization portion of N3, the application
audit subset of N4, and the schema-v3 SQLite/application portions of N5 and
N11. Workspace, operational-logger, external-effect, scheduler, MCP,
completion, and adapter portions remain future obligations; passing Phase 1
tests cannot satisfy them.

| ID | Required negative test | Passing outcome |
| --- | --- | --- |
| N1 | Traversal, absolute/root target, case/Unicode ambiguity, symlink, junction, mount/reparse ancestor, special ownership marker, and path-swap race during create/inspect/cleanup | No mutation outside the exact owned generation; ambiguous/unsupported inspection refuses the operation. |
| N2 | Unowned, stale-generation, dirty, modified, untracked, ignored, active-lease, active-reservation, or partial-publication workspace cleanup | Cleanup is refused and unrelated data remains byte-identical. |
| N3 | Prompt/repository/tool text asks to reveal a secret, ignore policy, invoke an unavailable tool, mutate another scope, or claim success | Text never creates a structured grant/intent/receipt; unauthorized mutation is absent and the refusal is observable. |
| N4 | Secret-shaped and known sentinel values appear in prompt, environment, URL, adapter error, command output, and nested attributes | Sentinel value is absent from structured logs and default diagnostics; redaction failure emits only the minimal safe event. |
| N5 | Foreign keys disabled, busy writer, corrupt/truncated database, broken row JSON, migration checksum mismatch, failed/interrupted migration, invalid backup, and newer-schema database | No normal mutation or false terminal result; failure is typed, database remains recoverable/read-only, and only a verified backup may publish. |
| N6 | Crash before/after intent, effect, observation, verification, finalization, and publication CAS; late old-fence write | Restart reconciles without duplicate verified effect; old writes fail; unresolved state becomes explicit waiting/ambiguity. |
| N7 | Duplicate simultaneous triggers, missed intervals, clock/config change, and worker kill in each run phase | Reconciliation precedes new claims, at most one valid claim exists per Task, and every candidate/old run has an observable outcome. |
| N8 | Malformed, unknown-version, overlong, nested, unauthorized, and injection-bearing MCP request; request for arbitrary shell/SQL/filesystem operation | Ingress rejects before mutation; excluded endpoints do not exist; stable redacted error/correlation evidence is produced. |
| N9 | Replay pass receipt after Task, fence, workspace generation, HEAD, policy, gate version, or validity time changes | Completion/integration rejects it as stale and dependency remains locked. |
| N10 | Timeout, lost adapter response, changed remote ref, or incompatible adapter/API version | No blind retry or support claim; authoritative inspection determines success/absence, otherwise state is ambiguous or incompatible. |
| N11 | Missing/false trusted bootstrap confirmation; second bootstrap; wrong actor/action/scope/revision; not-yet-valid, expired, or revoked grant; attempted authority expansion; disabled Project policy; replayed request/decision; Project/Task text that claims authority | No unauthorized Project/Task/dependency/grant mutation; bounded denials are atomic and sanitized; content never changes actor, action, policy, confirmation, or grant state. |

Test fixtures are untrusted and disposable. Fake/contract tests may prove local
logic but cannot satisfy a real platform/API support row.

## Residual risks

- The application is not a security boundary against an operating-system
  administrator, kernel compromise, debugger, or malicious process with the
  same user's unrestricted credentials.
- Executing untrusted code can affect resources already available to its process;
  this design is orchestration, not a sandbox.
- Local database and backups can be lost together through hardware failure,
  ransomware, or operator deletion.
- External providers control their own storage, availability, authentication,
  and retention after an authorized request crosses that boundary.
- Redaction and prompt-injection mitigations reduce exposure but cannot prove
  arbitrary content harmless.
- Filesystem race defenses depend on verified host primitives; an unvalidated
  platform remains unsupported.

## Explicit non-claims

The implemented controls are limited to the Phase 1 local boundaries named
above. This model does not claim release readiness, multi-user isolation, RBAC,
cloud security, remote availability, arbitrary-code sandboxing, malware
detection, perfect secret/PII detection, guaranteed rollback of external
effects, automatic safe cleanup, supported MCP exposure, or support for any
platform/API absent validated compatibility evidence.
