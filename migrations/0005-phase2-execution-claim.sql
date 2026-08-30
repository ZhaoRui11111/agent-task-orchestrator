PRAGMA defer_foreign_keys=ON;

DROP TRIGGER application_requests_no_update;
DROP TRIGGER application_requests_no_delete;
DROP TRIGGER authorization_bootstrap_no_update;
DROP TRIGGER authorization_bootstrap_no_delete;
DROP TRIGGER authorization_local_identity_no_update;
DROP TRIGGER authorization_local_identity_no_delete;
DROP TRIGGER authorization_capability_epochs_no_update;
DROP TRIGGER authorization_capability_epochs_no_delete;
DROP TRIGGER authorization_grants_revoke_only;
DROP TRIGGER authorization_grants_no_delete;
DROP TRIGGER authorization_decisions_no_update;
DROP TRIGGER authorization_decisions_no_delete;
DROP TRIGGER application_audit_no_update;
DROP TRIGGER application_audit_no_delete;
DROP TRIGGER application_lifecycle_authorizations_no_update;
DROP TRIGGER application_lifecycle_authorizations_no_delete;
DROP INDEX authorization_grants_actor_action_index;
DROP INDEX authorization_grants_project_index;

ALTER TABLE application_lifecycle_authorizations RENAME TO application_lifecycle_authorizations_v4;
ALTER TABLE application_audit RENAME TO application_audit_v4;
ALTER TABLE authorization_decisions RENAME TO authorization_decisions_v4;
ALTER TABLE authorization_grants RENAME TO authorization_grants_v4;
ALTER TABLE authorization_capability_epochs RENAME TO authorization_capability_epochs_v4;
ALTER TABLE authorization_local_identity RENAME TO authorization_local_identity_v4;
ALTER TABLE authorization_bootstrap RENAME TO authorization_bootstrap_v4;
ALTER TABLE application_requests RENAME TO application_requests_v4;

CREATE TABLE application_requests (
  request_id TEXT PRIMARY KEY CHECK (length(request_id) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action IN (
    'authorization.grant.issue', 'authorization.grant.inspect', 'authorization.grant.revoke',
    'policy.evaluate', 'project.register', 'project.update', 'project.disable', 'project.inspect',
    'task.create', 'task.update', 'task.mark_ready', 'task.cancel', 'task.inspect',
    'dependency.add', 'dependency.remove', 'authorization.grant.list', 'runtime.status',
    'runtime.backup', 'runtime.restore', 'execution.claim', 'execution.claim.inspect',
    'execution.lease.renew', 'execution.lease.takeover',
    'authorization.capability.renew', 'authorization.capability.upgrade'
  )),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('runtime', 'project', 'task', 'grant', 'backup', 'execution')),
  target_id TEXT NOT NULL CHECK (length(target_id) > 0),
  target_revision INTEGER CHECK (target_revision IS NULL OR target_revision > 0),
  result TEXT NOT NULL CHECK (result IN ('bootstrap', 'allow', 'deny', 'renewal', 'upgrade')),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK (result <> 'bootstrap' OR (action = 'authorization.grant.issue' AND target_kind = 'runtime' AND target_id = 'runtime' AND target_revision IS NULL)),
  CHECK (
    (action = 'authorization.capability.renew' AND result = 'renewal' AND target_kind = 'runtime' AND target_id = 'runtime' AND target_revision IS NULL)
    OR (action <> 'authorization.capability.renew' AND result <> 'renewal')
  ),
  CHECK (
    (action = 'authorization.capability.upgrade' AND result = 'upgrade' AND target_kind = 'runtime' AND target_id = 'runtime' AND target_revision IS NULL)
    OR (action <> 'authorization.capability.upgrade' AND result <> 'upgrade')
  )
) STRICT;

CREATE TABLE authorization_bootstrap (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  trusted_principal TEXT NOT NULL CHECK (length(trusted_principal) BETWEEN 1 AND 256),
  runtime_root TEXT NOT NULL CHECK (length(runtime_root) > 0),
  runtime_root_key TEXT NOT NULL CHECK (length(runtime_root_key) > 0),
  runtime_platform TEXT NOT NULL CHECK (length(runtime_platform) > 0),
  runtime_device TEXT NOT NULL CHECK (length(runtime_device) > 0),
  runtime_inode TEXT NOT NULL CHECK (length(runtime_inode) > 0),
  runtime_mode INTEGER NOT NULL CHECK (runtime_mode >= 0),
  request_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  expires_at TEXT NOT NULL CHECK (length(expires_at) > 0),
  vocabulary_version INTEGER NOT NULL DEFAULT 4 CHECK (vocabulary_version IN (3, 4)),
  UNIQUE(actor_id, runtime_root_key),
  FOREIGN KEY (request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE authorization_local_identity (
  singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
  identity_version INTEGER NOT NULL CHECK (identity_version = 1),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  principal_sha256 TEXT NOT NULL CHECK (length(principal_sha256) = 64 AND principal_sha256 NOT GLOB '*[^0-9A-F]*'),
  platform TEXT NOT NULL CHECK (length(platform) BETWEEN 1 AND 32),
  runtime_root_key TEXT NOT NULL CHECK (length(runtime_root_key) > 0),
  bootstrap_request_id TEXT NOT NULL UNIQUE,
  adoption_request_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  UNIQUE(actor_id, runtime_root_key),
  FOREIGN KEY (bootstrap_request_id) REFERENCES authorization_bootstrap(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (adoption_request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE authorization_capability_epochs (
  epoch_id TEXT PRIMARY KEY NOT NULL CHECK (length(epoch_id) BETWEEN 1 AND 128),
  epoch_revision INTEGER NOT NULL UNIQUE CHECK (epoch_revision > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  runtime_root_key TEXT NOT NULL CHECK (length(runtime_root_key) > 0),
  vocabulary_version INTEGER NOT NULL CHECK (vocabulary_version IN (4, 5)),
  action_set_sha256 TEXT NOT NULL CHECK (length(action_set_sha256) = 64 AND action_set_sha256 NOT GLOB '*[^0-9A-F]*'),
  request_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  expires_at TEXT NOT NULL CHECK (length(expires_at) > 0),
  UNIQUE(epoch_id, request_id),
  FOREIGN KEY (actor_id, runtime_root_key) REFERENCES authorization_local_identity(actor_id, runtime_root_key) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE authorization_grants (
  grant_id TEXT PRIMARY KEY CHECK (length(grant_id) BETWEEN 1 AND 128),
  revision INTEGER NOT NULL CHECK (revision > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action IN (
    'authorization.grant.issue', 'authorization.grant.inspect', 'authorization.grant.revoke',
    'policy.evaluate', 'project.register', 'project.update', 'project.disable', 'project.inspect',
    'task.create', 'task.update', 'task.mark_ready', 'task.cancel', 'task.inspect',
    'dependency.add', 'dependency.remove', 'authorization.grant.list', 'runtime.status',
    'runtime.backup', 'runtime.restore', 'execution.claim', 'execution.claim.inspect',
    'execution.lease.renew', 'execution.lease.takeover'
  )),
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
    OR
    (scope_kind = 'project' AND length(scope_project_id) > 0 AND scope_resource_revision > 0 AND scope_config_revision > 0)
  ),
  CHECK (revoked_at IS NULL OR length(revoked_at) > 0),
  CHECK (
    (issuer_grant_id IS NULL AND source_grant_id IS NULL AND capability_epoch_id IS NULL)
    OR (issuer_grant_id IS NOT NULL AND source_grant_id IS NOT NULL AND capability_epoch_id IS NULL)
    OR (issuer_grant_id IS NULL AND source_grant_id IS NULL AND capability_epoch_id IS NOT NULL)
  ),
  CHECK ((revoked_at IS NULL AND revoked_request_id IS NULL) OR (revoked_at IS NOT NULL AND revoked_request_id IS NOT NULL)),
  UNIQUE(capability_epoch_id, action),
  FOREIGN KEY (scope_project_id) REFERENCES project_registry(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (issuer_grant_id) REFERENCES authorization_grants(grant_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (source_grant_id) REFERENCES authorization_grants(grant_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (capability_epoch_id) REFERENCES authorization_capability_epochs(epoch_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (created_request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (revoked_request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE INDEX authorization_grants_actor_action_index
  ON authorization_grants(actor_id, action, grant_id);
CREATE INDEX authorization_grants_project_index
  ON authorization_grants(scope_project_id, action, grant_id)
  WHERE scope_project_id IS NOT NULL;

CREATE TABLE authorization_decisions (
  decision_id TEXT PRIMARY KEY CHECK (length(decision_id) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL UNIQUE,
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action IN (
    'authorization.grant.issue', 'authorization.grant.inspect', 'authorization.grant.revoke',
    'policy.evaluate', 'project.register', 'project.update', 'project.disable', 'project.inspect',
    'task.create', 'task.update', 'task.mark_ready', 'task.cancel', 'task.inspect',
    'dependency.add', 'dependency.remove', 'authorization.grant.list', 'runtime.status',
    'runtime.backup', 'runtime.restore', 'execution.claim', 'execution.claim.inspect',
    'execution.lease.renew', 'execution.lease.takeover',
    'authorization.capability.renew', 'authorization.capability.upgrade'
  )),
  result TEXT NOT NULL CHECK (result IN ('allow', 'deny')),
  reason TEXT NOT NULL CHECK (reason IN (
    'allowed', 'actor_mismatch', 'action_mismatch', 'scope_mismatch', 'scope_revision_stale',
    'grant_expired', 'grant_not_yet_valid', 'grant_revoked', 'grant_missing', 'policy_denied',
    'confirmation_required'
  )),
  policy_result TEXT NOT NULL CHECK (policy_result IN ('allow', 'deny', 'read_not_applicable')),
  grant_id TEXT,
  grant_revision INTEGER,
  project_id TEXT,
  resource_revision INTEGER,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK ((grant_id IS NULL AND grant_revision IS NULL) OR (length(grant_id) > 0 AND grant_revision > 0)),
  CHECK ((project_id IS NULL AND resource_revision IS NULL) OR (length(project_id) > 0 AND resource_revision > 0)),
  FOREIGN KEY (request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (grant_id) REFERENCES authorization_grants(grant_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (project_id) REFERENCES project_registry(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE application_audit (
  audit_id TEXT PRIMARY KEY CHECK (length(audit_id) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL UNIQUE,
  decision_id TEXT UNIQUE,
  event_kind TEXT NOT NULL CHECK (event_kind IN (
    'bootstrap', 'grant.issued', 'grant.revoked', 'grant.inspected', 'grant.listed',
    'project.registered', 'project.updated', 'project.disabled', 'project.inspected',
    'task.created', 'task.updated', 'task.ready', 'task.cancelled', 'task.inspected',
    'dependency.added', 'dependency.removed', 'policy.evaluated', 'authorization.denied',
    'capability.renewed', 'capability.upgraded', 'runtime.status.inspected',
    'backup.authorized', 'restore.authorized', 'execution.claimed',
    'execution.claim.inspected', 'execution.lease.renewed', 'execution.lease.taken_over'
  )),
  result TEXT NOT NULL CHECK (result IN ('accepted', 'denied')),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('runtime', 'project', 'task', 'grant', 'backup', 'execution')),
  target_id TEXT NOT NULL CHECK (length(target_id) > 0),
  target_revision INTEGER CHECK (target_revision IS NULL OR target_revision > 0),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 64),
  details_json TEXT NOT NULL CHECK (length(details_json) BETWEEN 2 AND 1024),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK ((result = 'denied' AND decision_id IS NOT NULL) OR result = 'accepted'),
  FOREIGN KEY (request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (decision_id) REFERENCES authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE application_lifecycle_authorizations (
  authorization_id TEXT PRIMARY KEY NOT NULL CHECK (length(authorization_id) BETWEEN 1 AND 128),
  operation TEXT NOT NULL CHECK (operation IN ('runtime.backup', 'runtime.restore')),
  backup_generation_id TEXT NOT NULL CHECK (length(backup_generation_id) BETWEEN 1 AND 128),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  runtime_root_key TEXT NOT NULL CHECK (length(runtime_root_key) > 0),
  grant_id TEXT NOT NULL CHECK (length(grant_id) BETWEEN 1 AND 128),
  grant_revision INTEGER NOT NULL CHECK (grant_revision > 0),
  request_id TEXT NOT NULL UNIQUE,
  decision_id TEXT NOT NULL UNIQUE,
  audit_id TEXT NOT NULL UNIQUE,
  authorized_state_sha256 TEXT NOT NULL CHECK (length(authorized_state_sha256) = 64 AND authorized_state_sha256 NOT GLOB '*[^0-9A-F]*'),
  state_digest_version INTEGER NOT NULL CHECK (state_digest_version IN (1, 2)),
  expected_request_count INTEGER NOT NULL CHECK (expected_request_count >= 1),
  expected_decision_count INTEGER NOT NULL CHECK (expected_decision_count >= 1),
  expected_audit_count INTEGER NOT NULL CHECK (expected_audit_count >= 1),
  issued_at TEXT NOT NULL CHECK (length(issued_at) > 0),
  expires_at TEXT NOT NULL CHECK (length(expires_at) > 0),
  FOREIGN KEY (actor_id, runtime_root_key) REFERENCES authorization_local_identity(actor_id, runtime_root_key) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (grant_id) REFERENCES authorization_grants(grant_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (decision_id) REFERENCES authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (audit_id) REFERENCES application_audit(audit_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE task_execution_sequences (
  task_id TEXT PRIMARY KEY NOT NULL CHECK (length(task_id) > 0),
  last_attempt_number INTEGER NOT NULL CHECK (last_attempt_number > 0),
  current_fencing_token INTEGER NOT NULL CHECK (current_fencing_token > 0),
  revision INTEGER NOT NULL CHECK (revision > 0),
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE execution_attempts (
  execution_id TEXT PRIMARY KEY NOT NULL CHECK (length(execution_id) BETWEEN 1 AND 128),
  task_id TEXT NOT NULL CHECK (length(task_id) > 0),
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  operation_kind TEXT NOT NULL CHECK (operation_kind IN ('claim', 'takeover')),
  status TEXT NOT NULL CHECK (status IN ('active', 'superseded')),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  owner_id TEXT NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 128),
  requested_lease_seconds INTEGER NOT NULL CHECK (requested_lease_seconds BETWEEN 30 AND 3600),
  predecessor_execution_revision INTEGER CHECK (predecessor_execution_revision > 0),
  predecessor_lease_revision INTEGER CHECK (predecessor_lease_revision > 0),
  predecessor_fencing_token INTEGER CHECK (predecessor_fencing_token > 0),
  lease_revision INTEGER NOT NULL CHECK (lease_revision > 0),
  lease_expires_at TEXT NOT NULL CHECK (length(lease_expires_at) > 0),
  fencing_token INTEGER NOT NULL CHECK (fencing_token > 0),
  revision INTEGER NOT NULL CHECK (revision > 0),
  expected_task_revision INTEGER NOT NULL CHECK (expected_task_revision > 0),
  pre_task_revision INTEGER NOT NULL CHECK (pre_task_revision > 0),
  post_task_revision INTEGER NOT NULL CHECK (post_task_revision > 0),
  project_resource_revision INTEGER NOT NULL CHECK (project_resource_revision > 0),
  project_config_revision INTEGER NOT NULL CHECK (project_config_revision > 0),
  request_id TEXT NOT NULL UNIQUE,
  decision_id TEXT NOT NULL UNIQUE,
  supersedes_execution_id TEXT,
  superseded_by_execution_id TEXT UNIQUE,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  UNIQUE(task_id, attempt_number),
  UNIQUE(task_id, fencing_token),
  CHECK (expected_task_revision = pre_task_revision),
  CHECK (
    (operation_kind = 'claim' AND attempt_number = 1 AND post_task_revision = pre_task_revision + 1
      AND supersedes_execution_id IS NULL AND predecessor_execution_revision IS NULL
      AND predecessor_lease_revision IS NULL AND predecessor_fencing_token IS NULL)
    OR
    (operation_kind = 'takeover' AND attempt_number > 1 AND post_task_revision = pre_task_revision
      AND supersedes_execution_id IS NOT NULL AND predecessor_execution_revision IS NOT NULL
      AND predecessor_lease_revision IS NOT NULL AND predecessor_fencing_token IS NOT NULL)
  ),
  CHECK (
    (status = 'active' AND superseded_by_execution_id IS NULL)
    OR (status = 'superseded' AND superseded_by_execution_id IS NOT NULL)
  ),
  FOREIGN KEY (task_id) REFERENCES task_execution_sequences(task_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (decision_id) REFERENCES authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (supersedes_execution_id) REFERENCES execution_attempts(execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (superseded_by_execution_id) REFERENCES execution_attempts(execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE UNIQUE INDEX execution_attempts_one_active_per_task
  ON execution_attempts(task_id) WHERE status = 'active';
CREATE INDEX execution_attempts_task_order
  ON execution_attempts(task_id, attempt_number, execution_id);

INSERT INTO application_requests SELECT * FROM application_requests_v4;
INSERT INTO authorization_bootstrap SELECT * FROM authorization_bootstrap_v4;
INSERT INTO authorization_local_identity SELECT * FROM authorization_local_identity_v4;
INSERT INTO authorization_capability_epochs SELECT * FROM authorization_capability_epochs_v4;
INSERT INTO authorization_grants SELECT * FROM authorization_grants_v4;
INSERT INTO authorization_decisions SELECT * FROM authorization_decisions_v4;
INSERT INTO application_audit SELECT * FROM application_audit_v4;
INSERT INTO application_lifecycle_authorizations(
  authorization_id, operation, backup_generation_id, actor_id, runtime_root_key,
  grant_id, grant_revision, request_id, decision_id, audit_id,
  authorized_state_sha256, state_digest_version, expected_request_count,
  expected_decision_count, expected_audit_count, issued_at, expires_at
)
SELECT authorization_id, operation, backup_generation_id, actor_id, runtime_root_key,
  grant_id, grant_revision, request_id, decision_id, audit_id,
  authorized_state_sha256, 1, expected_request_count, expected_decision_count,
  expected_audit_count, issued_at, expires_at
FROM application_lifecycle_authorizations_v4;

CREATE TEMP TABLE ep02a_migration_assertion (
  ok INTEGER NOT NULL CHECK (ok = 1)
) STRICT;
INSERT INTO ep02a_migration_assertion
SELECT (
  (SELECT count(*) FROM application_requests) = (SELECT count(*) FROM application_requests_v4)
  AND NOT EXISTS (SELECT * FROM application_requests EXCEPT SELECT * FROM application_requests_v4)
  AND NOT EXISTS (SELECT * FROM application_requests_v4 EXCEPT SELECT * FROM application_requests)
  AND (SELECT count(*) FROM authorization_bootstrap) = (SELECT count(*) FROM authorization_bootstrap_v4)
  AND NOT EXISTS (SELECT * FROM authorization_bootstrap EXCEPT SELECT * FROM authorization_bootstrap_v4)
  AND NOT EXISTS (SELECT * FROM authorization_bootstrap_v4 EXCEPT SELECT * FROM authorization_bootstrap)
  AND (SELECT count(*) FROM authorization_local_identity) = (SELECT count(*) FROM authorization_local_identity_v4)
  AND NOT EXISTS (SELECT * FROM authorization_local_identity EXCEPT SELECT * FROM authorization_local_identity_v4)
  AND NOT EXISTS (SELECT * FROM authorization_local_identity_v4 EXCEPT SELECT * FROM authorization_local_identity)
  AND (SELECT count(*) FROM authorization_capability_epochs) = (SELECT count(*) FROM authorization_capability_epochs_v4)
  AND NOT EXISTS (SELECT * FROM authorization_capability_epochs EXCEPT SELECT * FROM authorization_capability_epochs_v4)
  AND NOT EXISTS (SELECT * FROM authorization_capability_epochs_v4 EXCEPT SELECT * FROM authorization_capability_epochs)
  AND (SELECT count(*) FROM authorization_grants) = (SELECT count(*) FROM authorization_grants_v4)
  AND NOT EXISTS (SELECT * FROM authorization_grants EXCEPT SELECT * FROM authorization_grants_v4)
  AND NOT EXISTS (SELECT * FROM authorization_grants_v4 EXCEPT SELECT * FROM authorization_grants)
  AND (SELECT count(*) FROM authorization_decisions) = (SELECT count(*) FROM authorization_decisions_v4)
  AND NOT EXISTS (SELECT * FROM authorization_decisions EXCEPT SELECT * FROM authorization_decisions_v4)
  AND NOT EXISTS (SELECT * FROM authorization_decisions_v4 EXCEPT SELECT * FROM authorization_decisions)
  AND (SELECT count(*) FROM application_audit) = (SELECT count(*) FROM application_audit_v4)
  AND NOT EXISTS (SELECT * FROM application_audit EXCEPT SELECT * FROM application_audit_v4)
  AND NOT EXISTS (SELECT * FROM application_audit_v4 EXCEPT SELECT * FROM application_audit)
  AND (SELECT count(*) FROM application_lifecycle_authorizations) = (SELECT count(*) FROM application_lifecycle_authorizations_v4)
  AND NOT EXISTS (
    SELECT authorization_id, operation, backup_generation_id, actor_id, runtime_root_key,
      grant_id, grant_revision, request_id, decision_id, audit_id,
      authorized_state_sha256, expected_request_count, expected_decision_count,
      expected_audit_count, issued_at, expires_at
    FROM application_lifecycle_authorizations
    EXCEPT SELECT * FROM application_lifecycle_authorizations_v4
  )
  AND NOT EXISTS (
    SELECT * FROM application_lifecycle_authorizations_v4
    EXCEPT SELECT authorization_id, operation, backup_generation_id, actor_id, runtime_root_key,
      grant_id, grant_revision, request_id, decision_id, audit_id,
      authorized_state_sha256, expected_request_count, expected_decision_count,
      expected_audit_count, issued_at, expires_at
    FROM application_lifecycle_authorizations
  )
  AND NOT EXISTS (SELECT 1 FROM application_lifecycle_authorizations WHERE state_digest_version <> 1)
  AND NOT EXISTS (SELECT 1 FROM task_execution_sequences)
  AND NOT EXISTS (SELECT 1 FROM execution_attempts)
  AND NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check)
);
DROP TABLE ep02a_migration_assertion;

DROP TABLE application_lifecycle_authorizations_v4;
DROP TABLE application_audit_v4;
DROP TABLE authorization_decisions_v4;
DROP TABLE authorization_grants_v4;
DROP TABLE authorization_capability_epochs_v4;
DROP TABLE authorization_local_identity_v4;
DROP TABLE authorization_bootstrap_v4;
DROP TABLE application_requests_v4;

CREATE TEMP TABLE ep02a_foreign_key_assertion (
  ok INTEGER NOT NULL CHECK (ok = 1)
) STRICT;
INSERT INTO ep02a_foreign_key_assertion
SELECT NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check);
DROP TABLE ep02a_foreign_key_assertion;

CREATE TRIGGER application_requests_no_update
BEFORE UPDATE ON application_requests BEGIN
  SELECT RAISE(ABORT, 'application requests are append-only');
END;
CREATE TRIGGER application_requests_no_delete
BEFORE DELETE ON application_requests BEGIN
  SELECT RAISE(ABORT, 'application requests are append-only');
END;
CREATE TRIGGER authorization_bootstrap_no_update
BEFORE UPDATE ON authorization_bootstrap BEGIN
  SELECT RAISE(ABORT, 'authorization bootstrap is immutable');
END;
CREATE TRIGGER authorization_bootstrap_no_delete
BEFORE DELETE ON authorization_bootstrap BEGIN
  SELECT RAISE(ABORT, 'authorization bootstrap is immutable');
END;
CREATE TRIGGER authorization_local_identity_no_update
BEFORE UPDATE ON authorization_local_identity BEGIN
  SELECT RAISE(ABORT, 'local authorization identity is immutable');
END;
CREATE TRIGGER authorization_local_identity_no_delete
BEFORE DELETE ON authorization_local_identity BEGIN
  SELECT RAISE(ABORT, 'local authorization identity is immutable');
END;
CREATE TRIGGER authorization_capability_epochs_no_update
BEFORE UPDATE ON authorization_capability_epochs BEGIN
  SELECT RAISE(ABORT, 'authorization capability epochs are immutable');
END;
CREATE TRIGGER authorization_capability_epochs_no_delete
BEFORE DELETE ON authorization_capability_epochs BEGIN
  SELECT RAISE(ABORT, 'authorization capability epochs are immutable');
END;
CREATE TRIGGER authorization_grants_revoke_only
BEFORE UPDATE ON authorization_grants
WHEN NEW.grant_id <> OLD.grant_id
  OR NEW.actor_id <> OLD.actor_id
  OR NEW.action <> OLD.action
  OR NEW.scope_kind <> OLD.scope_kind
  OR NEW.scope_project_id IS NOT OLD.scope_project_id
  OR NEW.scope_resource_revision IS NOT OLD.scope_resource_revision
  OR NEW.scope_config_revision IS NOT OLD.scope_config_revision
  OR NEW.not_before <> OLD.not_before
  OR NEW.expires_at <> OLD.expires_at
  OR NEW.issuer_grant_id IS NOT OLD.issuer_grant_id
  OR NEW.source_grant_id IS NOT OLD.source_grant_id
  OR NEW.capability_epoch_id IS NOT OLD.capability_epoch_id
  OR NEW.created_request_id <> OLD.created_request_id
  OR OLD.revoked_at IS NOT NULL
  OR NEW.revoked_at IS NULL
  OR NEW.revoked_request_id IS NULL
  OR NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'authorization grants allow one irreversible CAS revocation only');
END;
CREATE TRIGGER authorization_grants_no_delete
BEFORE DELETE ON authorization_grants BEGIN
  SELECT RAISE(ABORT, 'authorization grants cannot be deleted');
END;
CREATE TRIGGER authorization_decisions_no_update
BEFORE UPDATE ON authorization_decisions BEGIN
  SELECT RAISE(ABORT, 'authorization decisions are append-only');
END;
CREATE TRIGGER authorization_decisions_no_delete
BEFORE DELETE ON authorization_decisions BEGIN
  SELECT RAISE(ABORT, 'authorization decisions are append-only');
END;
CREATE TRIGGER application_audit_no_update
BEFORE UPDATE ON application_audit BEGIN
  SELECT RAISE(ABORT, 'application audit is append-only');
END;
CREATE TRIGGER application_audit_no_delete
BEFORE DELETE ON application_audit BEGIN
  SELECT RAISE(ABORT, 'application audit is append-only');
END;
CREATE TRIGGER application_lifecycle_authorizations_no_update
BEFORE UPDATE ON application_lifecycle_authorizations BEGIN
  SELECT RAISE(ABORT, 'application lifecycle authorizations are immutable');
END;
CREATE TRIGGER application_lifecycle_authorizations_no_delete
BEFORE DELETE ON application_lifecycle_authorizations BEGIN
  SELECT RAISE(ABORT, 'application lifecycle authorizations are immutable');
END;

CREATE TRIGGER task_execution_sequences_increment_only
BEFORE UPDATE ON task_execution_sequences
WHEN NEW.task_id <> OLD.task_id
  OR NEW.last_attempt_number <> OLD.last_attempt_number + 1
  OR NEW.current_fencing_token <> OLD.current_fencing_token + 1
  OR NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'Task execution sequence requires one exact CAS increment');
END;
CREATE TRIGGER task_execution_sequences_no_delete
BEFORE DELETE ON task_execution_sequences BEGIN
  SELECT RAISE(ABORT, 'Task execution sequences cannot be deleted');
END;

CREATE TRIGGER execution_attempts_update_guard
BEFORE UPDATE ON execution_attempts
WHEN NOT (
  (
    OLD.status = 'active' AND NEW.status = 'active'
    AND NEW.execution_id = OLD.execution_id
    AND NEW.task_id = OLD.task_id
    AND NEW.attempt_number = OLD.attempt_number
    AND NEW.operation_kind = OLD.operation_kind
    AND NEW.idempotency_key = OLD.idempotency_key
    AND NEW.owner_id = OLD.owner_id
    AND NEW.requested_lease_seconds = OLD.requested_lease_seconds
    AND NEW.predecessor_execution_revision IS OLD.predecessor_execution_revision
    AND NEW.predecessor_lease_revision IS OLD.predecessor_lease_revision
    AND NEW.predecessor_fencing_token IS OLD.predecessor_fencing_token
    AND NEW.lease_revision = OLD.lease_revision + 1
    AND NEW.lease_expires_at > OLD.lease_expires_at
    AND NEW.fencing_token = OLD.fencing_token
    AND NEW.revision = OLD.revision + 1
    AND NEW.expected_task_revision = OLD.expected_task_revision
    AND NEW.pre_task_revision = OLD.pre_task_revision
    AND NEW.post_task_revision = OLD.post_task_revision
    AND NEW.project_resource_revision = OLD.project_resource_revision
    AND NEW.project_config_revision = OLD.project_config_revision
    AND NEW.request_id = OLD.request_id
    AND NEW.decision_id = OLD.decision_id
    AND NEW.supersedes_execution_id IS OLD.supersedes_execution_id
    AND NEW.superseded_by_execution_id IS NULL
    AND NEW.created_at = OLD.created_at
    AND NEW.updated_at > OLD.updated_at
  )
  OR
  (
    OLD.status = 'active' AND NEW.status = 'superseded'
    AND NEW.execution_id = OLD.execution_id
    AND NEW.task_id = OLD.task_id
    AND NEW.attempt_number = OLD.attempt_number
    AND NEW.operation_kind = OLD.operation_kind
    AND NEW.idempotency_key = OLD.idempotency_key
    AND NEW.owner_id = OLD.owner_id
    AND NEW.requested_lease_seconds = OLD.requested_lease_seconds
    AND NEW.predecessor_execution_revision IS OLD.predecessor_execution_revision
    AND NEW.predecessor_lease_revision IS OLD.predecessor_lease_revision
    AND NEW.predecessor_fencing_token IS OLD.predecessor_fencing_token
    AND NEW.lease_revision = OLD.lease_revision
    AND NEW.lease_expires_at = OLD.lease_expires_at
    AND NEW.fencing_token = OLD.fencing_token
    AND NEW.revision = OLD.revision + 1
    AND NEW.expected_task_revision = OLD.expected_task_revision
    AND NEW.pre_task_revision = OLD.pre_task_revision
    AND NEW.post_task_revision = OLD.post_task_revision
    AND NEW.project_resource_revision = OLD.project_resource_revision
    AND NEW.project_config_revision = OLD.project_config_revision
    AND NEW.request_id = OLD.request_id
    AND NEW.decision_id = OLD.decision_id
    AND NEW.supersedes_execution_id IS OLD.supersedes_execution_id
    AND OLD.superseded_by_execution_id IS NULL
    AND NEW.superseded_by_execution_id IS NOT NULL
    AND NEW.created_at = OLD.created_at
    AND NEW.updated_at >= OLD.lease_expires_at
    AND NEW.updated_at > OLD.updated_at
  )
)
BEGIN
  SELECT RAISE(ABORT, 'execution attempts allow only fenced renewal or expired supersession');
END;
CREATE TRIGGER execution_attempts_no_delete
BEFORE DELETE ON execution_attempts BEGIN
  SELECT RAISE(ABORT, 'execution attempts cannot be deleted');
END;
