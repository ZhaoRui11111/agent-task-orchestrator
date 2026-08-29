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

CREATE TABLE application_requests (
  request_id TEXT PRIMARY KEY CHECK (length(request_id) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action IN (
    'authorization.grant.issue', 'authorization.grant.inspect', 'authorization.grant.revoke',
    'policy.evaluate', 'project.register', 'project.update', 'project.disable', 'project.inspect',
    'task.create', 'task.update', 'task.mark_ready', 'task.cancel', 'task.inspect',
    'dependency.add', 'dependency.remove'
  )),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('runtime', 'project', 'task', 'grant')),
  target_id TEXT NOT NULL CHECK (length(target_id) > 0),
  target_revision INTEGER CHECK (target_revision IS NULL OR target_revision > 0),
  result TEXT NOT NULL CHECK (result IN ('bootstrap', 'allow', 'deny')),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK ((result = 'bootstrap' AND action = 'authorization.grant.issue') OR result <> 'bootstrap')
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
    'dependency.add', 'dependency.remove'
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
  created_request_id TEXT NOT NULL,
  revoked_request_id TEXT,
  CHECK (
    (scope_kind = 'runtime' AND scope_project_id IS NULL AND scope_resource_revision IS NULL AND scope_config_revision IS NULL)
    OR
    (scope_kind = 'project' AND length(scope_project_id) > 0 AND scope_resource_revision > 0 AND scope_config_revision > 0)
  ),
  CHECK (revoked_at IS NULL OR length(revoked_at) > 0),
  CHECK ((issuer_grant_id IS NULL AND source_grant_id IS NULL) OR (issuer_grant_id IS NOT NULL AND source_grant_id IS NOT NULL)),
  CHECK ((revoked_at IS NULL AND revoked_request_id IS NULL) OR (revoked_at IS NOT NULL AND revoked_request_id IS NOT NULL)),
  FOREIGN KEY (scope_project_id) REFERENCES project_registry(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (issuer_grant_id) REFERENCES authorization_grants(grant_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (source_grant_id) REFERENCES authorization_grants(grant_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
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
    'dependency.add', 'dependency.remove'
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
    'bootstrap', 'grant.issued', 'grant.revoked', 'grant.inspected',
    'project.registered', 'project.updated', 'project.disabled', 'project.inspected',
    'task.created', 'task.updated', 'task.ready', 'task.cancelled', 'task.inspected',
    'dependency.added', 'dependency.removed', 'policy.evaluated', 'authorization.denied'
  )),
  result TEXT NOT NULL CHECK (result IN ('accepted', 'denied')),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('runtime', 'project', 'task', 'grant')),
  target_id TEXT NOT NULL CHECK (length(target_id) > 0),
  target_revision INTEGER CHECK (target_revision IS NULL OR target_revision > 0),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 64),
  details_json TEXT NOT NULL CHECK (length(details_json) BETWEEN 2 AND 1024),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK ((result = 'denied' AND decision_id IS NOT NULL) OR result = 'accepted'),
  FOREIGN KEY (request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (decision_id) REFERENCES authorization_decisions(decision_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

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
CREATE TRIGGER project_registry_no_delete
BEFORE DELETE ON project_registry BEGIN
  SELECT RAISE(ABORT, 'ProjectRegistry entries cannot be deleted');
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
