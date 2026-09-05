# EP-03F A0 audit — attempt 4

```json
{
  "report_status": "complete",
  "reviewer": "Codex /root/ep03d_a0",
  "independence": {
    "fresh": true,
    "independent": true,
    "read_only": true,
    "statement": "Reviewer did not draft, revise, implement, or repair EP-03F revisions 1-3. Historical A0 attempts were read only as evidence; the current conclusion was independently reconstructed from revision 3, repository authorities, predecessor plans, applicable contracts, and current source."
  },
  "scope": {
    "plan": "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md",
    "audit": "A0 attempt 4",
    "mode": "fresh independent non-fail-fast Tier-2 activation-readiness audit",
    "reviewed": [
      "AGENTS.md, ARCHITECTURE.md, and docs/README.md",
      "harness-exec-plan SKILL.md, PLAN-SCHEMA.md, A0-AUDIT.md, and PERSISTENCE-AUDIT.md",
      "complete current EP-03F approval and execution contracts",
      "EP-03F A0 attempts 1-3",
      "completed EP-03D and EP-03E plans",
      "authorization, reliability, persistence, workspace, adapter, scheduler, CLI, versioning, privacy, threat-model, validation, toolchain, and contract-ownership authorities",
      "relevant current product-runtime, execution-loop, dispatcher, workspace, authorization, Codex backend/worker, repository model/decoder/SQL, digest, backup, and package-boundary source"
    ],
    "not_performed": [
      "No file edit or artifact creation",
      "No Git/index/coordinator/dependency mutation",
      "No build or test",
      "No network, credential, real Codex account, SDK turn, or external-project access"
    ]
  },
  "readiness": "revision_required",
  "reviewed_at": "2026-09-05T02:10:48+08:00",
  "approval_sha256": "A38FA9F0626EAA77E3BA969C5BFB5B78790A04009F6BAF2682269EC59EFB772C",
  "approval_contract_bytes": 49242,
  "reviewed_material_base": "c78b07e9c70f86fcec19feb40c4f2149b82e366a",
  "reviewed_head": "c78b07e9c70f86fcec19feb40c4f2149b82e366a",
  "reviewed_state_id": "git-sha1:59a2e6ebb26d9437fd00901bcd21582e9469b53a",
  "trace": {
    "runs": 1,
    "ok": true,
    "exit_code": 0,
    "errors": [],
    "warnings": [
      "W_PREFLIGHT_A0_CONVERGENCE"
    ],
    "approval_contract_bytes": 49242,
    "approval_contract_sha256": "A38FA9F0626EAA77E3BA969C5BFB5B78790A04009F6BAF2682269EC59EFB772C",
    "material_base": "c78b07e9c70f86fcec19feb40c4f2149b82e366a",
    "head": "c78b07e9c70f86fcec19feb40c4f2149b82e366a",
    "state_id": "git-sha1:59a2e6ebb26d9437fd00901bcd21582e9469b53a",
    "outside_scope": [],
    "overlap": [],
    "pre_existing_dirty": [],
    "material_paths": [
      "docs/plans/evidence/EP-03F/a0-attempt-1.md",
      "docs/plans/evidence/EP-03F/a0-attempt-2.md",
      "docs/plans/evidence/EP-03F/a0-attempt-3.md"
    ],
    "assessment": "The convergence warning is advisory and does not conceal a trace error or scope blocker. Attempts 1-3 show progressively narrower repairs, and revision 3 closes F005/F006. The current independent audit nevertheless identifies one remaining source-backed recovery-contract gap, so activation is not ready."
  },
  "historical_finding_closure": [
    {
      "id": "F-A0-EP03F-001",
      "status": "closed",
      "evidence": "AGENTS.md is now in task scope, permitting required synchronization of highest-authority current-state claims."
    },
    {
      "id": "F-A0-EP03F-002",
      "status": "closed",
      "evidence": "C12 and C15-C16 freeze the four-path API/CLI delta, conditional continuation confirmation, bounds, ordered results, and four exact public errors; V14 supplies binary acceptance."
    },
    {
      "id": "F-A0-EP03F-003",
      "status": "closed",
      "evidence": "C17 limits its claim to exact product-supplied constructor inputs, explicitly places administrator-managed layers and the installed runtime in the TCB, and retains externalE2E=not_run and supportClaim=false."
    },
    {
      "id": "F-A0-EP03F-004",
      "status": "closed",
      "evidence": "C7, C9, C18, D4, and D9 allocate each initial or successor execution before workspace creation through a fresh direct dispatcher member, preserving ato.workspace/v2 member.executionId equality without rebinding."
    },
    {
      "id": "F-A0-EP03F-005",
      "status": "closed",
      "evidence": "C5, C7, C9, C13, C18, D4, D6, V4-V6, V9, and V11 now require T5 to create the exact pending intent first. T6 then persists fresh Codex and execution Act evidence, a new confirmation, bindingRevision+1, the sole-consumer link, and pending-to-executing/effect_possible CAS in one transaction. T6 denial leaves the intent pending with immutable history; post-T6 response loss is inspect/reconcile-only."
    },
    {
      "id": "F-A0-EP03F-006",
      "status": "closed",
      "evidence": "C18 separates stage from lifecycle, limits refused to pre-T4 without a claimed member or execution, makes recovery_required nonterminal and summary-blocking, and unconditionally requires the claimed member's exact finalized product operation, finalized intent, reconciled ambiguity, and final workspace inspection. M2 resumes the last durable pre-effect stage through existing idempotent owners; V11 makes the terminal matrix decoder-enforced."
    }
  ],
  "evidence": [
    {
      "kind": "canonicalization",
      "result": "A duplicate-key-rejecting JSON parse followed by recursively sorted-key compact UTF-8 serialization independently produced exactly 49242 bytes and SHA-256 A38FA9F0626EAA77E3BA969C5BFB5B78790A04009F6BAF2682269EC59EFB772C."
    },
    {
      "kind": "authorization_and_effect_order",
      "paths": [
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:61",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:71",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:81",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:101",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:126"
      ],
      "result": "The revised T5/T6 ordering is source-backed, binary, and implementable through the existing execution owner without an unconsumed Act."
    },
    {
      "kind": "lifecycle_and_summary",
      "paths": [
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:126",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:311",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:323",
        "src/dispatcher-application.ts:1754",
        "src/dispatcher-application.ts:1759",
        "src/dispatcher-application.ts:1771"
      ],
      "result": "Revision 3 removes the former missing-intent summary bypass and defines refusal and recovery terminality consistently with the existing dispatcher summary owner."
    },
    {
      "kind": "versions_and_fresh_replacement",
      "paths": [
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:51",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:91",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:269",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:323",
        "src/authorization.ts:91",
        "src/authorization.ts:123",
        "src/persistence/application-repository-digest.ts:9"
      ],
      "result": "The proposal consistently advances authorization v7/50 to v8/55 and application-state digest v3 to v4 while retaining fresh schema-version 1, exact backup/decoder replacement, and no compatibility reader."
    },
    {
      "kind": "security_and_external_boundary",
      "result": "The profile, fixed destination, allowlisted credential reference, final-boundary secret resolution, one-key environment, redaction, administrator TCB, no real account/network authorization, and false support claim are consistently bounded. No adjacent scheduler composition, Phase-3 CLI family, or external authority was introduced."
    },
    {
      "kind": "recovery_identity",
      "paths": [
        "docs/reference/reliability-protocol.md:64",
        "docs/reference/reliability-protocol.md:69",
        "src/product-runtime.ts:517",
        "src/product-runtime.ts:522",
        "src/product-runtime.ts:527",
        "src/execution-loop.ts:3134",
        "src/execution-loop.ts:3152",
        "src/execution-loop.ts:3167",
        "src/execution-loop.ts:3209",
        "src/execution-loop.ts:3227",
        "src/execution-loop.ts:3244"
      ],
      "result": "Current reliable owners parse first, then locate an existing operation by idempotency identity and compare its stored semantic tuple before ordinary live-revision binding. This ordering is necessary because an accepted operation itself can advance the live revisions named by the original command."
    }
  ],
  "parent_disposition": "pending",
  "findings": [
    {
      "id": "F-A0-EP03F-007",
      "severity": "HIGH",
      "classification": "contract_gap",
      "title": "Product-operation recovery is not bound to an idempotency-first public-command lookup",
      "path": [
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:111",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:126",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:287",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:311",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:392"
      ],
      "impact": "T4 changes the Task revision and, for continuation, supersedes the source execution while allocating a successor. A crash after T4 but before T5 therefore leaves a durable CodexProductOperationRecord but no execution intent. Replaying the same original codex.dispatch-run or execution.resume/retry command will carry the pre-T4 public revisions. If the facade performs its ordinary current Task/execution readiness validation first, it returns STALE_REVISION and can never reach the recorded operation, stranding the running Task, claimed member, execution, and possibly workspace. If an implementation instead weakens validation without an authoritative stored original tuple, the same idempotency key can be confused with a different command or semantic member.",
      "evidence": [
        "C18 enumerates immutable operation/profile/configuration/T1 and planned sub-operation IDs, but does not require the product record to store the public idempotency key and complete original public semantic tuple, nor define their uniqueness.",
        "C18, V5, V9, and M2 say repeated commands or restart use the recorded stage and preallocated IDs, but do not define lookup before ordinary live-ready/CAS validation or the exact conflict rule for the same key with a different original tuple.",
        "For initial start, T4 changes Task revision n to n+1. For continuation, T4 additionally supersedes the command's source execution and allocates a new fence. Thus the original command is expected to be stale against live state after its own accepted T4.",
        "Before T5 there is no execution intent, so the existing execution-loop idempotency lookup cannot recover this boundary.",
        "The authoritative reliability protocol requires the stored semantic tuple to remain authoritative and be compared before reuse. Current product-runtime.ts:517-529 and execution-loop.ts:3134-3160,3209-3246 implement that source-backed pattern by locating the durable idempotency record before normal live binding."
      ],
      "required_resolution": "Within the existing Codex product owner, freeze the product operation's exact public idempotency identity and authoritative original public semantic command tuple. After hostile-shape parsing, a repeated start/resume/retry must look up that operation before ordinary current Task/execution/profile readiness validation. An exact tuple match must resume only its recorded stage and preallocated IDs while still obtaining all stage-applicable current authorization and confirmation; the same key with any different tuple must return the existing conflict class. Add binary failpoint cases for identical original commands after T4, workspace readiness, and T5, plus a same-key/different-tuple case, proving no second run, member, execution, workspace, intent, or SDK invocation."
    }
  ]
}
```
