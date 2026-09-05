# EP-03F A0 audit — attempt 3

```json
{
  "report_status": "complete",
  "reviewer": "Codex /root/ep03d_a0_2",
  "independence": {
    "fresh": true,
    "independent": true,
    "read_only": true,
    "statement": "Reviewer did not participate in EP-03F drafting, revisions, implementation, or prior A0 attempts. Prior reports were read only as historical evidence; all current conclusions were independently reconstructed from the current contract, authorities, source, completed predecessor plans, and official documentation."
  },
  "scope": {
    "plan": "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md",
    "audit": "A0 attempt 3",
    "mode": "non-fail-fast activation-readiness",
    "reviewed": [
      "AGENTS.md",
      "ARCHITECTURE.md",
      "harness-exec-plan SKILL.md",
      "PLAN-SCHEMA.md",
      "A0-AUDIT.md",
      "PERSISTENCE-AUDIT.md",
      "complete current EP-03F proposal",
      "EP-03F A0 attempts 1 and 2",
      "completed EP-03D and EP-03E plans and terminal allocations",
      "authorization, reliability, persistence, CLI, adapter, privacy, threat-model, versioning, validation and toolchain contracts",
      "current dispatcher, workspace, execution, Codex, persistence model/decoder and SQL implementation",
      "current Codex feasibility records and pinned lockfile identity",
      "official OpenAI Codex SDK, App Server, config-precedence and managed-configuration documentation"
    ],
    "not_performed": [
      "No file, Git/index, coordinator, dependency, credential, account, Codex, App Server, build, test, or external-project mutation",
      "No real credential read and no real SDK call",
      "No build or test command"
    ]
  },
  "reviewed_at": "2026-09-05T01:50:39+08:00",
  "approval_contract": {
    "canonicalization": "Duplicate-key-rejecting JSON parse; recursively sorted object keys; compact UTF-8 JSON",
    "bytes": 45181,
    "sha256": "278FC42AA8F4284BF40428F3D95BB22B5D2AFDAFB2CC8EB0EF8641D3AC82C2CE"
  },
  "reviewed_material_base": "c78b07e9c70f86fcec19feb40c4f2149b82e366a",
  "reviewed_head": "c78b07e9c70f86fcec19feb40c4f2149b82e366a",
  "reviewed_state_id": "git-sha1:2a5c9f4d4a1980ce2808dcc8ab0949f66a26fbc0",
  "trace": {
    "command": "python C:\\Users\\Administrator\\.codex\\skills\\harness-exec-plan\\scripts\\exec_plan.py trace --repo D:\\agent-task-orchestrator\\.worktrees\\ep-03f --plan docs/plans/proposals/EP-03F-authorized-codex-product-composition.md --json",
    "runs": 1,
    "ok": true,
    "exit_code": 0,
    "approval_contract_bytes": 45181,
    "approval_contract_sha256": "278FC42AA8F4284BF40428F3D95BB22B5D2AFDAFB2CC8EB0EF8641D3AC82C2CE",
    "material_base": "c78b07e9c70f86fcec19feb40c4f2149b82e366a",
    "head": "c78b07e9c70f86fcec19feb40c4f2149b82e366a",
    "errors": [],
    "warnings": [
      "W_PREFLIGHT_A0_CONVERGENCE: two earlier finding-bearing A0 attempts"
    ],
    "outside_scope": [],
    "overlap": [],
    "pre_existing_dirty": []
  },
  "historical_finding_closure": [
    {
      "id": "F-A0-EP03F-001",
      "status": "closed",
      "evidence": "AGENTS.md is now explicitly task-owned, allowing required current-state authority synchronization."
    },
    {
      "id": "F-A0-EP03F-002",
      "status": "closed",
      "evidence": "C12 and C15-C16 freeze the four command paths, conditional continuation confirmation, bounds, ordered result projections and exact four-error delta; V14 provides binary parser/source/build/installed acceptance."
    },
    {
      "id": "F-A0-EP03F-003",
      "status": "closed",
      "evidence": "C17 now proves only the product-supplied constructor tuple, explicitly treats the OS administrator, installed runtime and managed layers as TCB, denies any effective post-managed attestation or endpoint/no-hook guarantee, and keeps externalE2E=not_run/supportClaim=false. This matches official documentation that managed defaults override local/CLI values, managed requirements may select compatible fallback values, and managed hooks may execute."
    },
    {
      "id": "F-A0-EP03F-004",
      "status": "closed",
      "evidence": "C7, C9 and C18 now allocate every initial or continuation execution in atomic T4 before workspace creation, bind it to a fresh direct dispatcher member owned by the pre-existing product operation, and preserve unchanged ato.workspace/v2 member.executionId==command.executionId equality. This removes the earlier descendant/synthetic-member/rebinding cycle."
    }
  ],
  "evidence": [
    {
      "kind": "canonicalization",
      "result": "Independent result exactly matched 45181 bytes and the expected digest."
    },
    {
      "kind": "official_documentation",
      "sources": [
        "[OpenAI managed configuration](https://learn.chatgpt.com/docs/enterprise/managed-configuration)",
        "[OpenAI config precedence](https://learn.chatgpt.com/docs/config-file/config-basic)",
        "[OpenAI Codex SDK](https://developers.openai.com/codex/sdk)",
        "[OpenAI Codex App Server](https://developers.openai.com/codex/app-server)"
      ],
      "result": "Official managed-configuration behavior supports C17's narrowed TCB/non-attestation claim. App Server remains a distinct excluded surface."
    },
    {
      "kind": "authorization_protocol",
      "paths": [
        "docs/reference/reliability-protocol.md:69",
        "docs/reference/reliability-protocol.md:263",
        "docs/reference/authorization-contract.md:447",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:60",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:126",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:381"
      ],
      "result": "Current authority requires a fresh Act bound to one exact existing intent immediately before invocation; prior bindings are immutable history."
    },
    {
      "kind": "summary_protocol",
      "paths": [
        "src/dispatcher-application.ts:1774",
        "src/persistence/application-repository-state.ts:3968",
        "migrations/0001-current-baseline.sql:1792",
        "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:126"
      ],
      "result": "Current claimed-member summary publication requires the same execution intent finalized. Current status derivation treats an otherwise successful claimed member as completed. C18's proposed conditional intent requirement therefore needs an exact replacement lifecycle rule."
    },
    {
      "kind": "package_evidence_limit",
      "result": "The current worktree lockfile and committed feasibility record bind @openai/codex-sdk 0.153.2, but that package was not present in the available node_modules cache for a fresh declaration/implementation reinspection. No installation or network access was attempted. V10/V16 correctly retain exact package inspection as a later material-state gate."
    }
  ],
  "readiness": "revision_required",
  "findings": [
    {
      "id": "F-A0-EP03F-005",
      "severity": "HIGH",
      "classification": "authorization_and_recovery_contract_gap",
      "path": "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:126",
      "impact": "C18 commits T5 Act as act_allowed in one transaction and creates the execution intent only afterward. A crash at that boundary leaves no exact intent consumer for the Act. Restart is told to resume the recorded stage, but the contract does not say that the old T5 is history-only, how a replacement Act/confirmation is obtained and CAS-bound, or how exactly one Act is consumed by the preallocated intent. Reusing act_allowed could disclose the credential or Task bytes and invoke the SDK after profile, grant, fence or workspace drift; blindly creating another binding would leave an undefined authorization chain.",
      "source": [
        "C5 forbids a prior effect decision from becoming replay authority.",
        "D6 requires Act to be current, non-reusable and immediately before the SDK call.",
        "The authoritative reliability protocol requires the intent to exist first and the fresh Act to CAS-bind that exact intent as its one consumer.",
        "V9 names the crash boundary but asserts replay safety without defining the missing consumption transition."
      ],
      "required_resolution": "Freeze one exact existing-owner ordering and recovery rule. Preferably, after workspace_ready the execution owner creates the preallocated pending intent, then T5 atomically CAS-binds a fresh Act to that exact intent and moves it effect-possible immediately before SDK access. If T5 remains before intent creation, explicitly make every unconsumed T5 historical-only after interruption and require a new current Act/confirmation binding atomically consumed by exact intent creation before any credential value, Task bytes or SDK access. Define decision IDs, binding revision, legal stage transitions and idempotent replay behavior. Add failpoint cases for crash after T5/before intent plus profile deactivation/revision change, grant revocation/expiry, fence/workspace drift and confirmation failure, requiring zero credential resolution, Task disclosure and SDK calls."
    },
    {
      "id": "F-A0-EP03F-006",
      "severity": "HIGH",
      "classification": "persistence_lifecycle_and_summary_truthfulness_gap",
      "path": "docs/plans/proposals/EP-03F-authorized-codex-product-composition.md:126",
      "impact": "C18 allows a run summary when the product operation is merely described as terminal and requires the planned execution intent to be finalized only if it exists. It never defines which of finalized, refused and recovery_required are terminal or the Task/execution/member disposition when T4 has already made the Task running and the member claimed but T5, credential availability or pre-intent recovery refuses. Under the current dispatcher status derivation, such a claimed member can produce terminalStatus=completed; alternatively the active execution is stranded without an intent that existing reconciliation can finalize. Treating recovery_required as terminal would also convert unresolved ambiguity into a completed run.",
      "source": [
        "C7/C9 allocate the running Task, execution and claimed member during T4 before T5 and intent creation.",
        "C18's phrase 'if the planned execution intent exists' removes the current unconditional finalized-intent summary guard.",
        "Current SQL and combined decoder require every claimed member's exact execution intent to exist and be finalized before summary publication.",
        "Current dispatcher terminal-status logic classifies an otherwise successful claimed-only run as completed.",
        "R3 explicitly recognizes the stranded-running-Task/claimed-member risk, but its mitigation does not define these no-intent terminal cases."
      ],
      "required_resolution": "Freeze the complete C18 transition and terminal-state matrix. recovery_required must be nonterminal and summary-blocking. A post-T4 operation with no execution intent must not publish a successful/complete summary or become an unrecoverable refused terminal; either it remains explicitly recoverable at the exact stage or the existing execution/dispatcher/Domain owners perform a precisely defined durable no-effect disposition before summary. For a claimed Codex member, require the exact product operation to be finalized and the exact preallocated execution intent to exist and be finalized; remove the 'if exists' bypass unless a separately specified non-success member/run and Task/execution disposition is defined. Specify pre-effect refusal versus effect-possible ambiguity, historical/deactivated-profile reconciliation, terminal status/count mapping, SQL/decoder invariants and failpoint tests for T4-to-T5 denial, credential unavailable, crash before intent, refused and recovery_required."
    }
  ],
  "finding_summary": {
    "HIGH": 2,
    "MEDIUM": 0,
    "LOW": 0,
    "total": 2
  },
  "parent_disposition": {
    "recommendation": "revise_contract_and_repeat_fresh_a0",
    "activation": "do_not_activate",
    "reason": "The historical C17 TCB and direct workspace-owner roots are closed, but the new C18 ordering still lacks a one-consumer Act boundary and truthful no-intent terminal/summary recovery semantics."
  }
}
```
