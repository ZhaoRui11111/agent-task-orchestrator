# EP-01C A0 attempt 1

- Reviewer: `/root/ep01c_a0`
- Reviewed at: `2026-08-29 19:30:53+08:00`
- Independence: fresh, independent, strictly read-only; no repository, plan,
  Git, coordinator, artifact, network, secret, or external-state mutation and
  no authorization grant.
- Approval SHA-256:
  `92B3622F0817AFC8F98C3CE15FED3FBA4C61DC0A409F6BCF571C6633B2A2FD30`
- Reviewed material base:
  `4594c859e4cb172353cc93298518b0a7eafb7fb3`
- Result: `revision_required`

The reviewer independently canonicalized 26,425 approval-contract bytes,
confirmed a clean schema-v3 trace at
`git-sha1:fc1fd6989e35caf2898e3b1f1f9a5226450f9b39`, uniquely resolved the
EP-01B terminal to `a2a898e13b5231a1dd061ad1a6bb77df146383ce`, and confirmed that
the ancestor delta to the reviewed base contains only the 12-path standing
artifact-prune and test-hygiene governance change. It changes no EP-01C
product, schema, authorization, or application outcome.

## Findings and parent disposition

All four findings were confirmed in scope and the proposal was reopened.

1. `F-A0-001` (`MEDIUM`, `fact_drift`): the stored
   `approval_material_base` named the EP-01B terminal while fresh A0 actually
   reviewed the current governance head. Closed in the revised proposal by
   setting both approval/current bases to the reviewed head, clearing the
   pre-A0 transition, and retaining the independently inspected base-diff
   assessment in plan constraints, decisions, attempt evidence, and V1.
2. `F-A0-002` (`HIGH`, `contract_gap`): sensitive Project, Task/status/
   dependency, and grant inspection lacked exact finite actions and bounded
   read-decision semantics. Closed in the revised approval contract by adding
   exactly `authorization.grant.inspect`, `project.inspect`, and
   `task.inspect`, their scopes/revisions, `read_not_applicable` binding,
   one-query consumption, sanitized audit behavior, and replay negatives.
3. `F-A0-003` (`HIGH`, `contract_gap`): the generic accepted-mutation shape did
   not cover bootstrap or grant issue/revoke topology. Closed by freezing five
   distinct atomic shapes for bootstrap, grant administration,
   registry/Domain mutation, reads, and fully bound denials, with failpoint,
   contention/CAS, request-consumption, restart, audit, and terminal-readback
   criteria.
4. `F-A0-004` (`HIGH`, `contract_gap`): the existing backup/restore verifier
   was an omitted direct schema-v3 reader. Closed by adding
   `src/persistence/backup.ts` and its test owner to task scope and requiring
   open, backup verification, restore readback, and restart to consume the one
   authoritative combined v3 decoder, including corruption refusal.

Fresh independent A0 is required for the revised approval digest. This report
does not authorize implementation or any external action.
