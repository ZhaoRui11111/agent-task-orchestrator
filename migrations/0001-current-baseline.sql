CREATE TABLE schema_metadata (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  domain_initialized INTEGER NOT NULL CHECK (domain_initialized IN (0, 1)),
  registry_identity TEXT NOT NULL CHECK (length(registry_identity) = 64),
  schema_fingerprint TEXT NOT NULL CHECK (length(schema_fingerprint) = 64),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0)
) STRICT;

CREATE TABLE migration_history (
  version INTEGER PRIMARY KEY CHECK (version > 0),
  migration_id TEXT NOT NULL UNIQUE CHECK (length(migration_id) > 0),
  checksum_sha256 TEXT NOT NULL CHECK (length(checksum_sha256) = 64),
  applied_at TEXT NOT NULL CHECK (length(applied_at) > 0),
  application_version TEXT NOT NULL CHECK (length(application_version) > 0)
) STRICT;

CREATE TABLE projects (
  project_id TEXT PRIMARY KEY CHECK (length(project_id) > 0),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1))
) STRICT;

CREATE TABLE tasks (
  task_id TEXT PRIMARY KEY CHECK (length(task_id) > 0),
  project_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('idea', 'ready', 'running', 'waiting', 'completed', 'cancelled')),
  revision INTEGER NOT NULL CHECK (revision > 0),
  body TEXT NOT NULL,
  parent_id TEXT,
  waiting_reason TEXT,
  waiting_phase TEXT,
  waiting_required_action TEXT,
  waiting_last_error_code TEXT,
  waiting_last_error_summary TEXT,
  waiting_retryable INTEGER,
  waiting_retry_count INTEGER,
  waiting_retry_after INTEGER,
  waiting_execution_id TEXT,
  waiting_workspace_revision TEXT,
  waiting_backend_thread_id TEXT,
  waiting_task_revision INTEGER,
  completion_decision_id TEXT,
  completion_accepted_task_revision INTEGER,
  cancellation_event TEXT,
  cancellation_reason TEXT,
  cancellation_verification_id TEXT,
  cancellation_accepted_task_revision INTEGER,
  supersedes_task_id TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (parent_id) REFERENCES tasks(task_id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (supersedes_task_id) REFERENCES tasks(task_id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CHECK (parent_id IS NULL OR length(parent_id) > 0),
  CHECK (supersedes_task_id IS NULL OR length(supersedes_task_id) > 0),
  CHECK (
    (state = 'waiting'
      AND waiting_reason IS NOT NULL
      AND waiting_phase IS NOT NULL
      AND waiting_required_action IS NOT NULL
      AND waiting_last_error_code IS NOT NULL
      AND waiting_retryable IN (0, 1)
      AND waiting_retry_count >= 0
      AND waiting_task_revision > 0)
    OR
    (state <> 'waiting'
      AND waiting_reason IS NULL
      AND waiting_phase IS NULL
      AND waiting_required_action IS NULL
      AND waiting_last_error_code IS NULL
      AND waiting_last_error_summary IS NULL
      AND waiting_retryable IS NULL
      AND waiting_retry_count IS NULL
      AND waiting_retry_after IS NULL
      AND waiting_execution_id IS NULL
      AND waiting_workspace_revision IS NULL
      AND waiting_backend_thread_id IS NULL
      AND waiting_task_revision IS NULL)
  ),
  CHECK (
    (state = 'completed' AND completion_decision_id IS NOT NULL AND completion_accepted_task_revision > 0)
    OR
    (state <> 'completed' AND completion_decision_id IS NULL AND completion_accepted_task_revision IS NULL)
  ),
  CHECK (
    (state = 'cancelled'
      AND cancellation_event IN ('cancel', 'interruption_verified')
      AND cancellation_reason IS NOT NULL
      AND cancellation_accepted_task_revision > 0)
    OR
    (state <> 'cancelled'
      AND cancellation_event IS NULL
      AND cancellation_reason IS NULL
      AND cancellation_verification_id IS NULL
      AND cancellation_accepted_task_revision IS NULL)
  )
) STRICT;

CREATE INDEX tasks_project_id_index ON tasks(project_id, task_id);

CREATE INDEX tasks_parent_id_index ON tasks(parent_id) WHERE parent_id IS NOT NULL;

CREATE INDEX tasks_supersedes_task_id_index ON tasks(supersedes_task_id) WHERE supersedes_task_id IS NOT NULL;

CREATE TABLE task_dependencies (
  task_id TEXT NOT NULL,
  dependency_id TEXT NOT NULL,
  PRIMARY KEY (task_id, dependency_id),
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (dependency_id) REFERENCES tasks(task_id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CHECK (task_id <> dependency_id)
) STRICT;

CREATE INDEX task_dependencies_dependency_index ON task_dependencies(dependency_id, task_id);

CREATE TABLE project_registry (
  project_id TEXT PRIMARY KEY CHECK (length(project_id) > 0),
  canonical_root TEXT NOT NULL CHECK (length(canonical_root) > 0),
  root_key TEXT NOT NULL UNIQUE CHECK (length(root_key) > 0),
  platform TEXT NOT NULL CHECK (length(platform) > 0),
  root_device TEXT NOT NULL CHECK (length(root_device) > 0),
  root_inode TEXT NOT NULL CHECK (length(root_inode) > 0),
  root_mode INTEGER NOT NULL CHECK (root_mode >= 0),
  config_revision INTEGER NOT NULL CHECK (config_revision > 0),
  resource_revision INTEGER NOT NULL CHECK (resource_revision > 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER project_registry_no_delete
BEFORE DELETE ON project_registry BEGIN
  SELECT RAISE(ABORT, 'ProjectRegistry entries cannot be deleted');
END;

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
  vocabulary_version INTEGER NOT NULL DEFAULT 1 CHECK (vocabulary_version = 1),
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
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  UNIQUE(actor_id, runtime_root_key),
  FOREIGN KEY (bootstrap_request_id) REFERENCES authorization_bootstrap(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE authorization_capability_epochs (
  epoch_id TEXT PRIMARY KEY NOT NULL CHECK (length(epoch_id) BETWEEN 1 AND 128),
  epoch_revision INTEGER NOT NULL UNIQUE CHECK (epoch_revision > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  runtime_root_key TEXT NOT NULL CHECK (length(runtime_root_key) > 0),
  vocabulary_version INTEGER NOT NULL CHECK (vocabulary_version IN (1, 2, 3, 4, 5)),
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
    'execution.lease.renew', 'execution.lease.takeover',
    'execution.start', 'execution.inspect', 'execution.resume', 'execution.retry', 'execution.cancel', 'execution.completion.accept', 'dispatch.run',
    'workspace.reserve', 'workspace.create', 'workspace.inspect', 'workspace.recover', 'workspace.cleanup'
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
  state_digest_version INTEGER NOT NULL CHECK (state_digest_version = 1),
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

CREATE TRIGGER execution_attempts_no_delete
BEFORE DELETE ON execution_attempts BEGIN
  SELECT RAISE(ABORT, 'execution attempts cannot be deleted');
END;

CREATE TABLE execution_operation_requests (
  request_id TEXT PRIMARY KEY NOT NULL CHECK (length(request_id) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action IN (
    'execution.start', 'execution.inspect', 'execution.resume', 'execution.retry',
    'execution.cancel', 'execution.completion.accept'
  )),
  target_execution_id TEXT NOT NULL CHECK (length(target_execution_id) BETWEEN 1 AND 128),
  target_revision INTEGER NOT NULL CHECK (target_revision > 0),
  result TEXT NOT NULL CHECK (result IN ('allow', 'deny')),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  FOREIGN KEY (target_execution_id) REFERENCES execution_attempts(execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE execution_authorization_decisions (
  decision_id TEXT PRIMARY KEY NOT NULL CHECK (length(decision_id) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL UNIQUE,
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action IN (
    'execution.start', 'execution.inspect', 'execution.resume', 'execution.retry',
    'execution.cancel', 'execution.completion.accept'
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
  project_id TEXT NOT NULL CHECK (length(project_id) > 0),
  resource_revision INTEGER NOT NULL CHECK (resource_revision > 0),
  config_revision INTEGER NOT NULL CHECK (config_revision > 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK ((grant_id IS NULL AND grant_revision IS NULL) OR (length(grant_id) > 0 AND grant_revision > 0)),
  CHECK ((result = 'allow' AND reason = 'allowed' AND grant_id IS NOT NULL) OR (result = 'deny' AND reason <> 'allowed')),
  FOREIGN KEY (request_id) REFERENCES execution_operation_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (project_id) REFERENCES project_registry(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE execution_operation_audit (
  audit_id TEXT PRIMARY KEY NOT NULL CHECK (length(audit_id) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN (
    'execution.operation.prepared', 'execution.operation.denied', 'execution.operation.executing',
    'execution.operation.observed', 'execution.operation.verified', 'execution.operation.finalized',
    'execution.manual.outcome.recorded', 'execution.completion.accepted',
    'execution.interruption.verified', 'execution.reconciled'
  )),
  result TEXT NOT NULL CHECK (result IN ('accepted', 'denied')),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  execution_id TEXT NOT NULL CHECK (length(execution_id) BETWEEN 1 AND 128),
  execution_revision INTEGER NOT NULL CHECK (execution_revision > 0),
  code TEXT NOT NULL CHECK (length(code) BETWEEN 1 AND 64),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  FOREIGN KEY (request_id) REFERENCES execution_operation_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (decision_id) REFERENCES execution_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (execution_id) REFERENCES execution_attempts(execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE execution_operation_intents (
  intent_id TEXT PRIMARY KEY NOT NULL CHECK (length(intent_id) BETWEEN 1 AND 128),
  operation_id TEXT NOT NULL UNIQUE CHECK (length(operation_id) BETWEEN 1 AND 128),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  operation_kind TEXT NOT NULL CHECK (operation_kind IN ('start', 'inspect', 'resume', 'retry', 'request_cancel', 'manual_report')),
  action TEXT NOT NULL CHECK (action IN ('execution.start', 'execution.inspect', 'execution.resume', 'execution.retry', 'execution.cancel')),
  state TEXT NOT NULL CHECK (state IN ('pending', 'executing', 'observed', 'verified', 'finalized', 'retry_wait', 'ambiguous', 'failed')),
  revision INTEGER NOT NULL CHECK (revision > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL UNIQUE,
  decision_id TEXT NOT NULL UNIQUE,
  current_authorization_decision_id TEXT NOT NULL,
  authorization_binding_revision INTEGER NOT NULL CHECK (authorization_binding_revision > 0),
  confirmation_id TEXT,
  project_id TEXT NOT NULL CHECK (length(project_id) > 0),
  project_resource_revision INTEGER NOT NULL CHECK (project_resource_revision > 0),
  project_config_revision INTEGER NOT NULL CHECK (project_config_revision > 0),
  task_id TEXT NOT NULL CHECK (length(task_id) > 0),
  task_revision INTEGER NOT NULL CHECK (task_revision > 0),
  input_reference TEXT NOT NULL CHECK (length(input_reference) BETWEEN 1 AND 128),
  execution_id TEXT NOT NULL CHECK (length(execution_id) BETWEEN 1 AND 128),
  execution_revision INTEGER NOT NULL CHECK (execution_revision > 0),
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  fencing_token INTEGER NOT NULL CHECK (fencing_token > 0),
  source_execution_id TEXT,
  source_execution_revision INTEGER,
  source_attempt_number INTEGER,
  source_fencing_token INTEGER,
  source_observation_number INTEGER,
  contract_id TEXT NOT NULL CHECK (contract_id = 'ato.execution/v1'),
  adapter_id TEXT NOT NULL CHECK (length(adapter_id) BETWEEN 1 AND 128),
  adapter_version TEXT NOT NULL CHECK (length(adapter_version) BETWEEN 1 AND 128),
  policy_binding_reference TEXT NOT NULL CHECK (length(policy_binding_reference) BETWEEN 1 AND 128),
  workspace_mode TEXT NOT NULL CHECK (workspace_mode = 'none'),
  backend_execution_id TEXT,
  thread_id TEXT,
  previous_receipt_id TEXT,
  expected_journal_revision INTEGER,
  requested_deadline TEXT NOT NULL CHECK (length(requested_deadline) > 0),
  continuation_reference TEXT,
  required_action_receipt_id TEXT,
  expected_lifecycle TEXT CHECK (expected_lifecycle IS NULL OR expected_lifecycle IN ('queued', 'active', 'waiting', 'turn_succeeded', 'failed', 'cancelled')),
  reason_code TEXT,
  report_id TEXT,
  report_operation TEXT CHECK (report_operation IS NULL OR report_operation IN ('activate', 'wait', 'succeed', 'fail', 'confirm_cancelled')),
  report_code TEXT,
  evidence_reference TEXT,
  last_observation_number INTEGER NOT NULL CHECK (last_observation_number >= 0),
  last_error_category TEXT CHECK (last_error_category IS NULL OR last_error_category IN (
    'invalid_request', 'incompatible_contract', 'unauthorized', 'policy_denied', 'not_found',
    'conflict', 'stale_revision', 'busy', 'rate_limited', 'resource_exhausted',
    'transient_external', 'permanent_external', 'ambiguous_external_state', 'cancelled',
    'integrity_failure'
  )),
  last_error_code TEXT,
  last_error_retryable INTEGER CHECK (last_error_retryable IS NULL OR last_error_retryable IN (0, 1)),
  last_error_ambiguous INTEGER CHECK (last_error_ambiguous IS NULL OR last_error_ambiguous IN (0, 1)),
  retry_after TEXT,
  retry_count INTEGER NOT NULL CHECK (retry_count >= 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  CHECK (continuation_reference IS NULL OR length(continuation_reference) BETWEEN 1 AND 128),
  CHECK (required_action_receipt_id IS NULL OR length(required_action_receipt_id) BETWEEN 1 AND 128),
  CHECK (reason_code IS NULL OR length(reason_code) BETWEEN 1 AND 64),
  CHECK (report_id IS NULL OR length(report_id) BETWEEN 1 AND 128),
  CHECK (report_code IS NULL OR length(report_code) BETWEEN 1 AND 64),
  CHECK (evidence_reference IS NULL OR length(evidence_reference) BETWEEN 1 AND 128),
  CHECK (
    (retry_count = 0 AND last_error_category IS NULL AND last_error_code IS NULL
      AND last_error_retryable IS NULL AND last_error_ambiguous IS NULL AND retry_after IS NULL)
    OR (retry_count > 0 AND last_error_category IS NOT NULL
      AND length(last_error_code) BETWEEN 1 AND 64
      AND last_error_retryable IS NOT NULL AND last_error_ambiguous IS NOT NULL
      AND (retry_after IS NULL OR length(retry_after) > 0))
  ),
  CHECK ((operation_kind IN ('resume', 'retry') AND length(source_execution_id) > 0
      AND source_execution_id <> execution_id AND source_execution_revision > 0
      AND source_attempt_number > 0 AND source_fencing_token > 0 AND source_observation_number >= 0)
    OR (operation_kind <> 'retry' AND source_execution_id IS NULL
      AND source_execution_revision IS NULL AND source_attempt_number IS NULL
      AND source_fencing_token IS NULL AND source_observation_number IS NULL)),
  CHECK ((operation_kind = 'start' AND action = 'execution.start' AND backend_execution_id IS NULL AND thread_id IS NULL
      AND previous_receipt_id IS NULL AND expected_journal_revision IS NULL AND continuation_reference IS NULL
      AND required_action_receipt_id IS NULL AND expected_lifecycle IS NULL AND reason_code IS NULL
      AND report_id IS NULL AND report_operation IS NULL AND report_code IS NULL AND evidence_reference IS NULL
      AND last_observation_number = 0)
    OR (operation_kind = 'inspect' AND action = 'execution.inspect' AND length(backend_execution_id) > 0
      AND length(thread_id) > 0 AND previous_receipt_id IS NULL AND expected_journal_revision IS NULL
      AND continuation_reference IS NULL AND required_action_receipt_id IS NULL AND expected_lifecycle IS NULL
      AND reason_code IS NULL AND report_id IS NULL AND report_operation IS NULL AND report_code IS NULL
      AND evidence_reference IS NULL)
    OR (operation_kind = 'resume' AND action = 'execution.resume' AND length(backend_execution_id) > 0
      AND length(thread_id) > 0 AND length(previous_receipt_id) > 0 AND length(continuation_reference) > 0
      AND length(required_action_receipt_id) > 0 AND expected_journal_revision IS NULL AND expected_lifecycle IS NULL
      AND reason_code IS NULL AND report_id IS NULL AND report_operation IS NULL AND report_code IS NULL
      AND evidence_reference IS NULL)
    OR (operation_kind = 'retry' AND action = 'execution.retry' AND length(backend_execution_id) > 0
      AND length(thread_id) > 0 AND length(previous_receipt_id) > 0 AND length(continuation_reference) > 0
      AND length(required_action_receipt_id) > 0 AND expected_journal_revision IS NULL AND expected_lifecycle IS NULL
      AND reason_code IS NULL AND report_id IS NULL AND report_operation IS NULL AND report_code IS NULL
      AND evidence_reference IS NULL)
    OR (operation_kind = 'request_cancel' AND action = 'execution.cancel' AND length(backend_execution_id) > 0
      AND length(thread_id) > 0 AND previous_receipt_id IS NULL AND expected_journal_revision IS NULL
      AND continuation_reference IS NULL AND required_action_receipt_id IS NULL AND expected_lifecycle IS NOT NULL
      AND length(reason_code) > 0 AND report_id IS NULL AND report_operation IS NULL AND report_code IS NULL
      AND evidence_reference IS NULL)
    OR (operation_kind = 'manual_report' AND action = 'execution.inspect' AND length(backend_execution_id) > 0
      AND length(thread_id) > 0 AND length(confirmation_id) > 0 AND expected_journal_revision > 0
      AND previous_receipt_id IS NULL AND continuation_reference IS NULL AND required_action_receipt_id IS NULL
      AND expected_lifecycle IS NOT NULL AND reason_code IS NULL AND length(report_id) > 0
      AND report_operation IS NOT NULL AND length(report_code) > 0)),
  FOREIGN KEY (request_id) REFERENCES execution_operation_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (decision_id) REFERENCES execution_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (current_authorization_decision_id) REFERENCES execution_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (project_id) REFERENCES project_registry(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (execution_id) REFERENCES execution_attempts(execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (source_execution_id) REFERENCES execution_attempts(execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE INDEX execution_intents_execution_order
  ON execution_operation_intents(execution_id, created_at, intent_id);

CREATE INDEX execution_intents_recovery
  ON execution_operation_intents(state, updated_at, intent_id)
  WHERE state <> 'finalized';

CREATE UNIQUE INDEX execution_intents_confirmation_once
  ON execution_operation_intents(confirmation_id) WHERE confirmation_id IS NOT NULL;

CREATE TABLE execution_intent_authorization_bindings (
  binding_id TEXT PRIMARY KEY NOT NULL CHECK (length(binding_id) BETWEEN 1 AND 128),
  intent_id TEXT NOT NULL,
  binding_revision INTEGER NOT NULL CHECK (binding_revision > 0),
  phase TEXT NOT NULL CHECK (phase IN ('prepare', 'act', 'finalize')),
  request_id TEXT NOT NULL UNIQUE,
  decision_id TEXT NOT NULL UNIQUE,
  audit_id TEXT NOT NULL UNIQUE,
  prior_decision_id TEXT,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  UNIQUE(intent_id, binding_revision),
  CHECK ((binding_revision = 1 AND phase = 'prepare' AND prior_decision_id IS NULL)
    OR (binding_revision > 1 AND phase IN ('act', 'finalize') AND length(prior_decision_id) > 0)),
  FOREIGN KEY (intent_id) REFERENCES execution_operation_intents(intent_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (request_id) REFERENCES execution_operation_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (decision_id) REFERENCES execution_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (audit_id) REFERENCES execution_operation_audit(audit_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (prior_decision_id) REFERENCES execution_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE execution_observations (
  observation_id TEXT PRIMARY KEY NOT NULL CHECK (length(observation_id) BETWEEN 1 AND 128),
  intent_id TEXT NOT NULL,
  observation_number INTEGER NOT NULL CHECK (observation_number > 0),
  adapter_receipt_id TEXT NOT NULL UNIQUE CHECK (length(adapter_receipt_id) BETWEEN 1 AND 128),
  receipt_sha256 TEXT NOT NULL CHECK (length(receipt_sha256) = 64 AND receipt_sha256 NOT GLOB '*[^0-9A-F]*'),
  authorization_decision_id TEXT NOT NULL CHECK (length(authorization_decision_id) BETWEEN 1 AND 128),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('unknown', 'queued', 'active', 'waiting', 'turn_succeeded', 'failed', 'cancelled')),
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'deferred', 'rejected')),
  code TEXT NOT NULL CHECK (length(code) BETWEEN 1 AND 64),
  backend_execution_id TEXT,
  thread_id TEXT,
  journal_revision INTEGER,
  evidence_reference TEXT,
  observed_at TEXT NOT NULL CHECK (length(observed_at) > 0),
  UNIQUE(intent_id, observation_number),
  CHECK (journal_revision IS NULL OR journal_revision > 0),
  CHECK (evidence_reference IS NULL OR length(evidence_reference) BETWEEN 1 AND 128),
  FOREIGN KEY (intent_id) REFERENCES execution_operation_intents(intent_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (authorization_decision_id) REFERENCES execution_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE execution_verified_receipts (
  verified_receipt_id TEXT PRIMARY KEY NOT NULL CHECK (length(verified_receipt_id) BETWEEN 1 AND 128),
  intent_id TEXT NOT NULL UNIQUE,
  adapter_receipt_id TEXT NOT NULL UNIQUE CHECK (length(adapter_receipt_id) BETWEEN 1 AND 128),
  receipt_sha256 TEXT NOT NULL CHECK (length(receipt_sha256) = 64 AND receipt_sha256 NOT GLOB '*[^0-9A-F]*'),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN (
    'started', 'deferred', 'rejected', 'unknown', 'queued', 'active', 'waiting',
    'turn_succeeded', 'failed', 'cancelled', 'requested', 'already_terminal'
  )),
  backend_execution_id TEXT NOT NULL CHECK (length(backend_execution_id) BETWEEN 1 AND 128),
  thread_id TEXT,
  observation_number INTEGER NOT NULL CHECK (observation_number > 0),
  observed_revision INTEGER NOT NULL CHECK (observed_revision > 0),
  fencing_token INTEGER NOT NULL CHECK (fencing_token > 0),
  verified_at TEXT NOT NULL CHECK (length(verified_at) > 0),
  FOREIGN KEY (intent_id) REFERENCES execution_operation_intents(intent_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE execution_finalizations (
  finalization_id TEXT PRIMARY KEY NOT NULL CHECK (length(finalization_id) BETWEEN 1 AND 128),
  intent_id TEXT NOT NULL UNIQUE,
  verified_receipt_id TEXT,
  authorization_decision_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('accepted', 'deferred', 'rejected', 'waiting', 'interrupted')),
  code TEXT NOT NULL CHECK (length(code) BETWEEN 1 AND 64),
  task_revision INTEGER NOT NULL CHECK (task_revision > 0),
  execution_revision INTEGER NOT NULL CHECK (execution_revision > 0),
  finalized_at TEXT NOT NULL CHECK (length(finalized_at) > 0),
  FOREIGN KEY (intent_id) REFERENCES execution_operation_intents(intent_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (verified_receipt_id) REFERENCES execution_verified_receipts(verified_receipt_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (authorization_decision_id) REFERENCES execution_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE execution_terminal_states (
  execution_id TEXT PRIMARY KEY NOT NULL CHECK (length(execution_id) BETWEEN 1 AND 128),
  status TEXT NOT NULL CHECK (status IN ('completed', 'cancelled')),
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  fencing_token INTEGER NOT NULL CHECK (fencing_token > 0),
  verified_receipt_id TEXT NOT NULL UNIQUE,
  finalization_id TEXT NOT NULL UNIQUE,
  completion_decision_id TEXT UNIQUE,
  pre_task_revision INTEGER NOT NULL CHECK (pre_task_revision > 0),
  post_task_revision INTEGER NOT NULL CHECK (post_task_revision = pre_task_revision + 1),
  execution_revision INTEGER NOT NULL CHECK (execution_revision > 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK ((status = 'completed' AND length(completion_decision_id) > 0)
    OR (status = 'cancelled' AND completion_decision_id IS NULL)),
  FOREIGN KEY (execution_id) REFERENCES execution_attempts(execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (verified_receipt_id) REFERENCES execution_verified_receipts(verified_receipt_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (finalization_id) REFERENCES execution_finalizations(finalization_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (completion_decision_id) REFERENCES manual_completion_decisions(completion_decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE manual_backend_turns (
  backend_execution_id TEXT PRIMARY KEY NOT NULL CHECK (length(backend_execution_id) BETWEEN 1 AND 128),
  thread_id TEXT NOT NULL UNIQUE CHECK (length(thread_id) BETWEEN 1 AND 128),
  start_idempotency_key TEXT NOT NULL UNIQUE CHECK (length(start_idempotency_key) BETWEEN 1 AND 128),
  project_id TEXT NOT NULL CHECK (length(project_id) > 0),
  project_resource_revision INTEGER NOT NULL CHECK (project_resource_revision > 0),
  project_config_revision INTEGER NOT NULL CHECK (project_config_revision > 0),
  task_id TEXT NOT NULL CHECK (length(task_id) > 0),
  task_revision INTEGER NOT NULL CHECK (task_revision > 0),
  input_reference TEXT NOT NULL CHECK (length(input_reference) BETWEEN 1 AND 128),
  execution_id TEXT NOT NULL UNIQUE CHECK (length(execution_id) BETWEEN 1 AND 128),
  execution_revision INTEGER NOT NULL CHECK (execution_revision > 0),
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  fencing_token INTEGER NOT NULL CHECK (fencing_token > 0),
  predecessor_backend_execution_id TEXT,
  predecessor_thread_id TEXT,
  policy_binding_reference TEXT NOT NULL CHECK (length(policy_binding_reference) BETWEEN 1 AND 128),
  workspace_mode TEXT NOT NULL CHECK (workspace_mode = 'none'),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('queued', 'active', 'waiting', 'turn_succeeded', 'failed', 'cancelled')),
  cancellation_request_revision INTEGER,
  cancellation_requested_at TEXT,
  code TEXT NOT NULL CHECK (length(code) BETWEEN 1 AND 64),
  evidence_reference TEXT,
  last_report_id TEXT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  CHECK ((cancellation_request_revision IS NULL AND cancellation_requested_at IS NULL)
    OR (cancellation_request_revision > 0 AND length(cancellation_requested_at) > 0)),
  CHECK ((predecessor_backend_execution_id IS NULL AND predecessor_thread_id IS NULL)
    OR (length(predecessor_backend_execution_id) > 0 AND length(predecessor_thread_id) > 0)),
  CHECK (evidence_reference IS NULL OR length(evidence_reference) BETWEEN 1 AND 128),
  CHECK (last_report_id IS NULL OR length(last_report_id) BETWEEN 1 AND 128),
  FOREIGN KEY (project_id) REFERENCES project_registry(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (execution_id) REFERENCES execution_attempts(execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (predecessor_backend_execution_id) REFERENCES manual_backend_turns(backend_execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (predecessor_thread_id) REFERENCES manual_backend_turns(thread_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE manual_backend_operations (
  backend_operation_id TEXT PRIMARY KEY NOT NULL CHECK (length(backend_operation_id) BETWEEN 1 AND 128),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  intent_id TEXT NOT NULL UNIQUE CHECK (length(intent_id) BETWEEN 1 AND 128),
  authorization_decision_id TEXT NOT NULL CHECK (length(authorization_decision_id) BETWEEN 1 AND 128),
  operation_kind TEXT NOT NULL CHECK (operation_kind IN ('start', 'resume', 'retry', 'request_cancel', 'manual_report')),
  report_operation TEXT CHECK (report_operation IS NULL OR report_operation IN ('activate', 'wait', 'succeed', 'fail', 'confirm_cancelled')),
  backend_execution_id TEXT NOT NULL CHECK (length(backend_execution_id) BETWEEN 1 AND 128),
  thread_id TEXT NOT NULL CHECK (length(thread_id) BETWEEN 1 AND 128),
  source_backend_execution_id TEXT,
  source_thread_id TEXT,
  expected_fencing_token INTEGER NOT NULL CHECK (expected_fencing_token > 0),
  expected_pre_revision INTEGER,
  post_revision INTEGER NOT NULL CHECK (post_revision > 0),
  result_lifecycle TEXT NOT NULL CHECK (result_lifecycle IN ('queued', 'active', 'waiting', 'turn_succeeded', 'failed', 'cancelled')),
  receipt_id TEXT NOT NULL UNIQUE CHECK (length(receipt_id) BETWEEN 1 AND 128),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK (expected_pre_revision IS NULL OR expected_pre_revision > 0),
  CHECK ((operation_kind = 'manual_report' AND report_operation IS NOT NULL) OR (operation_kind <> 'manual_report' AND report_operation IS NULL)),
  CHECK ((operation_kind IN ('resume', 'retry') AND length(source_backend_execution_id) > 0 AND length(source_thread_id) > 0
      AND source_backend_execution_id <> backend_execution_id)
    OR (operation_kind <> 'retry' AND source_backend_execution_id IS NULL AND source_thread_id IS NULL)),
  FOREIGN KEY (intent_id) REFERENCES execution_operation_intents(intent_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (authorization_decision_id) REFERENCES execution_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (backend_execution_id) REFERENCES manual_backend_turns(backend_execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (thread_id) REFERENCES manual_backend_turns(thread_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (source_backend_execution_id) REFERENCES manual_backend_turns(backend_execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (source_thread_id) REFERENCES manual_backend_turns(thread_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE INDEX manual_backend_operations_turn_order
  ON manual_backend_operations(backend_execution_id, post_revision, backend_operation_id);

CREATE TABLE manual_completion_decisions (
  completion_decision_id TEXT PRIMARY KEY NOT NULL CHECK (length(completion_decision_id) BETWEEN 1 AND 128),
  operation_id TEXT NOT NULL UNIQUE CHECK (length(operation_id) BETWEEN 1 AND 128),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  task_id TEXT NOT NULL CHECK (length(task_id) > 0),
  execution_id TEXT NOT NULL CHECK (length(execution_id) BETWEEN 1 AND 128),
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  fencing_token INTEGER NOT NULL CHECK (fencing_token > 0),
  verified_receipt_id TEXT NOT NULL UNIQUE,
  finalization_id TEXT NOT NULL UNIQUE,
  pre_task_revision INTEGER NOT NULL CHECK (pre_task_revision > 0),
  post_task_revision INTEGER NOT NULL CHECK (post_task_revision = pre_task_revision + 1),
  request_id TEXT NOT NULL UNIQUE,
  decision_id TEXT NOT NULL UNIQUE,
  audit_id TEXT NOT NULL UNIQUE,
  confirmation_id TEXT NOT NULL UNIQUE CHECK (length(confirmation_id) BETWEEN 1 AND 128),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (execution_id) REFERENCES execution_attempts(execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (verified_receipt_id) REFERENCES execution_verified_receipts(verified_receipt_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (finalization_id) REFERENCES execution_finalizations(finalization_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (request_id) REFERENCES execution_operation_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (decision_id) REFERENCES execution_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (audit_id) REFERENCES execution_operation_audit(audit_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER execution_attempts_update_guard
BEFORE UPDATE ON execution_attempts
WHEN NOT (
  (
    OLD.status = 'active' AND NEW.status = 'active'
    AND NEW.execution_id = OLD.execution_id AND NEW.task_id = OLD.task_id
    AND NEW.attempt_number = OLD.attempt_number AND NEW.operation_kind = OLD.operation_kind
    AND NEW.idempotency_key = OLD.idempotency_key AND NEW.owner_id = OLD.owner_id
    AND NEW.requested_lease_seconds = OLD.requested_lease_seconds
    AND NEW.predecessor_execution_revision IS OLD.predecessor_execution_revision
    AND NEW.predecessor_lease_revision IS OLD.predecessor_lease_revision
    AND NEW.predecessor_fencing_token IS OLD.predecessor_fencing_token
    AND NEW.lease_revision = OLD.lease_revision + 1 AND NEW.lease_expires_at > OLD.lease_expires_at
    AND NEW.fencing_token = OLD.fencing_token AND NEW.revision = OLD.revision + 1
    AND NEW.expected_task_revision = OLD.expected_task_revision
    AND NEW.pre_task_revision = OLD.pre_task_revision AND NEW.post_task_revision = OLD.post_task_revision
    AND NEW.project_resource_revision = OLD.project_resource_revision
    AND NEW.project_config_revision = OLD.project_config_revision
    AND NEW.request_id = OLD.request_id AND NEW.decision_id = OLD.decision_id
    AND NEW.supersedes_execution_id IS OLD.supersedes_execution_id
    AND NEW.superseded_by_execution_id IS NULL AND NEW.created_at = OLD.created_at
    AND NEW.updated_at > OLD.updated_at
  )
  OR
  (
    OLD.status = 'active' AND NEW.status = 'superseded'
    AND NEW.execution_id = OLD.execution_id AND NEW.task_id = OLD.task_id
    AND NEW.attempt_number = OLD.attempt_number AND NEW.operation_kind = OLD.operation_kind
    AND NEW.idempotency_key = OLD.idempotency_key AND NEW.owner_id = OLD.owner_id
    AND NEW.requested_lease_seconds = OLD.requested_lease_seconds
    AND NEW.predecessor_execution_revision IS OLD.predecessor_execution_revision
    AND NEW.predecessor_lease_revision IS OLD.predecessor_lease_revision
    AND NEW.predecessor_fencing_token IS OLD.predecessor_fencing_token
    AND NEW.lease_revision = OLD.lease_revision AND NEW.lease_expires_at = OLD.lease_expires_at
    AND NEW.fencing_token = OLD.fencing_token AND NEW.revision = OLD.revision + 1
    AND NEW.expected_task_revision = OLD.expected_task_revision
    AND NEW.pre_task_revision = OLD.pre_task_revision AND NEW.post_task_revision = OLD.post_task_revision
    AND NEW.project_resource_revision = OLD.project_resource_revision
    AND NEW.project_config_revision = OLD.project_config_revision
    AND NEW.request_id = OLD.request_id AND NEW.decision_id = OLD.decision_id
    AND NEW.supersedes_execution_id IS OLD.supersedes_execution_id
    AND OLD.superseded_by_execution_id IS NULL AND NEW.superseded_by_execution_id IS NOT NULL
    AND NEW.created_at = OLD.created_at AND NEW.updated_at > OLD.updated_at
    AND (
      NEW.updated_at >= OLD.lease_expires_at
      OR EXISTS (
        SELECT 1
        FROM manual_backend_turns AS turn
        JOIN execution_operation_intents AS intent ON intent.execution_id = OLD.execution_id
        JOIN execution_observations AS observation ON observation.intent_id = intent.intent_id
        JOIN execution_verified_receipts AS receipt ON receipt.intent_id = intent.intent_id
        JOIN execution_finalizations AS finalization ON finalization.intent_id = intent.intent_id
        WHERE turn.execution_id = OLD.execution_id AND turn.lifecycle = 'failed'
          AND intent.state = 'finalized' AND observation.lifecycle = 'failed'
          AND observation.backend_execution_id = turn.backend_execution_id
          AND observation.thread_id = turn.thread_id
          AND observation.journal_revision = turn.revision
          AND receipt.adapter_receipt_id = observation.adapter_receipt_id
          AND finalization.verified_receipt_id = receipt.verified_receipt_id
      )
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'execution attempts allow only fenced renewal or reconciled supersession');
END;

CREATE TRIGGER execution_operation_requests_no_update BEFORE UPDATE ON execution_operation_requests BEGIN
  SELECT RAISE(ABORT, 'execution operation requests are append-only');
END;

CREATE TRIGGER execution_operation_requests_no_delete BEFORE DELETE ON execution_operation_requests BEGIN
  SELECT RAISE(ABORT, 'execution operation requests are append-only');
END;

CREATE TRIGGER execution_authorization_decisions_no_update BEFORE UPDATE ON execution_authorization_decisions BEGIN
  SELECT RAISE(ABORT, 'execution authorization decisions are append-only');
END;

CREATE TRIGGER execution_authorization_decisions_no_delete BEFORE DELETE ON execution_authorization_decisions BEGIN
  SELECT RAISE(ABORT, 'execution authorization decisions are append-only');
END;

CREATE TRIGGER execution_operation_audit_no_update BEFORE UPDATE ON execution_operation_audit BEGIN
  SELECT RAISE(ABORT, 'execution operation audit is append-only');
END;

CREATE TRIGGER execution_operation_audit_no_delete BEFORE DELETE ON execution_operation_audit BEGIN
  SELECT RAISE(ABORT, 'execution operation audit is append-only');
END;

CREATE TRIGGER execution_intent_authorization_bindings_no_update BEFORE UPDATE ON execution_intent_authorization_bindings BEGIN
  SELECT RAISE(ABORT, 'execution intent authorization bindings are append-only');
END;

CREATE TRIGGER execution_intent_authorization_bindings_no_delete BEFORE DELETE ON execution_intent_authorization_bindings BEGIN
  SELECT RAISE(ABORT, 'execution intent authorization bindings are append-only');
END;

CREATE TRIGGER execution_operation_intents_transition_guard
BEFORE UPDATE ON execution_operation_intents
WHEN NEW.intent_id <> OLD.intent_id OR NEW.operation_id <> OLD.operation_id OR NEW.idempotency_key <> OLD.idempotency_key
  OR NEW.operation_kind <> OLD.operation_kind OR NEW.action <> OLD.action OR NEW.actor_id <> OLD.actor_id
  OR NEW.request_id <> OLD.request_id OR NEW.decision_id <> OLD.decision_id
  OR NEW.confirmation_id IS NOT OLD.confirmation_id OR NEW.project_id <> OLD.project_id
  OR NEW.project_resource_revision <> OLD.project_resource_revision OR NEW.project_config_revision <> OLD.project_config_revision
  OR NEW.task_id <> OLD.task_id OR NEW.task_revision <> OLD.task_revision OR NEW.input_reference <> OLD.input_reference
  OR NEW.execution_id <> OLD.execution_id OR NEW.execution_revision <> OLD.execution_revision
  OR NEW.attempt_number <> OLD.attempt_number OR NEW.fencing_token <> OLD.fencing_token
  OR NEW.source_execution_id IS NOT OLD.source_execution_id
  OR NEW.source_execution_revision IS NOT OLD.source_execution_revision
  OR NEW.source_attempt_number IS NOT OLD.source_attempt_number
  OR NEW.source_fencing_token IS NOT OLD.source_fencing_token
  OR NEW.source_observation_number IS NOT OLD.source_observation_number
  OR NEW.contract_id <> OLD.contract_id OR NEW.adapter_id <> OLD.adapter_id OR NEW.adapter_version <> OLD.adapter_version
  OR NEW.policy_binding_reference <> OLD.policy_binding_reference OR NEW.workspace_mode <> OLD.workspace_mode
  OR NEW.backend_execution_id IS NOT OLD.backend_execution_id OR NEW.thread_id IS NOT OLD.thread_id
  OR NEW.previous_receipt_id IS NOT OLD.previous_receipt_id OR NEW.expected_journal_revision IS NOT OLD.expected_journal_revision
  OR NEW.requested_deadline <> OLD.requested_deadline OR NEW.continuation_reference IS NOT OLD.continuation_reference
  OR NEW.required_action_receipt_id IS NOT OLD.required_action_receipt_id OR NEW.expected_lifecycle IS NOT OLD.expected_lifecycle
  OR NEW.reason_code IS NOT OLD.reason_code OR NEW.report_id IS NOT OLD.report_id
  OR NEW.report_operation IS NOT OLD.report_operation OR NEW.report_code IS NOT OLD.report_code
  OR NEW.evidence_reference IS NOT OLD.evidence_reference OR NEW.last_observation_number <> OLD.last_observation_number
  OR NOT (
    (NEW.current_authorization_decision_id = OLD.current_authorization_decision_id
      AND NEW.authorization_binding_revision = OLD.authorization_binding_revision)
    OR (NEW.authorization_binding_revision = OLD.authorization_binding_revision + 1
      AND NEW.current_authorization_decision_id <> OLD.current_authorization_decision_id
      AND EXISTS (
        SELECT 1 FROM execution_intent_authorization_bindings AS binding
        WHERE binding.intent_id = OLD.intent_id
          AND binding.binding_revision = NEW.authorization_binding_revision
          AND binding.decision_id = NEW.current_authorization_decision_id
          AND binding.prior_decision_id = OLD.current_authorization_decision_id
      ))
  )
  OR NOT (
    (NEW.last_error_category IS OLD.last_error_category
      AND NEW.last_error_code IS OLD.last_error_code
      AND NEW.last_error_retryable IS OLD.last_error_retryable
      AND NEW.last_error_ambiguous IS OLD.last_error_ambiguous
      AND NEW.retry_after IS OLD.retry_after
      AND NEW.retry_count = OLD.retry_count)
    OR (OLD.state = 'executing' AND NEW.state IN ('retry_wait', 'ambiguous', 'failed')
      AND NEW.last_error_category IS NOT NULL AND NEW.last_error_code IS NOT NULL
      AND NEW.last_error_retryable IS NOT NULL AND NEW.last_error_ambiguous IS NOT NULL
      AND NEW.retry_count = OLD.retry_count + 1)
  )
  OR NEW.created_at <> OLD.created_at OR NEW.updated_at <= OLD.updated_at OR NEW.revision <> OLD.revision + 1
  OR NOT (
    (OLD.state = 'pending' AND NEW.state IN ('executing', 'finalized'))
    OR (OLD.state = 'executing' AND NEW.state = 'executing'
      AND NEW.authorization_binding_revision = OLD.authorization_binding_revision + 1)
    OR (OLD.state = 'executing' AND NEW.state IN ('observed', 'retry_wait', 'ambiguous', 'failed', 'finalized'))
    OR (OLD.state = 'retry_wait' AND NEW.state IN ('executing', 'finalized'))
    OR (OLD.state = 'observed' AND NEW.state IN ('verified', 'ambiguous', 'failed'))
    OR (OLD.state = 'ambiguous' AND NEW.state IN ('observed', 'finalized'))
    OR (OLD.state = 'failed' AND NEW.state = 'finalized')
    OR (OLD.state = 'verified' AND NEW.state = 'finalized')
  )
BEGIN
  SELECT RAISE(ABORT, 'execution intent transition is not one exact CAS step');
END;

CREATE TRIGGER execution_operation_intents_no_delete BEFORE DELETE ON execution_operation_intents BEGIN
  SELECT RAISE(ABORT, 'execution intents cannot be deleted');
END;

CREATE TRIGGER execution_observations_no_update BEFORE UPDATE ON execution_observations BEGIN
  SELECT RAISE(ABORT, 'execution observations are immutable');
END;

CREATE TRIGGER execution_observations_no_delete BEFORE DELETE ON execution_observations BEGIN
  SELECT RAISE(ABORT, 'execution observations are immutable');
END;

CREATE TRIGGER execution_verified_receipts_no_update BEFORE UPDATE ON execution_verified_receipts BEGIN
  SELECT RAISE(ABORT, 'verified execution receipts are immutable');
END;

CREATE TRIGGER execution_verified_receipts_no_delete BEFORE DELETE ON execution_verified_receipts BEGIN
  SELECT RAISE(ABORT, 'verified execution receipts are immutable');
END;

CREATE TRIGGER execution_finalizations_no_update BEFORE UPDATE ON execution_finalizations BEGIN
  SELECT RAISE(ABORT, 'execution finalizations are immutable');
END;

CREATE TRIGGER execution_finalizations_no_delete BEFORE DELETE ON execution_finalizations BEGIN
  SELECT RAISE(ABORT, 'execution finalizations are immutable');
END;

CREATE TRIGGER execution_terminal_states_no_update BEFORE UPDATE ON execution_terminal_states BEGIN
  SELECT RAISE(ABORT, 'execution terminal states are immutable');
END;

CREATE TRIGGER execution_terminal_states_no_delete BEFORE DELETE ON execution_terminal_states BEGIN
  SELECT RAISE(ABORT, 'execution terminal states are immutable');
END;

CREATE TRIGGER manual_backend_turns_update_guard
BEFORE UPDATE ON manual_backend_turns
WHEN NEW.backend_execution_id <> OLD.backend_execution_id OR NEW.thread_id <> OLD.thread_id
  OR NEW.start_idempotency_key <> OLD.start_idempotency_key OR NEW.project_id <> OLD.project_id
  OR NEW.project_resource_revision <> OLD.project_resource_revision OR NEW.project_config_revision <> OLD.project_config_revision
  OR NEW.task_id <> OLD.task_id OR NEW.task_revision <> OLD.task_revision OR NEW.input_reference <> OLD.input_reference
  OR NEW.execution_id <> OLD.execution_id OR NEW.execution_revision <> OLD.execution_revision
  OR NEW.attempt_number <> OLD.attempt_number OR NEW.fencing_token <> OLD.fencing_token
  OR NEW.predecessor_backend_execution_id IS NOT OLD.predecessor_backend_execution_id
  OR NEW.predecessor_thread_id IS NOT OLD.predecessor_thread_id
  OR NEW.policy_binding_reference <> OLD.policy_binding_reference OR NEW.workspace_mode <> OLD.workspace_mode
  OR NEW.created_at <> OLD.created_at OR NEW.updated_at <= OLD.updated_at OR NEW.revision <> OLD.revision + 1
  OR OLD.lifecycle IN ('turn_succeeded', 'failed', 'cancelled')
BEGIN
  SELECT RAISE(ABORT, 'Manual turn update violates identity, fence, revision or terminal immutability');
END;

CREATE TRIGGER manual_backend_turns_no_delete BEFORE DELETE ON manual_backend_turns BEGIN
  SELECT RAISE(ABORT, 'Manual turns cannot be deleted');
END;

CREATE TRIGGER manual_backend_operations_no_update BEFORE UPDATE ON manual_backend_operations BEGIN
  SELECT RAISE(ABORT, 'Manual backend operations are immutable');
END;

CREATE TRIGGER manual_backend_operations_no_delete BEFORE DELETE ON manual_backend_operations BEGIN
  SELECT RAISE(ABORT, 'Manual backend operations are immutable');
END;

CREATE TRIGGER manual_completion_decisions_no_update BEFORE UPDATE ON manual_completion_decisions BEGIN
  SELECT RAISE(ABORT, 'Manual completion decisions are immutable');
END;

CREATE TRIGGER manual_completion_decisions_no_delete BEFORE DELETE ON manual_completion_decisions BEGIN
  SELECT RAISE(ABORT, 'Manual completion decisions are immutable');
END;

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

CREATE TABLE workspace_generations (
  workspace_id TEXT NOT NULL CHECK (length(workspace_id) BETWEEN 1 AND 128),
  generation INTEGER NOT NULL CHECK (generation > 0),
  revision INTEGER NOT NULL CHECK (revision > 0),
  status TEXT NOT NULL CHECK (status IN (
    'allocated', 'reserved', 'creating', 'ready', 'cleaning', 'recovery_required', 'cleaned'
  )),
  project_id TEXT NOT NULL CHECK (length(project_id) > 0),
  project_resource_revision INTEGER NOT NULL CHECK (project_resource_revision > 0),
  project_config_revision INTEGER NOT NULL CHECK (project_config_revision > 0),
  project_root_key TEXT NOT NULL CHECK (length(project_root_key) BETWEEN 1 AND 128),
  task_id TEXT NOT NULL CHECK (length(task_id) > 0),
  task_revision INTEGER NOT NULL CHECK (task_revision > 0),
  run_id TEXT NOT NULL CHECK (length(run_id) BETWEEN 1 AND 128),
  run_revision INTEGER NOT NULL CHECK (run_revision > 0),
  member_id TEXT NOT NULL CHECK (length(member_id) BETWEEN 1 AND 128),
  membership_revision INTEGER NOT NULL CHECK (membership_revision > 0),
  member_revision INTEGER NOT NULL CHECK (member_revision > 0),
  execution_id TEXT NOT NULL CHECK (length(execution_id) BETWEEN 1 AND 128),
  execution_revision INTEGER NOT NULL CHECK (execution_revision > 0),
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  fencing_token INTEGER NOT NULL CHECK (fencing_token > 0),
  workspace_root_key TEXT NOT NULL CHECK (length(workspace_root_key) BETWEEN 1 AND 128),
  creator_operation_id TEXT NOT NULL UNIQUE CHECK (length(creator_operation_id) BETWEEN 1 AND 128),
  predecessor_generation INTEGER,
  predecessor_revision INTEGER,
  base_reference TEXT NOT NULL CHECK (length(base_reference) BETWEEN 1 AND 256),
  contract_id TEXT NOT NULL CHECK (contract_id = 'ato.workspace/v1'),
  adapter_id TEXT NOT NULL CHECK (length(adapter_id) BETWEEN 1 AND 128),
  adapter_version TEXT NOT NULL CHECK (length(adapter_version) BETWEEN 1 AND 128),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  PRIMARY KEY (workspace_id, generation),
  CHECK (
    (generation = 1 AND predecessor_generation IS NULL AND predecessor_revision IS NULL)
    OR
    (generation > 1 AND predecessor_generation = generation - 1 AND predecessor_revision > 0)
  ),
  FOREIGN KEY (project_id) REFERENCES project_registry(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (run_id) REFERENCES dispatcher_runs(run_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (member_id) REFERENCES dispatcher_members(member_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (execution_id) REFERENCES execution_attempts(execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE UNIQUE INDEX workspace_generations_current_owner_index
  ON workspace_generations(project_id, task_id, run_id, execution_id)
  WHERE status <> 'cleaned';

CREATE TABLE workspace_authorization_decisions (
  decision_id TEXT PRIMARY KEY NOT NULL CHECK (length(decision_id) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) BETWEEN 1 AND 128),
  operation_id TEXT NOT NULL CHECK (length(operation_id) BETWEEN 1 AND 128),
  binding_revision INTEGER NOT NULL CHECK (binding_revision > 0),
  phase TEXT NOT NULL CHECK (phase IN ('prepare', 'act', 'finalize')),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action IN (
    'workspace.reserve', 'workspace.create', 'workspace.inspect', 'workspace.recover', 'workspace.cleanup'
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
  project_id TEXT NOT NULL CHECK (length(project_id) > 0),
  project_resource_revision INTEGER NOT NULL CHECK (project_resource_revision > 0),
  project_config_revision INTEGER NOT NULL CHECK (project_config_revision > 0),
  execution_id TEXT NOT NULL CHECK (length(execution_id) BETWEEN 1 AND 128),
  execution_revision INTEGER NOT NULL CHECK (execution_revision > 0),
  fencing_token INTEGER NOT NULL CHECK (fencing_token > 0),
  workspace_id TEXT CHECK (workspace_id IS NULL OR length(workspace_id) BETWEEN 1 AND 128),
  generation INTEGER CHECK (generation IS NULL OR generation > 0),
  generation_revision INTEGER CHECK (generation_revision IS NULL OR generation_revision > 0),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  UNIQUE(operation_id, binding_revision),
  CHECK ((result = 'allow' AND reason = 'allowed' AND grant_id IS NOT NULL AND grant_revision > 0
      AND workspace_id IS NOT NULL AND generation > 0 AND generation_revision > 0)
    OR (result = 'deny' AND reason <> 'allowed')),
  CHECK ((grant_id IS NULL AND grant_revision IS NULL) OR (length(grant_id) > 0 AND grant_revision > 0)),
  CHECK ((workspace_id IS NULL AND generation IS NULL AND generation_revision IS NULL)
    OR (workspace_id IS NOT NULL AND generation > 0 AND generation_revision > 0)),
  FOREIGN KEY (grant_id) REFERENCES authorization_grants(grant_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (project_id) REFERENCES project_registry(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (execution_id) REFERENCES execution_attempts(execution_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, generation) REFERENCES workspace_generations(workspace_id, generation) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE workspace_operation_intents (
  intent_id TEXT PRIMARY KEY NOT NULL CHECK (length(intent_id) BETWEEN 1 AND 128),
  operation_id TEXT NOT NULL UNIQUE CHECK (length(operation_id) BETWEEN 1 AND 128),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  operation_kind TEXT NOT NULL CHECK (operation_kind IN ('reserve', 'create', 'inspect', 'recover', 'cleanup')),
  action TEXT NOT NULL CHECK (action = 'workspace.' || operation_kind),
  state TEXT NOT NULL CHECK (state IN ('pending', 'executing', 'observed', 'verified', 'finalized', 'ambiguous', 'failed')),
  revision INTEGER NOT NULL CHECK (revision > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  causation_id TEXT CHECK (causation_id IS NULL OR length(causation_id) BETWEEN 1 AND 128),
  current_authorization_decision_id TEXT NOT NULL UNIQUE CHECK (length(current_authorization_decision_id) BETWEEN 1 AND 128),
  authorization_binding_revision INTEGER NOT NULL CHECK (authorization_binding_revision > 0),
  confirmation_id TEXT CHECK (confirmation_id IS NULL OR length(confirmation_id) BETWEEN 1 AND 128),
  workspace_id TEXT NOT NULL CHECK (length(workspace_id) BETWEEN 1 AND 128),
  generation INTEGER NOT NULL CHECK (generation > 0),
  expected_generation_revision INTEGER NOT NULL CHECK (expected_generation_revision > 0),
  expected_generation_status TEXT NOT NULL CHECK (expected_generation_status IN (
    'allocated', 'reserved', 'creating', 'ready', 'cleaning', 'recovery_required', 'cleaned'
  )),
  last_observation_number INTEGER NOT NULL CHECK (last_observation_number >= 0),
  last_failure_category TEXT CHECK (last_failure_category IS NULL OR length(last_failure_category) BETWEEN 1 AND 64),
  last_failure_code TEXT CHECK (last_failure_code IS NULL OR length(last_failure_code) BETWEEN 1 AND 64),
  last_failure_retryable INTEGER CHECK (last_failure_retryable IS NULL OR last_failure_retryable IN (0, 1)),
  last_failure_ambiguous INTEGER CHECK (last_failure_ambiguous IS NULL OR last_failure_ambiguous IN (0, 1)),
  contract_id TEXT NOT NULL CHECK (contract_id = 'ato.workspace/v1'),
  adapter_id TEXT NOT NULL CHECK (length(adapter_id) BETWEEN 1 AND 128),
  adapter_version TEXT NOT NULL CHECK (length(adapter_version) BETWEEN 1 AND 128),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  CHECK (
    (last_failure_category IS NULL AND last_failure_code IS NULL AND last_failure_retryable IS NULL AND last_failure_ambiguous IS NULL)
    OR
    (last_failure_category IS NOT NULL AND last_failure_code IS NOT NULL AND last_failure_retryable IN (0, 1) AND last_failure_ambiguous IN (0, 1))
  ),
  FOREIGN KEY (current_authorization_decision_id) REFERENCES workspace_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, generation) REFERENCES workspace_generations(workspace_id, generation) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE workspace_observations (
  observation_id TEXT PRIMARY KEY NOT NULL CHECK (length(observation_id) BETWEEN 1 AND 128),
  intent_id TEXT NOT NULL CHECK (length(intent_id) BETWEEN 1 AND 128),
  observation_number INTEGER NOT NULL CHECK (observation_number > 0),
  adapter_receipt_id TEXT NOT NULL UNIQUE CHECK (length(adapter_receipt_id) BETWEEN 1 AND 128),
  receipt_sha256 TEXT NOT NULL CHECK (length(receipt_sha256) = 64 AND receipt_sha256 NOT GLOB '*[^0-9A-F]*'),
  authorization_decision_id TEXT NOT NULL CHECK (length(authorization_decision_id) BETWEEN 1 AND 128),
  external_state TEXT NOT NULL CHECK (external_state IN ('absent', 'reserved', 'partial', 'complete', 'ambiguous', 'removed', 'refused')),
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'refused', 'ambiguous')),
  code TEXT NOT NULL CHECK (length(code) BETWEEN 1 AND 64),
  path_safety TEXT NOT NULL CHECK (path_safety IN ('safe', 'unsafe', 'unknown')),
  ownership_match INTEGER CHECK (ownership_match IS NULL OR ownership_match IN (0, 1)),
  tracked_count INTEGER NOT NULL CHECK (tracked_count BETWEEN 0 AND 1000000),
  modified_count INTEGER NOT NULL CHECK (modified_count BETWEEN 0 AND tracked_count),
  untracked_count INTEGER NOT NULL CHECK (untracked_count BETWEEN 0 AND 1000000),
  ignored_count INTEGER NOT NULL CHECK (ignored_count BETWEEN 0 AND 1000000),
  evidence_reference TEXT CHECK (
    evidence_reference IS NULL OR (
      length(evidence_reference) BETWEEN 1 AND 128
      AND substr(evidence_reference, 1, 1) GLOB '[A-Za-z0-9]'
      AND evidence_reference NOT GLOB '*[^A-Za-z0-9._:-]*'
    )
  ),
  observed_at TEXT NOT NULL CHECK (length(observed_at) > 0),
  UNIQUE(intent_id, observation_number),
  FOREIGN KEY (intent_id) REFERENCES workspace_operation_intents(intent_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (authorization_decision_id) REFERENCES workspace_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE workspace_verified_receipts (
  verified_receipt_id TEXT PRIMARY KEY NOT NULL CHECK (length(verified_receipt_id) BETWEEN 1 AND 128),
  intent_id TEXT NOT NULL UNIQUE CHECK (length(intent_id) BETWEEN 1 AND 128),
  observation_id TEXT NOT NULL UNIQUE CHECK (length(observation_id) BETWEEN 1 AND 128),
  observation_number INTEGER NOT NULL CHECK (observation_number > 0),
  adapter_receipt_id TEXT NOT NULL UNIQUE CHECK (length(adapter_receipt_id) BETWEEN 1 AND 128),
  receipt_sha256 TEXT NOT NULL CHECK (length(receipt_sha256) = 64 AND receipt_sha256 NOT GLOB '*[^0-9A-F]*'),
  workspace_id TEXT NOT NULL CHECK (length(workspace_id) BETWEEN 1 AND 128),
  generation INTEGER NOT NULL CHECK (generation > 0),
  generation_revision INTEGER NOT NULL CHECK (generation_revision > 0),
  external_state TEXT NOT NULL CHECK (external_state IN ('absent', 'reserved', 'complete', 'removed', 'refused')),
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'refused')),
  code TEXT NOT NULL CHECK (length(code) BETWEEN 1 AND 64),
  verified_at TEXT NOT NULL CHECK (length(verified_at) > 0),
  FOREIGN KEY (intent_id) REFERENCES workspace_operation_intents(intent_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (observation_id) REFERENCES workspace_observations(observation_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, generation) REFERENCES workspace_generations(workspace_id, generation) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE workspace_finalizations (
  finalization_id TEXT PRIMARY KEY NOT NULL CHECK (length(finalization_id) BETWEEN 1 AND 128),
  intent_id TEXT NOT NULL UNIQUE CHECK (length(intent_id) BETWEEN 1 AND 128),
  verified_receipt_id TEXT UNIQUE,
  authorization_decision_id TEXT NOT NULL CHECK (length(authorization_decision_id) BETWEEN 1 AND 128),
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'refused', 'ambiguous', 'failed')),
  code TEXT NOT NULL CHECK (length(code) BETWEEN 1 AND 64),
  resulting_generation_status TEXT NOT NULL CHECK (resulting_generation_status IN (
    'allocated', 'reserved', 'creating', 'ready', 'cleaning', 'recovery_required', 'cleaned'
  )),
  resulting_generation_revision INTEGER NOT NULL CHECK (resulting_generation_revision > 0),
  finalized_at TEXT NOT NULL CHECK (length(finalized_at) > 0),
  CHECK ((outcome IN ('succeeded', 'refused') AND verified_receipt_id IS NOT NULL)
    OR (outcome IN ('ambiguous', 'failed') AND verified_receipt_id IS NULL)),
  FOREIGN KEY (intent_id) REFERENCES workspace_operation_intents(intent_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (verified_receipt_id) REFERENCES workspace_verified_receipts(verified_receipt_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (authorization_decision_id) REFERENCES workspace_authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE workspace_events (
  event_id TEXT PRIMARY KEY NOT NULL CHECK (length(event_id) BETWEEN 1 AND 128),
  operation_id TEXT NOT NULL CHECK (length(operation_id) BETWEEN 1 AND 128),
  intent_id TEXT CHECK (intent_id IS NULL OR length(intent_id) BETWEEN 1 AND 128),
  event_kind TEXT NOT NULL CHECK (event_kind IN (
    'workspace.operation.prepared', 'workspace.operation.denied', 'workspace.operation.executing',
    'workspace.operation.observed', 'workspace.operation.verified', 'workspace.operation.finalized',
    'workspace.operation.reconciled'
  )),
  outcome TEXT NOT NULL CHECK (outcome IN ('accepted', 'denied', 'refused', 'ambiguous', 'failed')),
  reason_code TEXT NOT NULL CHECK (length(reason_code) BETWEEN 1 AND 64),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  causation_id TEXT CHECK (causation_id IS NULL OR length(causation_id) BETWEEN 1 AND 128),
  workspace_id TEXT CHECK (workspace_id IS NULL OR length(workspace_id) BETWEEN 1 AND 128),
  generation INTEGER CHECK (generation IS NULL OR generation > 0),
  generation_revision INTEGER CHECK (generation_revision IS NULL OR generation_revision > 0),
  observation_number INTEGER CHECK (observation_number IS NULL OR observation_number > 0),
  evidence_reference TEXT CHECK (
    evidence_reference IS NULL OR (
      length(evidence_reference) BETWEEN 1 AND 128
      AND substr(evidence_reference, 1, 1) GLOB '[A-Za-z0-9]'
      AND evidence_reference NOT GLOB '*[^A-Za-z0-9._:-]*'
    )
  ),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK ((workspace_id IS NULL AND generation IS NULL AND generation_revision IS NULL)
    OR (workspace_id IS NOT NULL AND generation > 0 AND generation_revision > 0)),
  FOREIGN KEY (intent_id) REFERENCES workspace_operation_intents(intent_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, generation) REFERENCES workspace_generations(workspace_id, generation) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TRIGGER workspace_generations_update_guard
BEFORE UPDATE ON workspace_generations
WHEN NEW.workspace_id<>OLD.workspace_id OR NEW.generation<>OLD.generation
  OR NEW.project_id<>OLD.project_id OR NEW.project_resource_revision<>OLD.project_resource_revision
  OR NEW.project_config_revision<>OLD.project_config_revision OR NEW.project_root_key<>OLD.project_root_key
  OR NEW.task_id<>OLD.task_id OR NEW.task_revision<>OLD.task_revision
  OR NEW.run_id<>OLD.run_id OR NEW.run_revision<>OLD.run_revision
  OR NEW.member_id<>OLD.member_id OR NEW.membership_revision<>OLD.membership_revision
  OR NEW.member_revision<>OLD.member_revision
  OR NEW.execution_id<>OLD.execution_id OR NEW.execution_revision<>OLD.execution_revision
  OR NEW.attempt_number<>OLD.attempt_number OR NEW.fencing_token<>OLD.fencing_token
  OR NEW.workspace_root_key<>OLD.workspace_root_key OR NEW.creator_operation_id<>OLD.creator_operation_id
  OR NEW.predecessor_generation IS NOT OLD.predecessor_generation OR NEW.predecessor_revision IS NOT OLD.predecessor_revision
  OR NEW.base_reference<>OLD.base_reference OR NEW.contract_id<>OLD.contract_id
  OR NEW.adapter_id<>OLD.adapter_id OR NEW.adapter_version<>OLD.adapter_version
  OR NEW.created_at<>OLD.created_at OR NEW.updated_at<=OLD.updated_at OR NEW.revision<>OLD.revision+1
  OR NOT (
    (OLD.status='allocated' AND NEW.status IN ('allocated', 'reserved', 'recovery_required'))
    OR (OLD.status='reserved' AND NEW.status='creating')
    OR (OLD.status='creating' AND NEW.status IN ('ready', 'reserved', 'recovery_required'))
    OR (OLD.status='ready' AND NEW.status='cleaning')
    OR (OLD.status='cleaning' AND NEW.status IN ('cleaned', 'ready', 'recovery_required'))
    OR (OLD.status='recovery_required' AND NEW.status IN ('allocated', 'reserved', 'ready', 'cleaned'))
  )
BEGIN
  SELECT RAISE(ABORT, 'workspace generation update violates identity, revision or lifecycle');
END;

CREATE TRIGGER workspace_generations_no_delete BEFORE DELETE ON workspace_generations BEGIN
  SELECT RAISE(ABORT, 'workspace generations cannot be deleted');
END;

CREATE TRIGGER workspace_authorization_decisions_no_update BEFORE UPDATE ON workspace_authorization_decisions BEGIN
  SELECT RAISE(ABORT, 'workspace authorization decisions are immutable');
END;

CREATE TRIGGER workspace_authorization_decisions_no_delete BEFORE DELETE ON workspace_authorization_decisions BEGIN
  SELECT RAISE(ABORT, 'workspace authorization decisions are immutable');
END;

CREATE TRIGGER workspace_operation_intents_update_guard
BEFORE UPDATE ON workspace_operation_intents
WHEN NEW.intent_id<>OLD.intent_id OR NEW.operation_id<>OLD.operation_id OR NEW.idempotency_key<>OLD.idempotency_key
  OR NEW.operation_kind<>OLD.operation_kind OR NEW.action<>OLD.action OR NEW.actor_id<>OLD.actor_id
  OR NEW.request_id<>OLD.request_id OR NEW.correlation_id<>OLD.correlation_id
  OR NEW.causation_id IS NOT OLD.causation_id OR NEW.confirmation_id IS NOT OLD.confirmation_id
  OR NEW.workspace_id<>OLD.workspace_id OR NEW.generation<>OLD.generation
  OR NEW.contract_id<>OLD.contract_id OR NEW.adapter_id<>OLD.adapter_id OR NEW.adapter_version<>OLD.adapter_version
  OR NEW.created_at<>OLD.created_at OR NEW.updated_at<=OLD.updated_at OR NEW.revision<>OLD.revision+1
  OR NEW.authorization_binding_revision<OLD.authorization_binding_revision
  OR NEW.last_observation_number<OLD.last_observation_number
  OR NOT (
    (OLD.state='pending' AND NEW.state IN ('executing', 'failed'))
    OR (OLD.state='executing' AND NEW.state IN ('observed', 'ambiguous', 'failed'))
    OR (OLD.state='observed' AND NEW.state IN ('verified', 'ambiguous', 'failed'))
    OR (OLD.state='verified' AND NEW.state IN ('finalized', 'ambiguous'))
  )
BEGIN
  SELECT RAISE(ABORT, 'workspace intent update violates identity, revision or lifecycle');
END;

CREATE TRIGGER workspace_operation_intents_no_delete BEFORE DELETE ON workspace_operation_intents BEGIN
  SELECT RAISE(ABORT, 'workspace intents cannot be deleted');
END;

CREATE TRIGGER workspace_observations_no_update BEFORE UPDATE ON workspace_observations BEGIN
  SELECT RAISE(ABORT, 'workspace observations are immutable');
END;

CREATE TRIGGER workspace_observations_no_delete BEFORE DELETE ON workspace_observations BEGIN
  SELECT RAISE(ABORT, 'workspace observations are immutable');
END;

CREATE TRIGGER workspace_verified_receipts_no_update BEFORE UPDATE ON workspace_verified_receipts BEGIN
  SELECT RAISE(ABORT, 'workspace verified receipts are immutable');
END;

CREATE TRIGGER workspace_verified_receipts_no_delete BEFORE DELETE ON workspace_verified_receipts BEGIN
  SELECT RAISE(ABORT, 'workspace verified receipts are immutable');
END;

CREATE TRIGGER workspace_finalizations_no_update BEFORE UPDATE ON workspace_finalizations BEGIN
  SELECT RAISE(ABORT, 'workspace finalizations are immutable');
END;

CREATE TRIGGER workspace_finalizations_no_delete BEFORE DELETE ON workspace_finalizations BEGIN
  SELECT RAISE(ABORT, 'workspace finalizations are immutable');
END;

CREATE TRIGGER workspace_events_no_update BEFORE UPDATE ON workspace_events BEGIN
  SELECT RAISE(ABORT, 'workspace events are immutable');
END;

CREATE TRIGGER workspace_events_no_delete BEFORE DELETE ON workspace_events BEGIN
  SELECT RAISE(ABORT, 'workspace events are immutable');
END;
