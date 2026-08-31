# EP-02D A0 attempt 2

- Report status: `complete`
- Readiness: `revision_required`
- Reviewer: `/root/ep02d_a0`
- Reviewed at: `2026-08-31 10:46:58+08:00`
- Approval SHA-256: `DE2A9EE06BB1345546004DFCB1B1DBC34DE47A64DEDB8DCD4C4B3A6A3B738D63`
- Reviewed material base: `0700d65e9c0db78626aa31baa56f15f009fef41e`
- Parent disposition: `confirmed_and_superseded`

## Independence

Fresh independent read-only A0. The reviewer did not draft EP-02D or participate in its substantive design decisions, rebuilt the assessment from current repository evidence, and made no file, Git, ExecPlan, coordinator, permission, network, artifact, or external-state mutation.

## Scope and evidence

The reviewer examined the complete schema-v3 EP-02D proposal; `AGENTS.md`; `ARCHITECTURE.md`; `docs/plans/README.md`; the `harness-exec-plan` skill, A0 guidance, and schema guidance; and the applicable CLI, authorization, versioning, persistence, reliability, adapter, scheduler, observability, privacy, threat, toolchain, validation, Domain, contract-ownership, and Git-flow contracts. The reviewer independently computed the canonical approval bytes as 34,060 bytes and reproduced the approval digest above.

Fresh trace reported `ok=true`, no errors or warnings, proposal status, exact base and HEAD, empty outside-scope/overlap/pre-existing-dirty inventories, and `next_action=run_a0`. `HEAD`, `master`, and `origin/master` all resolved to `0700d65e9c0db78626aa31baa56f15f009fef41e`; the branch was `task/ep-02d`; and only the proposal plus preserved attempt-1 evidence were untracked and task-owned. `terminal-resolve` uniquely selected the EP-02C terminal commit, and `chain-check` matched the EP-02D base. Source inspection confirmed the current 19+4+6+1 finite grantable-action vocabulary and the actual reliable-loop and dispatcher error enums. No tests ran because A0 remained read-only and artifact-free.

Commands included `exec_plan.py trace`, `terminal-resolve`, `chain-check`, an independent canonical SHA-256 computation, `git rev-parse`, `git status`, `git merge-base`, and targeted read-only `rg`/`Get-Content` inspection of action vocabulary, the public error table, and both internal error enums.

## Finding

### F-EP02D-A0-003 — MEDIUM contract gap

`approval_contract.constraints.C19` described Reliable-loop and Dispatcher `INVALID_INPUT` as mapping to a same-named public code. The frozen v2 public table inherits v1, whose input code is `CLI_INVALID_INPUT`, and adds only seven specifically named codes; it never defines a public `INVALID_INPUT`. The supposedly exhaustive mapping was therefore internally contradictory and could not be implemented or exhaustively tested as approved.

The parent independently confirmed the finding. The minimal closure is to map both internal `INVALID_INPUT` values to public `CLI_INVALID_INPUT`, retain all other mappings unchanged, record the approval revision and prior digest, reset current A0, and obtain a fresh independent A0 before activation.

No other finding was reported.
