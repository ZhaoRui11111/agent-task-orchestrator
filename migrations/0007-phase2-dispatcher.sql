CREATE TABLE authorization_capability_epochs_v7 (
  epoch_id TEXT PRIMARY KEY NOT NULL CHECK (length(epoch_id) BETWEEN 1 AND 128),
  epoch_revision INTEGER NOT NULL UNIQUE CHECK (epoch_revision > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  runtime_root_key TEXT NOT NULL CHECK (length(runtime_root_key) > 0),
  vocabulary_version INTEGER NOT NULL CHECK (vocabulary_version = 7),
  action_set_sha256 TEXT NOT NULL CHECK (length(action_set_sha256) = 64 AND action_set_sha256 NOT GLOB '*[^0-9A-F]*'),
  request_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  expires_at TEXT NOT NULL CHECK (length(expires_at) > 0),
  UNIQUE(epoch_id, request_id),
  FOREIGN KEY (actor_id, runtime_root_key) REFERENCES authorization_local_identity(actor_id, runtime_root_key) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER authorization_capability_epochs_v7_global_id_guard
BEFORE INSERT ON authorization_capability_epochs_v7
WHEN EXISTS (SELECT 1 FROM authorization_capability_epochs WHERE epoch_id=NEW.epoch_id)
  OR EXISTS (SELECT 1 FROM authorization_capability_epochs_v6 WHERE epoch_id=NEW.epoch_id)
  OR EXISTS (SELECT 1 FROM authorization_capability_epochs WHERE epoch_revision=NEW.epoch_revision)
  OR EXISTS (SELECT 1 FROM authorization_capability_epochs_v6 WHERE epoch_revision=NEW.epoch_revision)
BEGIN
  SELECT RAISE(ABORT, 'authorization capability epoch identity and revision must be globally unique');
END;

CREATE TRIGGER authorization_capability_epochs_global_id_v7_guard
BEFORE INSERT ON authorization_capability_epochs
WHEN EXISTS (SELECT 1 FROM authorization_capability_epochs_v7 WHERE epoch_id=NEW.epoch_id)
  OR EXISTS (SELECT 1 FROM authorization_capability_epochs_v7 WHERE epoch_revision=NEW.epoch_revision)
BEGIN
  SELECT RAISE(ABORT, 'authorization capability epoch identity and revision must be globally unique');
END;

CREATE TRIGGER authorization_capability_epochs_v6_global_id_v7_guard
BEFORE INSERT ON authorization_capability_epochs_v6
WHEN EXISTS (SELECT 1 FROM authorization_capability_epochs_v7 WHERE epoch_id=NEW.epoch_id)
  OR EXISTS (SELECT 1 FROM authorization_capability_epochs_v7 WHERE epoch_revision=NEW.epoch_revision)
BEGIN
  SELECT RAISE(ABORT, 'authorization capability epoch identity and revision must be globally unique');
END;

CREATE TABLE authorization_grants_v7 (
  grant_id TEXT PRIMARY KEY CHECK (length(grant_id) BETWEEN 1 AND 128),
  revision INTEGER NOT NULL CHECK (revision > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action = 'dispatch.run'),
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('runtime', 'project')),
  scope_project_id TEXT,
  scope_resource_revision INTEGER,
  scope_config_revision INTEGER,
  not_before TEXT NOT NULL CHECK (length(not_before) > 0),
  expires_at TEXT NOT NULL CHECK (length(expires_at) > 0),
  revoked_at TEXT,
  issuer_grant_id TEXT,
  source_grant_id TEXT,
  capability_epoch_id TEXT,
  created_request_id TEXT NOT NULL,
  revoked_request_id TEXT,
  CHECK (
    (scope_kind = 'runtime' AND scope_project_id IS NULL AND scope_resource_revision IS NULL AND scope_config_revision IS NULL)
    OR (scope_kind = 'project' AND length(scope_project_id) > 0 AND scope_resource_revision > 0 AND scope_config_revision > 0)
  ),
  CHECK ((issuer_grant_id IS NULL AND source_grant_id IS NULL) OR (issuer_grant_id IS NOT NULL AND source_grant_id IS NOT NULL)),
  CHECK ((revoked_at IS NULL AND revoked_request_id IS NULL) OR (length(revoked_at) > 0 AND revoked_request_id IS NOT NULL)),
  UNIQUE(capability_epoch_id, action),
  UNIQUE(grant_id, action),
  FOREIGN KEY (scope_project_id) REFERENCES project_registry(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (capability_epoch_id) REFERENCES authorization_capability_epochs_v7(epoch_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (created_request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (revoked_request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE INDEX authorization_grants_v7_actor_action_index ON authorization_grants_v7(actor_id, action, grant_id);
CREATE UNIQUE INDEX authorization_grants_v6_id_action_v7_link_index ON authorization_grants_v6(grant_id, action);

CREATE TRIGGER authorization_grants_v7_global_id_guard
BEFORE INSERT ON authorization_grants_v7
WHEN EXISTS (SELECT 1 FROM authorization_grants WHERE grant_id=NEW.grant_id)
  OR EXISTS (SELECT 1 FROM authorization_grants_v6 WHERE grant_id=NEW.grant_id)
BEGIN
  SELECT RAISE(ABORT, 'authorization grant identifiers must be globally unique');
END;

CREATE TRIGGER authorization_grants_global_id_v7_guard
BEFORE INSERT ON authorization_grants
WHEN EXISTS (SELECT 1 FROM authorization_grants_v7 WHERE grant_id=NEW.grant_id)
BEGIN
  SELECT RAISE(ABORT, 'authorization grant identifiers must be globally unique');
END;

CREATE TRIGGER authorization_grants_v6_global_id_v7_guard
BEFORE INSERT ON authorization_grants_v6
WHEN EXISTS (SELECT 1 FROM authorization_grants_v7 WHERE grant_id=NEW.grant_id)
BEGIN
  SELECT RAISE(ABORT, 'authorization grant identifiers must be globally unique');
END;

CREATE TABLE authorization_grant_epoch_v7_legacy_links (
  grant_id TEXT PRIMARY KEY NOT NULL CHECK (length(grant_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action IN (
    'authorization.grant.issue', 'authorization.grant.inspect', 'authorization.grant.revoke',
    'policy.evaluate', 'project.register', 'project.update', 'project.disable', 'project.inspect',
    'task.create', 'task.update', 'task.mark_ready', 'task.cancel', 'task.inspect',
    'dependency.add', 'dependency.remove', 'authorization.grant.list', 'runtime.status',
    'runtime.backup', 'runtime.restore', 'execution.claim', 'execution.claim.inspect',
    'execution.lease.renew', 'execution.lease.takeover'
  )),
  capability_epoch_id TEXT NOT NULL CHECK (length(capability_epoch_id) BETWEEN 1 AND 128),
  UNIQUE(capability_epoch_id, action),
  FOREIGN KEY (grant_id, action) REFERENCES authorization_grants(grant_id, action) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (capability_epoch_id) REFERENCES authorization_capability_epochs_v7(epoch_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE authorization_grant_epoch_v7_v6_links (
  grant_id TEXT PRIMARY KEY NOT NULL CHECK (length(grant_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action IN (
    'execution.start', 'execution.inspect', 'execution.resume', 'execution.retry',
    'execution.cancel', 'execution.completion.accept'
  )),
  capability_epoch_id TEXT NOT NULL CHECK (length(capability_epoch_id) BETWEEN 1 AND 128),
  UNIQUE(capability_epoch_id, action),
  FOREIGN KEY (grant_id, action) REFERENCES authorization_grants_v6(grant_id, action) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (capability_epoch_id) REFERENCES authorization_capability_epochs_v7(epoch_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE application_lifecycle_digest_v7 (
  authorization_id TEXT PRIMARY KEY NOT NULL,
  state_digest_version INTEGER NOT NULL CHECK (state_digest_version = 4),
  FOREIGN KEY (authorization_id) REFERENCES application_lifecycle_authorizations(authorization_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE dispatcher_trigger_requests (
  request_id TEXT PRIMARY KEY NOT NULL CHECK (length(request_id) BETWEEN 1 AND 128),
  observation_id TEXT NOT NULL UNIQUE CHECK (length(observation_id) BETWEEN 1 AND 128),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action = 'dispatch.run'),
  worker_owner_id TEXT NOT NULL CHECK (length(worker_owner_id) BETWEEN 1 AND 128),
  requested_lease_seconds INTEGER NOT NULL CHECK (requested_lease_seconds BETWEEN 30 AND 3600),
  result TEXT NOT NULL CHECK (result IN ('allow', 'deny')),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0)
) STRICT;

CREATE TABLE dispatcher_authorization_decisions (
  decision_id TEXT PRIMARY KEY NOT NULL CHECK (length(decision_id) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL,
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action = 'dispatch.run'),
  result TEXT NOT NULL CHECK (result IN ('allow', 'deny')),
  reason TEXT NOT NULL CHECK (reason IN (
    'allowed', 'actor_mismatch', 'action_mismatch', 'scope_mismatch', 'scope_revision_stale',
    'grant_expired', 'grant_not_yet_valid', 'grant_revoked', 'grant_missing', 'policy_denied',
    'confirmation_required'
  )),
  policy_result TEXT NOT NULL CHECK (policy_result IN ('allow', 'deny', 'read_not_applicable')),
  grant_id TEXT,
  grant_revision INTEGER,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK ((grant_id IS NULL AND grant_revision IS NULL) OR (length(grant_id) > 0 AND grant_revision > 0)),
  CHECK ((result='allow' AND reason='allowed' AND grant_id IS NOT NULL) OR (result='deny' AND reason<>'allowed')),
  FOREIGN KEY (request_id) REFERENCES dispatcher_trigger_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE INDEX dispatcher_authorization_decisions_request_index
  ON dispatcher_authorization_decisions(request_id, created_at, decision_id);

CREATE TABLE dispatcher_runs (
  run_id TEXT PRIMARY KEY NOT NULL CHECK (length(run_id) BETWEEN 1 AND 128),
  observation_id TEXT NOT NULL UNIQUE CHECK (length(observation_id) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL UNIQUE,
  decision_id TEXT NOT NULL UNIQUE,
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  owner_id TEXT NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 128),
  owner_revision INTEGER NOT NULL CHECK (owner_revision > 0),
  run_revision INTEGER NOT NULL CHECK (run_revision > 0),
  requested_lease_seconds INTEGER NOT NULL CHECK (requested_lease_seconds BETWEEN 30 AND 3600),
  heartbeat_at TEXT NOT NULL CHECK (length(heartbeat_at) > 0),
  lease_expires_at TEXT NOT NULL CHECK (length(lease_expires_at) > 0),
  status TEXT NOT NULL CHECK (status IN ('starting', 'reconciling', 'sweeping', 'completed', 'partial', 'failed', 'interrupted')),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (observation_id) REFERENCES dispatcher_trigger_requests(observation_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (request_id) REFERENCES dispatcher_trigger_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (decision_id) REFERENCES dispatcher_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE INDEX dispatcher_runs_status_lease_index ON dispatcher_runs(status, lease_expires_at, run_id);

CREATE TABLE dispatcher_audit (
  audit_id TEXT PRIMARY KEY NOT NULL CHECK (length(audit_id) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  run_id TEXT,
  event_kind TEXT NOT NULL CHECK (event_kind IN (
    'dispatch.denied', 'dispatch.started', 'dispatch.reconciling', 'dispatch.sealed',
    'dispatch.member.resolved', 'dispatch.heartbeat', 'dispatch.taken_over', 'dispatch.terminal',
    'dispatch.operation.denied'
  )),
  result TEXT NOT NULL CHECK (result IN ('accepted', 'denied')),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  code TEXT NOT NULL CHECK (code IN (
    'started', 'reconciling', 'reconciled', 'sealed', 'member_resolved', 'heartbeat', 'taken_over', 'terminal',
    'allowed', 'actor_mismatch', 'action_mismatch', 'scope_mismatch', 'scope_revision_stale', 'grant_expired',
    'grant_not_yet_valid', 'grant_revoked', 'grant_missing', 'policy_denied', 'confirmation_required'
  )),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  FOREIGN KEY (request_id) REFERENCES dispatcher_trigger_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (decision_id) REFERENCES dispatcher_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (run_id) REFERENCES dispatcher_runs(run_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE dispatcher_reconciliation_items (
  reconciliation_item_id TEXT PRIMARY KEY NOT NULL CHECK (length(reconciliation_item_id) BETWEEN 1 AND 128),
  run_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  resource_kind TEXT NOT NULL CHECK (resource_kind IN ('execution_intent', 'execution_lease', 'dispatcher_run')),
  resource_id TEXT NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 128),
  disposition TEXT NOT NULL CHECK (disposition IN ('reconciled', 'no_effect', 'authorization_denied', 'ambiguous', 'failed')),
  code TEXT NOT NULL CHECK (code IN (
    'reliable_reconciled', 'reliable_authorization_denied', 'reliable_state_ambiguous', 'reliable_recovery_failed',
    'stale_run_already_terminal', 'stale_run_recovered', 'stale_run_authorization_denied',
    'stale_run_recovery_failed', 'stale_run_recovery_pending', 'resource_already_settled',
    'execution_already_terminal', 'execution_intent_absent', 'execution_intent_ambiguous',
    'execution_no_longer_active', 'execution_intent_unfinished', 'execution_binding_changed',
    'execution_takeover_denied', 'execution_takeover_stale', 'execution_takeover_failed',
    'execution_backend_journal_present', 'execution_turn_queued', 'execution_turn_active', 'execution_turn_waiting',
    'execution_turn_turn_succeeded', 'execution_turn_failed', 'execution_turn_cancelled'
  )),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  UNIQUE(run_id, ordinal),
  UNIQUE(run_id, resource_kind, resource_id),
  FOREIGN KEY (run_id) REFERENCES dispatcher_runs(run_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE dispatcher_reconciliation_summaries (
  run_id TEXT PRIMARY KEY NOT NULL,
  summary_revision INTEGER NOT NULL CHECK (summary_revision = 1),
  expected_count INTEGER NOT NULL CHECK (expected_count >= 0),
  reconciled_count INTEGER NOT NULL CHECK (reconciled_count >= 0),
  no_effect_count INTEGER NOT NULL CHECK (no_effect_count >= 0),
  authorization_denied_count INTEGER NOT NULL CHECK (authorization_denied_count >= 0),
  ambiguous_count INTEGER NOT NULL CHECK (ambiguous_count >= 0),
  failed_count INTEGER NOT NULL CHECK (failed_count >= 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK (expected_count = reconciled_count + no_effect_count + authorization_denied_count + ambiguous_count + failed_count),
  FOREIGN KEY (run_id) REFERENCES dispatcher_runs(run_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE dispatcher_memberships (
  run_id TEXT PRIMARY KEY NOT NULL,
  membership_revision INTEGER NOT NULL CHECK (membership_revision > 0),
  expected_member_count INTEGER NOT NULL CHECK (expected_member_count >= 0),
  sealed_at TEXT NOT NULL CHECK (length(sealed_at) > 0),
  UNIQUE(run_id, membership_revision),
  FOREIGN KEY (run_id) REFERENCES dispatcher_runs(run_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE dispatcher_members (
  member_id TEXT PRIMARY KEY NOT NULL CHECK (length(member_id) BETWEEN 1 AND 128),
  run_id TEXT NOT NULL,
  membership_revision INTEGER NOT NULL CHECK (membership_revision > 0),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  project_id TEXT NOT NULL CHECK (length(project_id) > 0),
  project_resource_revision INTEGER NOT NULL CHECK (project_resource_revision > 0),
  project_config_revision INTEGER NOT NULL CHECK (project_config_revision > 0),
  task_id TEXT NOT NULL CHECK (length(task_id) > 0),
  task_revision INTEGER NOT NULL CHECK (task_revision > 0),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('pending', 'terminal')),
  outcome TEXT CHECK (outcome IS NULL OR outcome IN (
    'claimed', 'already_claimed', 'ineligible_at_cas', 'authorization_denied',
    'policy_deferred', 'resource_deferred', 'reconciliation_required', 'failed'
  )),
  execution_id TEXT,
  intent_id TEXT,
  code TEXT CHECK (code IS NULL OR code IN (
    'dispatch_denied', 'binding_absent', 'project_identity_changed', 'project_revision_changed', 'project_disabled',
    'execution_sequence_exists', 'task_revision_changed', 'domain_ineligible', 'resource_reconciliation_incomplete',
    'execution_claim_denied', 'execution_start_denied', 'domain_claim_rejected', 'claimed_and_prepared'
  )),
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  CHECK ((lifecycle='pending' AND outcome IS NULL AND execution_id IS NULL AND intent_id IS NULL AND code IS NULL)
    OR (lifecycle='terminal' AND outcome IS NOT NULL AND code IS NOT NULL AND length(code) BETWEEN 1 AND 64)),
  CHECK ((outcome='claimed' AND execution_id IS NOT NULL AND intent_id IS NOT NULL)
    OR outcome IS NULL OR outcome<>'claimed'),
  CHECK (outcome='claimed' OR (execution_id IS NULL AND intent_id IS NULL)),
  UNIQUE(member_id, run_id),
  UNIQUE(run_id, ordinal),
  UNIQUE(run_id, task_id),
  FOREIGN KEY (run_id, membership_revision) REFERENCES dispatcher_memberships(run_id, membership_revision) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (project_id) REFERENCES project_registry(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (execution_id) REFERENCES execution_attempts(execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (intent_id) REFERENCES execution_operation_intents(intent_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE dispatcher_member_denial_requests (
  request_id TEXT PRIMARY KEY NOT NULL CHECK (length(request_id) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  run_id TEXT NOT NULL CHECK (length(run_id) BETWEEN 1 AND 128),
  member_id TEXT NOT NULL CHECK (length(member_id) BETWEEN 1 AND 128),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action='execution.start'),
  target_execution_id TEXT NOT NULL CHECK (length(target_execution_id) BETWEEN 1 AND 128),
  target_revision INTEGER NOT NULL CHECK (target_revision=1),
  result TEXT NOT NULL CHECK (result='deny'),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  UNIQUE(member_id, action),
  FOREIGN KEY (member_id, run_id) REFERENCES dispatcher_members(member_id, run_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE dispatcher_member_denial_decisions (
  decision_id TEXT PRIMARY KEY NOT NULL CHECK (length(decision_id) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL UNIQUE,
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action='execution.start'),
  result TEXT NOT NULL CHECK (result='deny'),
  reason TEXT NOT NULL CHECK (reason IN (
    'actor_mismatch', 'action_mismatch', 'scope_mismatch', 'scope_revision_stale',
    'grant_expired', 'grant_not_yet_valid', 'grant_revoked', 'grant_missing', 'policy_denied',
    'confirmation_required'
  )),
  policy_result TEXT NOT NULL CHECK (policy_result IN ('allow', 'deny', 'read_not_applicable')),
  grant_id TEXT,
  grant_revision INTEGER,
  project_id TEXT NOT NULL CHECK (length(project_id) > 0),
  resource_revision INTEGER NOT NULL CHECK (resource_revision > 0),
  config_revision INTEGER NOT NULL CHECK (config_revision > 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK ((grant_id IS NULL AND grant_revision IS NULL) OR (length(grant_id) > 0 AND grant_revision > 0)),
  CHECK ((reason IN ('policy_denied', 'confirmation_required') AND grant_id IS NOT NULL)
    OR (reason NOT IN ('policy_denied', 'confirmation_required') AND grant_id IS NULL)),
  FOREIGN KEY (request_id) REFERENCES dispatcher_member_denial_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (project_id) REFERENCES project_registry(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE dispatcher_member_denial_audit (
  audit_id TEXT PRIMARY KEY NOT NULL CHECK (length(audit_id) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL UNIQUE,
  decision_id TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL CHECK (length(run_id) BETWEEN 1 AND 128),
  member_id TEXT NOT NULL CHECK (length(member_id) BETWEEN 1 AND 128),
  event_kind TEXT NOT NULL CHECK (event_kind='authorization.denied'),
  result TEXT NOT NULL CHECK (result='denied'),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  target_execution_id TEXT NOT NULL CHECK (length(target_execution_id) BETWEEN 1 AND 128),
  target_revision INTEGER NOT NULL CHECK (target_revision=1),
  code TEXT NOT NULL CHECK (code IN (
    'actor_mismatch', 'action_mismatch', 'scope_mismatch', 'scope_revision_stale',
    'grant_expired', 'grant_not_yet_valid', 'grant_revoked', 'grant_missing', 'policy_denied',
    'confirmation_required'
  )),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  FOREIGN KEY (request_id) REFERENCES dispatcher_member_denial_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (decision_id) REFERENCES dispatcher_member_denial_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (member_id, run_id) REFERENCES dispatcher_members(member_id, run_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE dispatcher_run_summaries (
  run_id TEXT PRIMARY KEY NOT NULL,
  membership_revision INTEGER NOT NULL CHECK (membership_revision > 0),
  expected_member_count INTEGER NOT NULL CHECK (expected_member_count >= 0),
  claimed_count INTEGER NOT NULL CHECK (claimed_count >= 0),
  already_claimed_count INTEGER NOT NULL CHECK (already_claimed_count >= 0),
  ineligible_count INTEGER NOT NULL CHECK (ineligible_count >= 0),
  authorization_denied_count INTEGER NOT NULL CHECK (authorization_denied_count >= 0),
  policy_deferred_count INTEGER NOT NULL CHECK (policy_deferred_count >= 0),
  resource_deferred_count INTEGER NOT NULL CHECK (resource_deferred_count >= 0),
  reconciliation_required_count INTEGER NOT NULL CHECK (reconciliation_required_count >= 0),
  failed_count INTEGER NOT NULL CHECK (failed_count >= 0),
  terminal_status TEXT NOT NULL CHECK (terminal_status IN ('completed', 'partial', 'failed', 'interrupted')),
  owner_revision INTEGER NOT NULL CHECK (owner_revision > 0),
  run_revision INTEGER NOT NULL CHECK (run_revision > 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK (expected_member_count = claimed_count + already_claimed_count + ineligible_count + authorization_denied_count
    + policy_deferred_count + resource_deferred_count + reconciliation_required_count + failed_count),
  FOREIGN KEY (run_id, membership_revision) REFERENCES dispatcher_memberships(run_id, membership_revision) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TRIGGER authorization_capability_epochs_v7_no_update BEFORE UPDATE ON authorization_capability_epochs_v7 BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v7 capability epochs are immutable');
END;
CREATE TRIGGER authorization_capability_epochs_v7_no_delete BEFORE DELETE ON authorization_capability_epochs_v7 BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v7 capability epochs cannot be deleted');
END;

CREATE TRIGGER authorization_grants_v7_revoke_only
BEFORE UPDATE ON authorization_grants_v7
WHEN NEW.grant_id <> OLD.grant_id OR NEW.actor_id <> OLD.actor_id OR NEW.action <> OLD.action
  OR NEW.scope_kind <> OLD.scope_kind OR NEW.scope_project_id IS NOT OLD.scope_project_id
  OR NEW.scope_resource_revision IS NOT OLD.scope_resource_revision OR NEW.scope_config_revision IS NOT OLD.scope_config_revision
  OR NEW.not_before <> OLD.not_before OR NEW.expires_at <> OLD.expires_at
  OR NEW.issuer_grant_id IS NOT OLD.issuer_grant_id OR NEW.source_grant_id IS NOT OLD.source_grant_id
  OR NEW.capability_epoch_id IS NOT OLD.capability_epoch_id OR NEW.created_request_id <> OLD.created_request_id
  OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoked_request_id IS NULL
  OR NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v7 grants allow one irreversible CAS revocation only');
END;
CREATE TRIGGER authorization_grants_v7_no_delete BEFORE DELETE ON authorization_grants_v7 BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v7 grants cannot be deleted');
END;

CREATE TRIGGER authorization_grant_epoch_v7_legacy_links_insert_guard
BEFORE INSERT ON authorization_grant_epoch_v7_legacy_links
WHEN NOT EXISTS (
  SELECT 1 FROM authorization_grants AS grant_record
  JOIN authorization_capability_epochs_v7 AS epoch ON epoch.epoch_id=NEW.capability_epoch_id
  WHERE grant_record.grant_id=NEW.grant_id AND grant_record.action=NEW.action
    AND grant_record.capability_epoch_id IS NULL AND grant_record.issuer_grant_id IS NULL
    AND grant_record.source_grant_id IS NULL AND grant_record.created_request_id=epoch.request_id
    AND grant_record.actor_id=epoch.actor_id AND grant_record.not_before=epoch.created_at
    AND grant_record.expires_at=epoch.expires_at
)
BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v7 legacy grant link must bind one matching origin grant and epoch');
END;

CREATE TRIGGER authorization_grant_epoch_v7_v6_links_insert_guard
BEFORE INSERT ON authorization_grant_epoch_v7_v6_links
WHEN NOT EXISTS (
  SELECT 1 FROM authorization_grants_v6 AS grant_record
  JOIN authorization_capability_epochs_v7 AS epoch ON epoch.epoch_id=NEW.capability_epoch_id
  WHERE grant_record.grant_id=NEW.grant_id AND grant_record.action=NEW.action
    AND grant_record.capability_epoch_id IS NULL AND grant_record.issuer_grant_id IS NULL
    AND grant_record.source_grant_id IS NULL AND grant_record.created_request_id=epoch.request_id
    AND grant_record.actor_id=epoch.actor_id AND grant_record.not_before=epoch.created_at
    AND grant_record.expires_at=epoch.expires_at
)
BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v7 v6 grant link must bind one matching origin grant and epoch');
END;

CREATE TRIGGER authorization_grant_epoch_v7_legacy_links_no_update BEFORE UPDATE ON authorization_grant_epoch_v7_legacy_links BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v7 legacy grant links are immutable');
END;
CREATE TRIGGER authorization_grant_epoch_v7_legacy_links_no_delete BEFORE DELETE ON authorization_grant_epoch_v7_legacy_links BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v7 legacy grant links cannot be deleted');
END;
CREATE TRIGGER authorization_grant_epoch_v7_v6_links_no_update BEFORE UPDATE ON authorization_grant_epoch_v7_v6_links BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v7 v6 grant links are immutable');
END;
CREATE TRIGGER authorization_grant_epoch_v7_v6_links_no_delete BEFORE DELETE ON authorization_grant_epoch_v7_v6_links BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v7 v6 grant links cannot be deleted');
END;
CREATE TRIGGER application_lifecycle_digest_v7_no_update BEFORE UPDATE ON application_lifecycle_digest_v7 BEGIN
  SELECT RAISE(ABORT, 'lifecycle digest provenance is immutable');
END;
CREATE TRIGGER application_lifecycle_digest_v7_no_delete BEFORE DELETE ON application_lifecycle_digest_v7 BEGIN
  SELECT RAISE(ABORT, 'lifecycle digest provenance cannot be deleted');
END;

CREATE TRIGGER dispatcher_trigger_requests_no_update BEFORE UPDATE ON dispatcher_trigger_requests BEGIN
  SELECT RAISE(ABORT, 'dispatcher trigger requests are append-only');
END;
CREATE TRIGGER dispatcher_trigger_requests_no_delete BEFORE DELETE ON dispatcher_trigger_requests BEGIN
  SELECT RAISE(ABORT, 'dispatcher trigger requests are append-only');
END;
CREATE TRIGGER dispatcher_authorization_decisions_no_update BEFORE UPDATE ON dispatcher_authorization_decisions BEGIN
  SELECT RAISE(ABORT, 'dispatcher authorization decisions are append-only');
END;
CREATE TRIGGER dispatcher_authorization_decisions_no_delete BEFORE DELETE ON dispatcher_authorization_decisions BEGIN
  SELECT RAISE(ABORT, 'dispatcher authorization decisions are append-only');
END;
CREATE TRIGGER dispatcher_audit_no_update BEFORE UPDATE ON dispatcher_audit BEGIN
  SELECT RAISE(ABORT, 'dispatcher audit is append-only');
END;
CREATE TRIGGER dispatcher_audit_no_delete BEFORE DELETE ON dispatcher_audit BEGIN
  SELECT RAISE(ABORT, 'dispatcher audit is append-only');
END;
CREATE TRIGGER dispatcher_reconciliation_items_no_update BEFORE UPDATE ON dispatcher_reconciliation_items BEGIN
  SELECT RAISE(ABORT, 'dispatcher reconciliation items are immutable');
END;
CREATE TRIGGER dispatcher_reconciliation_items_no_delete BEFORE DELETE ON dispatcher_reconciliation_items BEGIN
  SELECT RAISE(ABORT, 'dispatcher reconciliation items are immutable');
END;
CREATE TRIGGER dispatcher_reconciliation_summaries_no_update BEFORE UPDATE ON dispatcher_reconciliation_summaries BEGIN
  SELECT RAISE(ABORT, 'dispatcher reconciliation summaries are immutable');
END;
CREATE TRIGGER dispatcher_reconciliation_summaries_no_delete BEFORE DELETE ON dispatcher_reconciliation_summaries BEGIN
  SELECT RAISE(ABORT, 'dispatcher reconciliation summaries are immutable');
END;
CREATE TRIGGER dispatcher_memberships_no_update BEFORE UPDATE ON dispatcher_memberships BEGIN
  SELECT RAISE(ABORT, 'dispatcher memberships are immutable');
END;
CREATE TRIGGER dispatcher_memberships_no_delete BEFORE DELETE ON dispatcher_memberships BEGIN
  SELECT RAISE(ABORT, 'dispatcher memberships are immutable');
END;
CREATE TRIGGER dispatcher_run_summaries_no_update BEFORE UPDATE ON dispatcher_run_summaries BEGIN
  SELECT RAISE(ABORT, 'dispatcher run summaries are immutable');
END;
CREATE TRIGGER dispatcher_run_summaries_no_delete BEFORE DELETE ON dispatcher_run_summaries BEGIN
  SELECT RAISE(ABORT, 'dispatcher run summaries are immutable');
END;

CREATE TRIGGER dispatcher_runs_update_guard
BEFORE UPDATE ON dispatcher_runs
WHEN NEW.run_id<>OLD.run_id OR NEW.observation_id<>OLD.observation_id OR NEW.request_id<>OLD.request_id
  OR NEW.decision_id<>OLD.decision_id OR NEW.actor_id<>OLD.actor_id
  OR NEW.requested_lease_seconds<>OLD.requested_lease_seconds OR NEW.created_at<>OLD.created_at
  OR NEW.run_revision<>OLD.run_revision+1 OR NEW.updated_at<=OLD.updated_at
  OR NEW.heartbeat_at<=OLD.heartbeat_at OR NEW.lease_expires_at<=OLD.lease_expires_at
  OR NOT (
    (NEW.owner_id=OLD.owner_id AND NEW.owner_revision=OLD.owner_revision)
    OR (NEW.owner_id<>OLD.owner_id AND NEW.owner_revision=OLD.owner_revision+1 AND NEW.updated_at>=OLD.lease_expires_at)
  )
  OR OLD.status IN ('completed', 'partial', 'failed', 'interrupted')
  OR NOT (
    NEW.status=OLD.status
    OR (OLD.status='starting' AND NEW.status='reconciling')
    OR (OLD.status='reconciling' AND NEW.status IN ('sweeping', 'failed', 'interrupted'))
    OR (OLD.status='sweeping' AND NEW.status IN ('completed', 'partial', 'failed', 'interrupted'))
  )
BEGIN
  SELECT RAISE(ABORT, 'dispatcher run update violates identity, lease, ownership, revision or lifecycle');
END;
CREATE TRIGGER dispatcher_runs_no_delete BEFORE DELETE ON dispatcher_runs BEGIN
  SELECT RAISE(ABORT, 'dispatcher runs cannot be deleted');
END;

CREATE TRIGGER dispatcher_reconciliation_summaries_insert_guard
BEFORE INSERT ON dispatcher_reconciliation_summaries
WHEN NEW.expected_count<>(SELECT count(*) FROM dispatcher_reconciliation_items WHERE run_id=NEW.run_id)
  OR NEW.reconciled_count<>(SELECT count(*) FROM dispatcher_reconciliation_items WHERE run_id=NEW.run_id AND disposition='reconciled')
  OR NEW.no_effect_count<>(SELECT count(*) FROM dispatcher_reconciliation_items WHERE run_id=NEW.run_id AND disposition='no_effect')
  OR NEW.authorization_denied_count<>(SELECT count(*) FROM dispatcher_reconciliation_items WHERE run_id=NEW.run_id AND disposition='authorization_denied')
  OR NEW.ambiguous_count<>(SELECT count(*) FROM dispatcher_reconciliation_items WHERE run_id=NEW.run_id AND disposition='ambiguous')
  OR NEW.failed_count<>(SELECT count(*) FROM dispatcher_reconciliation_items WHERE run_id=NEW.run_id AND disposition='failed')
  OR (NEW.expected_count>0 AND (SELECT min(ordinal) FROM dispatcher_reconciliation_items WHERE run_id=NEW.run_id)<>0)
  OR (NEW.expected_count>0 AND (SELECT max(ordinal) FROM dispatcher_reconciliation_items WHERE run_id=NEW.run_id)<>NEW.expected_count-1)
BEGIN
  SELECT RAISE(ABORT, 'dispatcher reconciliation summary is incomplete');
END;

CREATE TRIGGER dispatcher_memberships_insert_guard
BEFORE INSERT ON dispatcher_memberships
WHEN NOT EXISTS (SELECT 1 FROM dispatcher_reconciliation_summaries WHERE run_id=NEW.run_id)
BEGIN
  SELECT RAISE(ABORT, 'dispatcher membership requires durable reconciliation summary');
END;

CREATE TRIGGER dispatcher_members_terminal_guard
BEFORE UPDATE ON dispatcher_members
WHEN NEW.member_id<>OLD.member_id OR NEW.run_id<>OLD.run_id OR NEW.membership_revision<>OLD.membership_revision
  OR NEW.ordinal<>OLD.ordinal OR NEW.project_id<>OLD.project_id
  OR NEW.project_resource_revision<>OLD.project_resource_revision OR NEW.project_config_revision<>OLD.project_config_revision
  OR NEW.task_id<>OLD.task_id OR NEW.task_revision<>OLD.task_revision OR OLD.lifecycle<>'pending'
  OR NEW.lifecycle<>'terminal' OR NEW.outcome IS NULL OR NEW.code IS NULL
  OR NEW.revision<>OLD.revision+1 OR NEW.created_at<>OLD.created_at OR NEW.updated_at<=OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'dispatcher member permits one exact terminal CAS');
END;
CREATE TRIGGER dispatcher_members_no_delete BEFORE DELETE ON dispatcher_members BEGIN
  SELECT RAISE(ABORT, 'dispatcher members cannot be deleted');
END;

CREATE TRIGGER dispatcher_member_denial_requests_no_update BEFORE UPDATE ON dispatcher_member_denial_requests BEGIN
  SELECT RAISE(ABORT, 'dispatcher member denial requests are immutable');
END;
CREATE TRIGGER dispatcher_member_denial_requests_no_delete BEFORE DELETE ON dispatcher_member_denial_requests BEGIN
  SELECT RAISE(ABORT, 'dispatcher member denial requests are immutable');
END;
CREATE TRIGGER dispatcher_member_denial_decisions_no_update BEFORE UPDATE ON dispatcher_member_denial_decisions BEGIN
  SELECT RAISE(ABORT, 'dispatcher member denial decisions are immutable');
END;
CREATE TRIGGER dispatcher_member_denial_decisions_no_delete BEFORE DELETE ON dispatcher_member_denial_decisions BEGIN
  SELECT RAISE(ABORT, 'dispatcher member denial decisions are immutable');
END;
CREATE TRIGGER dispatcher_member_denial_audit_no_update BEFORE UPDATE ON dispatcher_member_denial_audit BEGIN
  SELECT RAISE(ABORT, 'dispatcher member denial audit is immutable');
END;
CREATE TRIGGER dispatcher_member_denial_audit_no_delete BEFORE DELETE ON dispatcher_member_denial_audit BEGIN
  SELECT RAISE(ABORT, 'dispatcher member denial audit is immutable');
END;

CREATE TRIGGER dispatcher_run_summaries_insert_guard
BEFORE INSERT ON dispatcher_run_summaries
WHEN NEW.expected_member_count<>(SELECT expected_member_count FROM dispatcher_memberships WHERE run_id=NEW.run_id)
  OR NEW.expected_member_count<>(SELECT count(*) FROM dispatcher_members WHERE run_id=NEW.run_id)
  OR NEW.expected_member_count<>(SELECT count(DISTINCT task_id) FROM dispatcher_members WHERE run_id=NEW.run_id)
  OR NEW.expected_member_count<>(SELECT count(*) FROM dispatcher_members WHERE run_id=NEW.run_id AND lifecycle='terminal')
  OR (NEW.expected_member_count>0 AND (SELECT min(ordinal) FROM dispatcher_members WHERE run_id=NEW.run_id)<>0)
  OR (NEW.expected_member_count>0 AND (SELECT max(ordinal) FROM dispatcher_members WHERE run_id=NEW.run_id)<>NEW.expected_member_count-1)
  OR NEW.claimed_count<>(SELECT count(*) FROM dispatcher_members WHERE run_id=NEW.run_id AND outcome='claimed')
  OR NEW.already_claimed_count<>(SELECT count(*) FROM dispatcher_members WHERE run_id=NEW.run_id AND outcome='already_claimed')
  OR NEW.ineligible_count<>(SELECT count(*) FROM dispatcher_members WHERE run_id=NEW.run_id AND outcome='ineligible_at_cas')
  OR NEW.authorization_denied_count<>(SELECT count(*) FROM dispatcher_members WHERE run_id=NEW.run_id AND outcome='authorization_denied')
  OR NEW.policy_deferred_count<>(SELECT count(*) FROM dispatcher_members WHERE run_id=NEW.run_id AND outcome='policy_deferred')
  OR NEW.resource_deferred_count<>(SELECT count(*) FROM dispatcher_members WHERE run_id=NEW.run_id AND outcome='resource_deferred')
  OR NEW.reconciliation_required_count<>(SELECT count(*) FROM dispatcher_members WHERE run_id=NEW.run_id AND outcome='reconciliation_required')
  OR NEW.failed_count<>(SELECT count(*) FROM dispatcher_members WHERE run_id=NEW.run_id AND outcome='failed')
  OR EXISTS (
    SELECT 1 FROM dispatcher_members AS member
    WHERE member.run_id=NEW.run_id AND member.outcome='claimed'
      AND (member.execution_id IS NULL OR member.intent_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM execution_attempts WHERE execution_id=member.execution_id)
        OR NOT EXISTS (SELECT 1 FROM execution_operation_intents
          WHERE intent_id=member.intent_id AND execution_id=member.execution_id AND state='finalized'))
  )
  OR EXISTS (
    SELECT 1 FROM dispatcher_members AS member
    WHERE member.run_id=NEW.run_id AND member.code='execution_start_denied'
      AND NOT EXISTS (SELECT 1 FROM dispatcher_member_denial_requests AS denial
        WHERE denial.run_id=member.run_id AND denial.member_id=member.member_id)
  )
BEGIN
  SELECT RAISE(ABORT, 'dispatcher run summary is incomplete or inconsistent');
END;

CREATE TEMP TABLE ep02c_migration_assertion (ok INTEGER NOT NULL CHECK (ok=1)) STRICT;
INSERT INTO ep02c_migration_assertion
SELECT NOT EXISTS (SELECT 1 FROM authorization_capability_epochs_v7)
  AND NOT EXISTS (SELECT 1 FROM authorization_grants_v7)
  AND NOT EXISTS (SELECT 1 FROM authorization_grant_epoch_v7_legacy_links)
  AND NOT EXISTS (SELECT 1 FROM authorization_grant_epoch_v7_v6_links)
  AND NOT EXISTS (SELECT 1 FROM application_lifecycle_digest_v7)
  AND NOT EXISTS (SELECT 1 FROM dispatcher_trigger_requests)
  AND NOT EXISTS (SELECT 1 FROM dispatcher_authorization_decisions)
  AND NOT EXISTS (SELECT 1 FROM dispatcher_runs)
  AND NOT EXISTS (SELECT 1 FROM dispatcher_audit)
  AND NOT EXISTS (SELECT 1 FROM dispatcher_reconciliation_items)
  AND NOT EXISTS (SELECT 1 FROM dispatcher_reconciliation_summaries)
  AND NOT EXISTS (SELECT 1 FROM dispatcher_memberships)
  AND NOT EXISTS (SELECT 1 FROM dispatcher_members)
  AND NOT EXISTS (SELECT 1 FROM dispatcher_member_denial_requests)
  AND NOT EXISTS (SELECT 1 FROM dispatcher_member_denial_decisions)
  AND NOT EXISTS (SELECT 1 FROM dispatcher_member_denial_audit)
  AND NOT EXISTS (SELECT 1 FROM dispatcher_run_summaries)
  AND NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check);
DROP TABLE ep02c_migration_assertion;
