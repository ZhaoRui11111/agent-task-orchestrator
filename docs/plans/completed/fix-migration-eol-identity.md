# ExecPlan：修复迁移换行与身份可复现性

本计划修复同一 Git 提交在 LF 与 CRLF checkout 中产生不同迁移身份的问题；四个既有迁移的规范 checksum、schema 和 SQL 语义保持不变。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-30 11:15:21+08:00",
    "updated_at": "2026-08-30 11:49:02+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "User explicitly instructed the primary thread to execute the migration line-ending identity fix",
        "at": "2026-08-30 11:03:00+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "The current user instruction plus the repository Git-flow contract authorize the task commit, FF-only integration, and standing ordinary origin/master push",
        "at": "2026-08-30 11:03:00+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Make the released schema-v1 through schema-v4 migration registry produce the same documented migration SQL, checksums, registry identity, and schema behavior from a clean LF or CRLF checkout; preserve every existing migration Git blob and canonical checksum; restore the current Windows master checkout to a passing migration and complete offline validation state; and document the single canonicalization owner without changing product behavior.",
    "non_goals": [
      "Do not edit migrations/0001 through migrations/0004, append migration 0005, change schema allocation, SQL semantics, schema fingerprints, application data, CLI behavior, or authorization behavior.",
      "Do not rewrite or silently repair persisted migration history, accept an unknown stored checksum or registry identity, or claim compatibility for a database created with an undocumented transport-derived identity.",
      "Do not add a dependency, release, support claim, adapter, dispatcher, scheduler, MCP component, execution runtime, network behavior, or external-project mutation.",
      "Do not modify the installed harness skills, coordinator state by hand, completed historical plans, or EP-01D validation evidence."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "The four released migration canonical checksums remain exactly E31C5A3D24E4DB99620635A9CE83F752978C5FD2AF7A15C84CE13BEECAC9C34F, 0FC2DEECBC8ABBA31F9E5063A870706320F66C5AEE882E4A05DA0CADCF9CEC7E, 58D428B10198B7483ECB6CED2F88D8DA81A97B052CF650ED4CD012D7183F0702, and 3446455B4A49C2339EC22E6B99FFF5DD43908D0BEB45EFCE099A79D732CF6557; versions 1-3 use their historically recorded CRLF byte representation and version 4 its historically recorded LF representation; all four Git blobs remain unchanged.",
        "source": "docs/reference/persistence-contract.md migration identity; current executable checksum assertion; independent base-byte and LF/CRLF worktree recomputation"
      },
      {
        "id": "C2",
        "statement": "The persistence migration registry is the sole runtime canonicalization owner. It accepts only a complete uniform LF or complete uniform CRLF transport of the exact logical migration lines, reconstructs the migration's declared canonical representation before hashing and execution, and rejects BOM, empty input, missing terminal newline, mixed or lone carriage returns, content drift, and checksum mismatch before any SQLite mutation.",
        "source": "docs/reference/persistence-contract.md migration identity and atomicity; Tier-2 persistence audit identity and pre-mutation fail-closed lens"
      },
      {
        "id": "C3",
        "statement": ".gitattributes declares the exact historical checkout EOL for each shipped migration file rather than a wildcard that could silently assign a future migration identity. Future migrations must add their own reviewed registry identity and matching attribute entry.",
        "source": "docs/reference/toolchain-contract.md frozen source/package boundary; repository single-owner and capability-truthfulness rules"
      },
      {
        "id": "C4",
        "statement": "Existing databases whose history contains the four documented canonical checksums remain readable under the same typed decoder. Any other stored checksum or registry identity remains MIGRATION_CHECKSUM_MISMATCH or MIGRATION_HISTORY_MISMATCH with no metadata rewrite or fallback identity.",
        "source": "docs/reference/persistence-contract.md corruption and non-claims; docs/reference/versioning-compatibility-contract.md forward migration policy"
      },
      {
        "id": "C5",
        "statement": "Source, build, packed installation, tests, backup verification, doctor, and writable startup consume the same canonical registry descriptors; no interface, test helper, package step, or documentation example becomes a second production identity owner.",
        "source": "ARCHITECTURE.md dependency constraints; docs/reference/toolchain-contract.md package boundary; docs/reference/persistence-contract.md writer and reader closure"
      },
      {
        "id": "C6",
        "statement": "All edits occur only in task/fix-migration-eol-identity at .worktrees/fix-migration-eol-identity. Coordinator state uses fresh CAS tokens, final review follows reservation, exact-head receipts follow the task commit and explicit artifact prune, integration is FF-only, and push is ordinary non-force.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md; coordinator start receipt"
      },
      {
        "id": "C7",
        "statement": "Fresh independent A0 is required before activation, fresh independent A1 is required after the stable material diff, and every confirmed in-scope HIGH or MEDIUM repair requires fresh independent A2.",
        "source": "docs/plans/README.md; harness-exec-plan audit contracts"
      }
    ],
    "authorization": {
      "allowed": [
        "Read and edit only the declared task-owned paths in the coordinator-owned task worktree.",
        "Run local targeted migration, configuration, typecheck, build, package, documentation, and full offline validation without dependency repair, secrets, or external-project mutation.",
        "Use independent read-only reviewers for A0, A1, and any required A2.",
        "Stage only task-owned paths, create one terminal task commit containing the completed plan, invoke the repository-authorized pathless prune-artifacts transition, record exact-head gates, integrate FF-only, and invoke the standing-authorized ordinary non-force push to origin/master."
      ],
      "requires_reapproval": [
        "Any migration SQL or Git-blob change, new schema version, stored-history repair or rewrite, additional accepted checksum, public/API/data/security behavior change, new dependency, broader task path, or external path.",
        "Any network action other than the repository standing-authorized final origin/master push, secret/account access, pull request, release, deployment, coordinator cleanup, force, rebase, reset, stash, clean, or another repository mutation."
      ],
      "prohibited": [
        "Editing production files in the integration-only master checkout, hand-writing coordinator state or gate receipts, or mutating an existing runtime database to conceal the identity defect.",
        "Changing migrations/0001 through migrations/0004, accepting arbitrary newline/content transformations, weakening corruption refusal, or rewriting historical evidence.",
        "Running coordinator cleanup, force operations, PR, release, deployment, arbitrary network use, or mutation outside this repository."
      ],
      "persistence": {
        "required": true,
        "action": "Create one terminal task commit containing the completed plan and exact migration-identity repair, obtain the current-head artifact-prune and gate receipts, integrate FF-only, and ordinarily push origin/master without cleanup.",
        "source": "Current user instruction and repository local Git-flow standing push contract"
      }
    },
    "scope": {
      "task_paths": [
        {"path": ".gitattributes", "kind": "file"},
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "docs/plans/active/fix-migration-eol-identity.md", "kind": "file"},
        {"path": "docs/plans/completed/fix-migration-eol-identity.md", "kind": "file"},
        {"path": "docs/plans/proposal/fix-migration-eol-identity.md", "kind": "file"},
        {"path": "docs/reference/persistence-contract.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "docs/reference/validation-policy.md", "kind": "file"},
        {"path": "src/persistence/migrations.ts", "kind": "file"},
        {"path": "test/configuration.test.mjs", "kind": "file"},
        {"path": "test/persistence-schema-migrations.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "The schema-v3 plan freezes the existing checksums, per-file canonical line endings, no-history-repair boundary, exact task scope, Tier-2 recovery rules, binary gates, and fresh independent A0 activation evidence.",
        "validation_ids": ["V1"]
      },
      {
        "id": "M2",
        "outcome": "The migration registry reconstructs and verifies one immutable canonical descriptor set from either exact LF or CRLF checkout transport, .gitattributes makes clean checkouts deterministic, and tests prove all accepted and rejected transport cases without editing migration blobs.",
        "validation_ids": ["V2", "V3"]
      },
      {
        "id": "M3",
        "outcome": "Contracts and changelog truthfully describe the repaired identity boundary, targeted and complete validation pass at one material state, and fresh independent A1 plus any required A2 close before the completed plan and implementation enter one task commit.",
        "validation_ids": ["V1", "V2", "V3", "V4", "V5"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "ExecPlan lifecycle, exact scope, independent reviews, evidence freshness, and terminal persistence",
        "criterion": "exec_plan.py trace exits 0 with schema v3, no error, warning, outside-scope path, stale audit, failed validation, or completion blocker; A0/A1 and any required A2 are fresh and independent; all milestones and validation results are terminal before archival."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Released migration Git blobs, canonical checksums, line endings, and registry identity",
        "criterion": "Git proves migrations/0001 through 0004 have the exact base blob OIDs; targeted tests prove the four canonical checksums and declared CRLF/CRLF/CRLF/LF representations are unchanged and yield one registry identity and schema fingerprint from both complete LF and complete CRLF source transports."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Pre-mutation canonicalization and corruption refusal",
        "criterion": "Targeted configuration and persistence migration tests exit 0 on the current Windows checkout and prove explicit per-file attributes, successful fresh and 1/2/3-prefix migration, exact LF/CRLF equivalence, and typed no-write rejection of mixed endings, lone carriage return, BOM, missing final newline, content drift, unknown stored checksum, registry drift, and schema drift."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Complete source, build, packed-install, and offline regression",
        "criterion": "Using the frozen Node 24.19.0, pnpm 11.19.0, and TypeScript 5.9.3 toolchain without network or dependency repair, typecheck, build, package smoke, pnpm test, pnpm test:persistence, and pnpm verify:offline all exit 0; artifact hygiene reports no surviving .task-artifacts member."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Documentation ownership, links, capability truthfulness, and task inventory",
        "criterion": "pnpm docs:check and git diff --check exit 0; manual review finds one migration identity owner, no broken exact-case link, historical-evidence rewrite, schema/support overclaim, unknown checksum acceptance, or out-of-scope path; the final staged inventory contains only declared task-owned regular files."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "A normalization repair could change one released checksum or schema fingerprint and make valid existing runtimes unreadable."},
      {"id": "R2", "risk": "Overly permissive newline normalization could hide mixed, truncated, BOM-prefixed, or content-modified migration input."},
      {"id": "R3", "risk": "Source, built, and packed execution could select different migration bytes or leave checkout-specific behavior untested."},
      {"id": "R4", "risk": "A clean Git state can conceal raw worktree EOL differences, causing material evidence or gate receipts to overstate reproducibility."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Add each existing canonical checksum and historical canonical line ending to the sole migration-source registry, decode raw source once, accept only a uniform LF or uniform CRLF transport of the exact logical lines, reconstruct the declared canonical bytes, and verify the frozen checksum before returning a descriptor.",
        "rationale": "The existing documented identities are intentionally mixed because versions 1-3 were validated as CRLF bytes and version 4 as LF bytes; registry-owned reconstruction preserves all four identities while removing checkout dependence."
      },
      {
        "id": "D2",
        "statement": "Declare one explicit .gitattributes EOL entry per shipped migration rather than a wildcard and add configuration plus migration tests that compare both transport forms to the same descriptor.",
        "rationale": "Explicit per-file policy makes future migration identity an intentional review decision and catches a missing attribute without assigning an identity to an unapproved future file."
      },
      {
        "id": "D3",
        "statement": "Keep stored migration history immutable and fail closed on any checksum outside the four canonical identities; do not add a schema migration or metadata repair for the undocumented CRLF version-4 identity produced by the defective checkout.",
        "rationale": "Automatic repair would broaden compatibility and persistence semantics beyond this source-identity fix and could legitimize unverified state."
      },
      {
        "id": "D4",
        "statement": "Treat the change as Tier 2 because migration checksums are terminally consumed across startup, upgrade, backup, restore, doctor, source, build, and packed execution; reuse the existing registry as the only writer/reader identity owner.",
        "rationale": "A single pre-SQL canonicalization and checksum check closes the real transition without adding a parallel manifest, migration, or repair owner."
      }
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep the plan in proposal until fresh independent A0 is complete. If any checksum, scope, compatibility, or persistence boundary changes, revise the approval contract and rerun A0."},
      {"id": "M2", "recovery": "On any identity or test mismatch, stop before committing, preserve all migration files unchanged, and revert only task-owned registry, attributes, test, and documentation deltas."},
      {"id": "M3", "recovery": "A failed validation leaves the reserved task editable. Repair only within scope, rerun affected material evidence and independent review, then obtain a fresh artifact prune and exact-head gate receipt. Failed integration/push follows coordinator recovery; cleanup remains unrun."}
    ],
    "validation_bindings": [
      {"id": "V1", "state_binding": "material"},
      {"id": "V2", "state_binding": "material"},
      {"id": "V3", "state_binding": "material"},
      {"id": "V4", "state_binding": "material"},
      {"id": "V5", "state_binding": "material"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Freeze all four documented checksums and base blob OIDs, canonicalize before descriptor publication, and run every shipped-prefix, checksum, fingerprint, backup, restore, and package route.", "recovery": "Reject the candidate if any blob, checksum, registry identity, schema fingerprint, or valid-history readback changes; do not repair stored data."},
      {"id": "R2", "mitigation": "Accept only raw text exactly equal to its all-LF or all-CRLF reconstruction, require a final newline, reject BOM/empty input, then require the frozen checksum.", "recovery": "Return a typed migration checksum failure before SQLite open/write and retain the source bytes for diagnosis."},
      {"id": "R3", "mitigation": "Use one registry owner in source and compiled output, exercise current CRLF checkout plus synthetic LF/CRLF inputs, and run package smoke against the packed migration inventory.", "recovery": "Treat any parity mismatch as a failed material gate and keep the task reserved for repair."},
      {"id": "R4", "mitigation": "Record raw git ls-files --eol and file hashes as diagnostic evidence, test both transports independently of Git status, and bind terminal tests/review/gates to one committed task head.", "recovery": "Do not rely on clean status as byte evidence; rerun the transport matrix and exact blob comparison after every task-head change."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "0eaa23c14b6e5f9a4d3511d51c11311bb00bc675",
      "current_material_base": "0eaa23c14b6e5f9a4d3511d51c11311bb00bc675",
      "base_transitions": []
    },
    "milestone_progress": [
      {
        "id": "M1",
        "status": "complete",
        "updated_at": "2026-08-30 11:28:02+08:00"
      },
      {
        "id": "M2",
        "status": "complete",
        "updated_at": "2026-08-30 11:39:03+08:00"
      },
      {
        "id": "M3",
        "status": "complete",
        "updated_at": "2026-08-30 11:49:02+08:00"
      }
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Run exec_plan.py trace against the completed schema-v3 plan after recording fresh independent A1 and inspect lifecycle, exact scope, state bindings, audits, milestones, validations, and final summary.",
        "evidence": "The completed-plan trace exits 0 with status=completed, approval digest E405A7377936F3AD4746763CC2FC84DA98AEA8B91A2AEAB885A44371C8F72005, errors=[], warnings=[], outside_scope=[], completion_ready=true, completion_blockers=[], all M1-M3 and V1-V5 complete, fresh independent A0/A1 complete, no A2 required, and material state git-sha1:95ab1876c112bfbf53e30f696e0e354aa33383a7.",
        "state_id": "git-sha1:95ab1876c112bfbf53e30f696e0e354aa33383a7"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Compare all four migration paths to the reviewed base with Git object inspection, independently reconstruct the declared canonical bytes, and exercise both complete LF and complete CRLF transports through the candidate registry owner.",
        "evidence": "All four migration diffs are empty and blob OIDs remain 58ee5fec5936801aeb4546277dad4f8ca801a93c, c5a878ad6b2069e94b17450849843e05a25f8203, 2ecbd0bf1bf3d41de62fb8cfe08ea2b45ff78ff7, and af9700882a3a3494da587272fd204316e0efadc1. Independent A1 recomputation matched the frozen CRLF/CRLF/CRLF/LF checksums; both uniform transports produced byte-identical canonical SQL, prefix registry identities, and four schema fingerprints.",
        "state_id": "git-sha1:95ab1876c112bfbf53e30f696e0e354aa33383a7"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Run the configuration and migration-targeted suites serially, the complete persistence route, and independent A1 malformed-source plus stored-history probes.",
        "evidence": "Configuration passed 4/4, migration-targeted tests passed 17/17, and pnpm test:persistence passed 91/91 with artifact baselineEntries=terminalEntries=0. LF/CRLF transport, all shipped prefixes, fresh schema, checksum/schema drift, empty, BOM, missing terminal newline, lone CR, mixed EOL, content drift, and unknown persisted checksum/registry identity behaved exactly as contracted before mutation; altered history remained untouched.",
        "state_id": "git-sha1:95ab1876c112bfbf53e30f696e0e354aa33383a7"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Install the frozen TypeScript dependency from a task-local copied offline pnpm store, then run pnpm verify:offline with Node 24.19.0, pnpm 11.19.0, TypeScript 5.9.3, and npm/pnpm offline mode enabled.",
        "evidence": "The full offline gate exited 0: lint reported 141 files and 20 sources; strict typecheck/build passed; Node tests passed 270/270 with 0 failures/skips/todo and artifact 0-to-0; docs passed 68 Markdown files and 240 links; production dependencies remained 0; package smoke passed 83 packed files with source/build/installed persistence and CLI parity; Windows SQLite passed with zero survivors; Codex remained externalE2E=not_run and supportClaim=false.",
        "state_id": "git-sha1:95ab1876c112bfbf53e30f696e0e354aa33383a7"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Run pnpm docs:check and git diff --check, inspect the complete task inventory, and manually review authority, compatibility, and capability truthfulness.",
        "evidence": "Documentation passed with 68 Markdown files, 240 exact-case local links, and zero forbidden finding; diff check passed. The nine candidate paths including this plan are task-owned, migration files are absent from the diff, .task-artifacts is absent, and review found one runtime identity owner, no history repair or unknown checksum acceptance, no historical evidence rewrite, and no schema, platform, support, or execution-runtime overclaim.",
        "state_id": "git-sha1:95ab1876c112bfbf53e30f696e0e354aa33383a7"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/a0_review",
        "independence": "Fresh same-family independent read-only A0 attempt 2; prior participation was limited to reporting F-A0-001 in attempt 1. The reviewer did not revise or disposition the contract, draft implementation decisions, edit files or plans, execute tests, mutate Git/index/refs/worktrees or coordinator state, grant permission, access the network, or change external state.",
        "scope": "The complete current schema-v3 fix-migration-eol-identity proposal, including archived A0 attempt 1 and contract revision; fresh current trace; repository and ExecPlan guidance already read for this A0 sequence; Tier-2 persistence identity, ingress, writer/reader closure, stored-history refusal, validation and recovery boundaries; and fresh independent recomputation of the approval digest, four canonical LF/CRLF checksums, and four reviewed-base Git blob identities.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-30 11:27:06+08:00",
        "approval_sha256": "E405A7377936F3AD4746763CC2FC84DA98AEA8B91A2AEAB885A44371C8F72005",
        "reviewed_material_base": "0eaa23c14b6e5f9a4d3511d51c11311bb00bc675",
        "evidence": "Fresh trace exited 0 with schema_version=3, errors=[], warnings=[], outside_scope=[], overlap=[], approval/current material base and HEAD exactly 0eaa23c14b6e5f9a4d3511d51c11311bb00bc675, state git-sha1:9824f4f8156fdb5e1bbd4005a50ee86359c20ea6, and next_action=run_a0. Independent UTF-8 sorted-key compact canonicalization produced 11030 approval-contract bytes and SHA-256 E405A7377936F3AD4746763CC2FC84DA98AEA8B91A2AEAB885A44371C8F72005. All four C1 literals are valid 64-character hashes and independently match the declared CRLF/CRLF/CRLF/LF canonical bytes; their reviewed-base Git blob OIDs remain 58ee5fec5936801aeb4546277dad4f8ca801a93c, c5a878ad6b2069e94b17450849843e05a25f8203, 2ecbd0bf1bf3d41de62fb8cfe08ea2b45ff78ff7, and af9700882a3a3494da587272fd204316e0efadc1. Attempt 1 and its previous digest remain preserved. The contract retains one pre-SQL registry owner, immutable migration blobs and stored history, exact transport rejection, complete consumers, binary gates, recovery, and authorized Git-flow boundaries.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/migration_eol_a1",
        "independence": "Fresh independent read-only A1. The reviewer did not implement or disposition the candidate, edit files or plans, mutate Git/index/refs/coordinator state, change permissions, use the network, or rely on the parent agent's conclusions as technical evidence.",
        "scope": "Complete uncommitted task diff against 0eaa23c14b6e5f9a4d3511d51c11311bb00bc675, including the untracked active ExecPlan; repository governance, architecture, authoritative persistence/toolchain/validation/versioning/ownership contracts; ExecPlan A1 and Tier-2 persistence guidance; migration registry, history decoder, consumer closure, configuration and migration tests.",
        "reviewed_at": "2026-08-30 11:47:31+08:00",
        "evidence": "Final read-only trace exited 0 at git-sha1:95ab1876c112bfbf53e30f696e0e354aa33383a7 with errors=[], warnings=[], outside_scope=[], and overlap=[]. The reviewer independently proved unchanged SQL blobs; exact historical checksums; byte-identical canonical SQL, prefix registry identities, and schema fingerprints from LF/CRLF; pre-publication malformed-source rejection; documented history readback at registry identity 274804AD62AE2C143FCDFE844A19C48A3CDF393521604DC108F128F97C754825; no-write unknown checksum/identity refusal; one lazy registry consumer closure; exact four per-file Git attributes; truthful contracts; and exact task scope. Parent full-offline evidence was reported separately and not treated as the reviewer's technical proof.",
        "reviewed_state_id": "git-sha1:95ab1876c112bfbf53e30f696e0e354aa33383a7",
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
        "finding_ids": ["F-A0-001"],
        "disposition": "reopened",
        "reason": "Fresh independent A0 bound approval digest 0BBE9088BCE0B8FEADEE09C139CDDA70C1F3C3FB2CC673E709837E1D92B94619 and base 0eaa23c14b6e5f9a4d3511d51c11311bb00bc675, then confirmed HIGH fact drift: C1 transcribed migrations 0003 and 0004 as invalid 65-character hashes. Parent reproduced the base bytes, accepted the finding, corrected only those two literals and their source, preserved all migration blobs and historical evidence, and reopened the proposal for fresh A0."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V3",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-08-30 11:32:17+08:00",
        "evidence": "The first migration-targeted run passed 16/17 but proved that TextDecoder consumed a leading UTF-8 BOM before the post-decode BOM check, so that negative sample did not throw. The owner was repaired to reject the raw EF BB BF prefix before decode; the same complete targeted route then passed 17/17 and all final material evidence was refreshed.",
        "state_id": null
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-08-30 11:27:00+08:00",
        "summary": "Closed A0 F-A0-001 by replacing only the two mistyped 65-character migration checksum literals with their independently recomputed 64-character canonical values and removing the erroneous historical narrative as a fact source; scope, authorization, implementation strategy, and validation criteria remain unchanged.",
        "previous_approval_sha256": "0BBE9088BCE0B8FEADEE09C139CDDA70C1F3C3FB2CC673E709837E1D92B94619"
      }
    ],
    "final_summary": "The released schema-v1 through schema-v4 migration registry now reconstructs and verifies its frozen CRLF/CRLF/CRLF/LF canonical representations from either uniform LF or CRLF checkout transport before SQLite mutation. All four migration blobs, checksums, schema behavior, and persisted-history refusal remain unchanged; explicit per-file attributes make checkout intent reviewable; malformed or drifted sources fail closed; source/build/packed consumers converge; full offline validation and fresh independent A1 pass without findings or expanded support claims."
  }
}
```

## Context

At commit `0eaa23c`, the completed EP-01D worktree retains migrations 0001-0003 as CRLF and 0004 as LF, matching the recorded checksums and passing 268 tests. A fresh Windows worktree with system `core.autocrlf=true` checks out all four files as CRLF; version 4 then receives a different raw checksum, and the migration content-rewrite regression fails before exercising its assertion. The repair preserves the recorded identities rather than choosing the current checkout's accidental transport.
