# EP-00A final validation evidence

This is the durable binary-evidence index for EP-00A. Exact executable commands
and expected/observed output are in
docs/plans/evidence/EP-00A/validation-commands.txt. The schema-v3 plan stores
the runner, final observation time, result, and exact Git material-state ID for
each gate after both evidence files are staged. Keeping the state ID in the
plan avoids changing the material state by writing its own identity here.

All commands and manual reviews use working directory
D:\agent-task-orchestrator. The material environment is Microsoft Windows NT
10.0.22631.0, PowerShell Core 7.6.4, Git 2.53.0.windows.1, Python 3.12.7,
master at base dfb4fd3fcf67d45bbf1a4c3b345260798c3ff28a, and China Standard
Time. The runner/manual reviewer is the primary Codex agent; A1 and A2
independence are recorded separately in the plan.

Every applicable EP-00A gate appears below. No runtime, compile, test, CI,
database, adapter, platform, account, network, or external-repository gate is
applicable because executable implementation and support claims are explicit
EP-00A non-goals. No applicable gate is omitted or blocked.

## V1 — license and contribution consistency

- Exact criterion: LICENSE is the unmodified Apache License 2.0 text;
  README.md, CONTRIBUTING.md, SECURITY.md, and CHANGELOG.md identify
  Apache-2.0; README.md identifies agent-task-orchestrator as an independent
  community project not made, sponsored, or endorsed by OpenAI;
  CONTRIBUTING.md states that submitted contributions are licensed under
  Apache-2.0 and require contributor authority; SECURITY.md gives a
  private-reporting path when available plus a no-sensitive-details fallback;
  and none of those files claims a release or supported runtime.
- Expected/result: passed.
- Exact method: run the V1 command in validation-commands.txt.
- Actual: exit 0; 202 lines; all four policy documents passed; LICENSE and the
  installed archspec LICENSE-APACHE source both have SHA-256
  CFC7749B96F63BD31C3C42B5C471BF756814053E847C10F3EB003417BC523D30.
- Durable evidence ID: EP-00A/V1/final.

## V2 — complete ADR decision set

- Exact criterion: exactly ADR-001 through ADR-012 exist in docs/adr; each
  number's title and Decision cover its exact C7 subject and select the C7
  outcome rather than an unrelated choice; each is marked Accepted and contains
  Context, Decision, Consequences, Alternatives, Authoritative contract, and
  Required validation sections with resolving repository-relative links.
- Expected/result: passed.
- Exact method: run the V2 command in validation-commands.txt; V5 independently
  resolves its local links.
- Actual: exit 0; ADRS=12, SECTIONS_PER_ADR=6, SUBJECTS=12.
- Durable evidence ID: EP-00A/V2/final.

## V3 — unique and complete architecture contract ownership

- Exact criterion: the documented owner matrix names every exact C8 artifact
  once; every listed artifact exists and normatively covers every outcome
  assigned to it in C8, including all eight Tier 2 transition guarantees;
  ADRs, architecture, entry points, and adjacent references link to these
  owners without defining a competing state, schema, protocol, security,
  compatibility, or validation rule.
- Expected/result: passed.
- Exact manual procedure:
  1. Read C8 in the active plan and every owner-inventory row.
  2. Read in full ARCHITECTURE.md, docs/README.md, docs/adr/README.md, all
     twelve ADRs, all docs/reference files, both docs/security contracts, and
     docs/compatibility/v0.1.md.
  3. Trace every C8 outcome to one normative owner and inspect all adjacent
     statements for delegation rather than a second definition.
  4. Apply all eight Tier 2 lenses: writer/reader closure, identity/policy
     binding, authoritative ingress, pre-mutation fail-closed, topology
     isolation, lock/stage/CAS/no-follow, inventory/terminal evidence, and
     recovery.
  5. Recheck the A1/A2 repair surfaces end to end: waiting representation and
     continuation, complete gate identity, reservations, schedule/run/trigger
     identity, authorization/query persistence, semantic operation identity,
     ProjectPolicy sequencing, operation-class envelopes, action/bootstrap
     coverage, denial-without-run, atomic finite fan-out membership sealing,
     pending-member CAS, crash recovery, and summary completeness accounting.
  6. Run the V3 SUPPORT command and pass only if neither review finds a missing
     outcome or competing owner.
- Actual: manual observation found zero competing owners or missing outcomes;
  supporting command exit 0 with OWNER_ROWS=15, CONTRACT_ASSERTIONS=31,
  A1_CLOSURES=4, A2_CLOSURES=1, and TIER2_LENSES=8.
- Durable evidence ID: EP-00A/V3/final.

## V4 — threat-driven security and privacy baseline

- Exact criterion: the threat model enumerates assets, actors, trust
  boundaries, path/reparse, prompt injection, external mutation, secrets,
  logs/privacy, SQLite integrity, scheduler duplication, MCP exposure,
  mitigations, negative-test obligations, residual risks, and explicit
  non-claims.
- Expected/result: passed.
- Exact manual procedure: read docs/security/threat-model.md in full; inspect
  every required section, T1–T10 abuse/mitigation/residual-risk row, N1–N10
  negative test and passing outcome, and current non-claim. Confirm T1 through
  T8 respectively cover the eight named abuse surfaces. Then run V4 SUPPORT.
- Actual: manual observation passed; supporting command exit 0 with SECTIONS=7,
  THREATS=10, NEGATIVE_TESTS=10, and TOPICS=10.
- Durable evidence ID: EP-00A/V4/final.

## V5 — deterministic documentation and staged inventory

- Exact criterion: every repository-relative Markdown link resolves to an
  existing staged or committed regular file; git diff --check succeeds; and
  the staged inventory contains only declared task paths with no
  credential-shaped file, runtime database/log/backup/worktree data, or ignored
  local roadmap.
- Expected/result: passed.
- Exact method: run V5 SCOPE and V5 LINKS in validation-commands.txt.
- Actual: both exit 0. Scope reports STAGED=43, OUTSIDE_SCOPE=0, UNSTAGED=0,
  UNTRACKED=0, SECRET_OR_RUNTIME_ARTIFACTS=0. Links report
  MARKDOWN_FILES=40, LOCAL_LINKS=190, BROKEN=0.
- Durable evidence IDs: EP-00A/V5/scope-final and
  EP-00A/V5/links-final.

## V6 — pre-existing ignored-roadmap ownership

- Exact criterion: at completion readiness, the recorded snapshot SHA-256
  equals the EP-00A pre-task .gitignore bytes, Git reports the local roadmap
  ignored by the preserved .local/ rule, and that roadmap is absent from the
  index. C9 separately requires post-commit historical scope/inventory
  verification before successor work.
- Expected/result: passed.
- Exact method: run V6 in validation-commands.txt.
- Actual: exit 0; current and snapshot SHA-256 are both
  2E3D40CD11F3909974C6DEEE93B2677A8619B5E46FD3F5090BAA3F5659ADD989;
  ignore source is .gitignore line 15; ROADMAP_INDEXED=false.
- Durable evidence ID: EP-00A/V6/final.

## V7 — authority consistency and capability truthfulness

- Exact criterion: a human review of every EP-00A changed document finds no
  statement that describes planned runtime, platform, adapter, security
  control, integration, CI, or test behavior as implemented or supported;
  finds no conflict under the authority order; and confirms every normative
  rule is located only in its C8 owner or explicitly delegated by that owner.
- Expected/result: passed.
- Exact manual procedure:
  1. Enumerate and read the full staged bytes of all 39 changed Markdown paths:
     the five root Markdown files; docs/README.md; ADR-001 through ADR-012 and
     docs/adr/README.md; docs/compatibility/v0.1.md; docs/plans/README.md; the
     active plan; all three Markdown evidence files; all twelve docs/reference
     files; and both docs/security files.
  2. Classify every statement as current repository fact, planned normative
     contract, accepted rationale, non-normative evidence, plan history, or
     validation observation.
  3. Reject any planned-capability sentence lacking future/planned context and
     any normative sentence outside its owner/delegation boundary.
  4. Re-read the seven repaired owner files together and trace the policy-query,
     final-authorization, intent/effect, denial, waiting, scheduler,
     persistence, atomic membership seal, candidate CAS, crash recovery, and
     terminal-summary sequences.
  5. Run V7 SUPPORT and pass only if both the review and scan are clean.
- Actual: manual observation found no conflict or unsupported claim; supporting
  command exit 0 with GENERIC_CONTRACTS=11, DECISION_DOCS=14,
  ADR_CAPABILITY_QUALIFIERS=12, MATRIX_UNVERIFIED_ROWS=8.
- Durable evidence ID: EP-00A/V7/final.

## V8 — strict predecessor/successor ordering

- Exact criterion: at completion readiness, Git and the filesystem contain no
  EP-00B, EP-01A, EP-01B, EP-02, EP-03A, EP-03B, or EP-03C lifecycle plan,
  and EP-00A scope covers no successor plan path. C9 separately requires
  terminal-resolve after this plan's commit and chain-check before successor
  implementation.
- Expected/result: passed.
- Exact method: run V8 in validation-commands.txt.
- Actual: exit 0; SCOPE_PATHS=17, FILESYSTEM_SUCCESSORS=0,
  INDEX_SUCCESSORS=0, HEAD_SUCCESSORS=0.
- Durable evidence ID: EP-00A/V8/final.

## Retained failed evidence

The active plan retains the original V5 whitespace failure, the invalid
pre-revision V6 invocation, the V3/V7 failures confirmed by A1 at
git-sha1:c3f1479b57f9b7098bfd615b78655e9139f95630, and the V3/V7 failure plus
reopened A2 confirmed at
git-sha1:19426e8560cb23c6f4ab53cfb3671b35d568e0bb. The complete independent
reports are docs/plans/evidence/EP-00A/a1-attempt-1.md and
docs/plans/evidence/EP-00A/a2-attempt-1.md. Repairs used ordinary task-owned
edits only: no reset, stash, force, destructive cleanup, worktree, network, or
external-repository mutation.
