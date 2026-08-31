# RC01 A1 attempt 1

Parent disposition: confirmed in scope. The approval contract was reopened
because the finding identifies an unsatisfiable pre-commit/post-commit
artifact-lifecycle boundary. The report is preserved exactly below; the
current plan requires fresh A0 and fresh A1 after the contract revision.

```json
{
  "report_status": "complete",
  "reviewer": "Codex independent reviewer /root/rc01_a0_path_fix",
  "independence": "Fresh read-only A1; reviewer did not implement or repair RC01 and made no repository, file, Git/index/ref, coordinator, runtime, permission, network, or external-state mutation.",
  "scope": "Exact stable RC01 material state: active schema-v3 ExecPlan, all 56 staged task-owned paths and complete diff from c95de33b104282292a0cd9203e66e5a1112cb3bd, validation evidence, repository guidance, persistence/authorization/reliability/CLI/versioning/adapter and adjacent contracts, the sole current baseline, migration/store/application-repository/backup/doctor/application read-write boundaries, direct tests and packed consumers, preserved A0 history, and current registered task-artifact inventory.",
  "reviewed_at": "2026-08-31 20:28:29+08:00",
  "evidence": "The exactly-once read-only exec_plan trace exited 0 and matched approval SHA-256 4C7EB0416F6FF8BDB0FCA17418D3ECE2D46EA915F884D78B7C6B45E89EB04285, material base/HEAD c95de33b104282292a0cd9203e66e5a1112cb3bd, and reviewed state git-sha1:4ff5e58c1a2ad7df1c97468413826d8582044982, with errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], unstaged=[], and untracked=[]. The staged inventory has 56 task-owned paths and git diff --cached --check passed. The sole baseline's independently computed SHA-256 is EF756403D6D03EF73208326B0234991CBC4189372121474E6AD97C11BA70F6BD. Review confirmed one registry/file/history row at schema version 1; pre-existing empty and incompatible nonempty primaries are inspected/refused before writable open; historical readers, prefix migration, adoption, versioned authorization tables, grant-link tables, and lifecycle digest fallbacks are absent from live source/current documentation except negative or preserved historical references. Bootstrap remains vocabulary 4, separately confirmed upgrades remain contiguous 4-to-5-to-6-to-7, all epochs/grants use the single current relations, and lifecycle authorization reads/writes only digest version 4. Current application transactions, authorization/audit atomicity, execution claim/lease/fence, Manual intent/observation/receipt/finalization, dispatcher completeness, and single-writer boundaries remain represented in the combined decoder and unchanged owners. BackupManifest V1/V2 and RestoreIntent/Receipt V1/V2 remain operational while current startup no longer creates pre-upgrade backup; ato.execution/v1 has no staged diff. Direct test and package consumers consistently expect schema version 1, including the corrected installed-package assertion. The supplied final validation report records verify:offline passing lint 192/28, typecheck/build, 412/412 tests, docs 97/252/21/0, zero production dependencies, 112-file package smoke, SQLite schema-1/0 survivor, and Codex blocked/unclaimed. One independent validation-lifecycle finding remains: ignored artifacts are outside trace's untracked inventory but materially present.",
  "reviewed_state_id": "git-sha1:4ff5e58c1a2ad7df1c97468413826d8582044982",
  "parent_disposition": "pending",
  "closes": [],
  "findings": [
    {
      "id": "F-RC01-A1-001",
      "severity": "MEDIUM",
      "summary": "V10 requires every registered .task-artifacts root to be absent before the sole result commit, but the stable state contains preserved failed-run artifacts and the approved lifecycle permits their terminal coordinator prune only after that commit, making the completion gate unsatisfiable.",
      "confirmed": true,
      "in_scope": true,
      "changes_task_diff": true,
      "disposition": "a2_required",
      "resolution": "Reconcile M4, V10, R6, validation evidence, and the single-result-commit authorization so artifact absence has one achievable and truthful lifecycle point. Either establish explicit safe pre-commit removal authority and terminal absence evidence, or move root absence to the post-result-commit coordinator prune receipt without marking material-bound V10 passed beforehand. Because the latter changes the approval/execution contract, recompute the approval digest and obtain fresh A0 and fresh A1 before completion.",
      "closure_evidence": "Pending parent confirmation and contract repair. Current read-only inspection found .task-artifacts present and ignored with three concurrency-upgrade-receipt-* directories, 42 recursive entries, six files, and 2,302,425 bytes. validation-evidence.md lines 64-67 says these diagnostics remain preserved until the post-result-commit coordinator prune; active-plan M4 lines 188-190 and V10 lines 249-252 require pre-commit absence, while R6 lines 367-369 permits only post-commit prune.",
      "closure_state_id": null
    }
  ]
}
```
