# EP-03B A2 attempt 1 — reopened

- Report status: `complete`
- Reviewer: `/root/ep03b_a2_1`
- Reviewed at: `2026-09-02 19:03:24+08:00`
- Reviewed material state: `git-sha1:3699af145aea6aef189e0a8f9ab856db50d23af6`
- Approval SHA-256: `42CE09525A869C8A91E8DD8DDF9025D254CE2240C497486D0F50158265F349E6`
- Material base: `d0ed2d85c2908e36f8b97a450366ee85ab72368f`
- Independence: fresh independent non-implementer strictly read-only A2 review.
- Parent disposition: `a2_required`
- Closes: none at this reviewed state.

The reviewer inspected the exact repaired state, all four A1 findings and parent
dispositions, the complete task material inventory and diff, the production
adapter, application and port binding, focused security and recovery tests,
and the authoritative workspace containment and effect-classification
contracts. The review made no repository, Git, coordinator, fixture, product,
network, credential, external-repository, cleanup, integration, push, release
or deployment mutation. It independently reproduced the approval digest,
material base and exact material state and confirmed that the principal repairs
for all four A1 findings were present.

## F-A2-EP03B-001 — MEDIUM — post-mkdir identity failure loses the acquired effect

`ensureDirectoryChild` sets its local `created` fact after `mkdirSync` succeeds,
but calls `identityFor` while constructing its return value. If that identity
validation fails, the created fact is not returned. `workerStageObjects` and
`workerStageCapabilityParent` catch the exception and return
`effectStarted=false`; the analogous workspace-parent and linked-admin catches
also discard the same fact. `executeCreate` can consequently map a real
adapter-created namespace or probe directory to a non-ambiguous conflict,
allowing the durable owner to treat an effect-possible attempt as no effect.

The parent independently reproduced the call graph and accepts the finding as
`confirmed=true`, `in_scope=true`, `changes_task_diff=true`, and
`disposition=a2_required`. This is a local residual of the approved
`F-A1-EP03B-003` effect-propagation repair and directly touches the production
probe acquired for `F-A1-EP03B-001`; it does not change the approved
architecture, authority, scope or product boundary and does not reopen A1.

The minimum repair is to preserve the directory-acquisition fact across every
post-`mkdirSync` identity-validation failure, propagate it through each caller,
and never attempt cleanup when the new directory identity cannot be proved. A
deterministic regression must demonstrate that this boundary produces
`ambiguous_external_state` and durable `recovery_required`, rather than a
conflict/no-effect result. The complete same A2 must then rerun freshly at the
new exact material state.
