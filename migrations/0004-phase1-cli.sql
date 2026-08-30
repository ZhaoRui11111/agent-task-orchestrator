PRAGMA defer_foreign_keys=ON;

DROP TRIGGER application_requests_no_update;
DROP TRIGGER application_requests_no_delete;
DROP TRIGGER authorization_bootstrap_no_update;
DROP TRIGGER authorization_bootstrap_no_delete;
DROP TRIGGER authorization_grants_revoke_only;
DROP TRIGGER authorization_grants_no_delete;
DROP TRIGGER authorization_decisions_no_update;
DROP TRIGGER authorization_decisions_no_delete;
DROP TRIGGER application_audit_no_update;
DROP TRIGGER application_audit_no_delete;
DROP INDEX authorization_grants_actor_action_index;
DROP INDEX authorization_grants_project_index;

ALTER TABLE application_audit RENAME TO application_audit_v3;
ALTER TABLE authorization_decisions RENAME TO authorization_decisions_v3;
ALTER TABLE authorization_grants RENAME TO authorization_grants_v3;
ALTER TABLE authorization_bootstrap RENAME TO authorization_bootstrap_v3;
ALTER TABLE application_requests RENAME TO application_requests_v3;

CREATE TABLE application_requests (
  request_id TEXT PRIMARY KEY CHECK (length(request_id) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action IN (
    'authorization.grant.issue', 'authorization.grant.inspect', 'authorization.grant.revoke',
    'policy.evaluate', 'project.register', 'project.update', 'project.disable', 'project.inspect',
    'task.create', 'task.update', 'task.mark_ready', 'task.cancel', 'task.inspect',
    'dependency.add', 'dependency.remove', 'authorization.grant.list', 'runtime.status',
    'runtime.backup', 'runtime.restore', 'authorization.capability.renew'
  )),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('runtime', 'project', 'task', 'grant', 'backup')),
  target_id TEXT NOT NULL CHECK (length(target_id) > 0),
  target_revision INTEGER CHECK (target_revision IS NULL OR target_revision > 0),
  result TEXT NOT NULL CHECK (result IN ('bootstrap', 'allow', 'deny', 'renewal')),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  CHECK (result <> 'bootstrap' OR (action = 'authorization.grant.issue' AND target_kind = 'runtime' AND target_id = 'runtime' AND target_revision IS NULL)),
  CHECK (
    (action = 'authorization.capability.renew' AND result = 'renewal' AND target_kind = 'runtime' AND target_id = 'runtime' AND target_revision IS NULL)
    OR (action <> 'authorization.capability.renew' AND result <> 'renewal')
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
  vocabulary_version INTEGER NOT NULL CHECK (vocabulary_version = 4),
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
    'runtime.backup', 'runtime.restore'
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
    'runtime.backup', 'runtime.restore', 'authorization.capability.renew'
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
    'capability.renewed', 'runtime.status.inspected', 'backup.authorized', 'restore.authorized'
  )),
  result TEXT NOT NULL CHECK (result IN ('accepted', 'denied')),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('runtime', 'project', 'task', 'grant', 'backup')),
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

INSERT INTO application_requests
SELECT request_id, correlation_id, actor_id, action, target_kind, target_id,
  target_revision, result, created_at
FROM application_requests_v3;

INSERT INTO authorization_bootstrap(
  singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
  runtime_platform, runtime_device, runtime_inode, runtime_mode, request_id,
  created_at, expires_at, vocabulary_version
)
SELECT singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
  runtime_platform, runtime_device, runtime_inode, runtime_mode, request_id,
  created_at, expires_at, 3
FROM authorization_bootstrap_v3;

INSERT INTO authorization_grants(
  grant_id, revision, actor_id, action, scope_kind, scope_project_id,
  scope_resource_revision, scope_config_revision, not_before, expires_at,
  revoked_at, issuer_grant_id, source_grant_id, capability_epoch_id,
  created_request_id, revoked_request_id
)
SELECT grant_id, revision, actor_id, action, scope_kind, scope_project_id,
  scope_resource_revision, scope_config_revision, not_before, expires_at,
  revoked_at, issuer_grant_id, source_grant_id, NULL,
  created_request_id, revoked_request_id
FROM authorization_grants_v3;

INSERT INTO authorization_decisions
SELECT decision_id, request_id, actor_id, action, result, reason, policy_result,
  grant_id, grant_revision, project_id, resource_revision, created_at
FROM authorization_decisions_v3;

INSERT INTO application_audit
SELECT audit_id, request_id, decision_id, event_kind, result, actor_id,
  correlation_id, target_kind, target_id, target_revision, reason, details_json, created_at
FROM application_audit_v3;

CREATE TEMP TABLE ep01d_migration_assertion (
  ok INTEGER NOT NULL CHECK (ok = 1)
) STRICT;
INSERT INTO ep01d_migration_assertion
SELECT (
  (SELECT count(*) FROM application_requests) = (SELECT count(*) FROM application_requests_v3)
  AND NOT EXISTS (
    SELECT request_id, correlation_id, actor_id, action, target_kind, target_id,
      target_revision, result, created_at FROM application_requests
    EXCEPT
    SELECT request_id, correlation_id, actor_id, action, target_kind, target_id,
      target_revision, result, created_at FROM application_requests_v3
  )
  AND NOT EXISTS (
    SELECT request_id, correlation_id, actor_id, action, target_kind, target_id,
      target_revision, result, created_at FROM application_requests_v3
    EXCEPT
    SELECT request_id, correlation_id, actor_id, action, target_kind, target_id,
      target_revision, result, created_at FROM application_requests
  )
  AND (SELECT count(*) FROM authorization_bootstrap) = (SELECT count(*) FROM authorization_bootstrap_v3)
  AND NOT EXISTS (
    SELECT singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
      runtime_platform, runtime_device, runtime_inode, runtime_mode, request_id,
      created_at, expires_at FROM authorization_bootstrap
    EXCEPT
    SELECT singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
      runtime_platform, runtime_device, runtime_inode, runtime_mode, request_id,
      created_at, expires_at FROM authorization_bootstrap_v3
  )
  AND NOT EXISTS (
    SELECT singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
      runtime_platform, runtime_device, runtime_inode, runtime_mode, request_id,
      created_at, expires_at FROM authorization_bootstrap_v3
    EXCEPT
    SELECT singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
      runtime_platform, runtime_device, runtime_inode, runtime_mode, request_id,
      created_at, expires_at FROM authorization_bootstrap
  )
  AND NOT EXISTS (SELECT 1 FROM authorization_bootstrap WHERE vocabulary_version <> 3)
  AND (SELECT count(*) FROM authorization_grants) = (SELECT count(*) FROM authorization_grants_v3)
  AND NOT EXISTS (
    SELECT grant_id, revision, actor_id, action, scope_kind, scope_project_id,
      scope_resource_revision, scope_config_revision, not_before, expires_at,
      revoked_at, issuer_grant_id, source_grant_id, created_request_id, revoked_request_id
    FROM authorization_grants
    EXCEPT
    SELECT grant_id, revision, actor_id, action, scope_kind, scope_project_id,
      scope_resource_revision, scope_config_revision, not_before, expires_at,
      revoked_at, issuer_grant_id, source_grant_id, created_request_id, revoked_request_id
    FROM authorization_grants_v3
  )
  AND NOT EXISTS (
    SELECT grant_id, revision, actor_id, action, scope_kind, scope_project_id,
      scope_resource_revision, scope_config_revision, not_before, expires_at,
      revoked_at, issuer_grant_id, source_grant_id, created_request_id, revoked_request_id
    FROM authorization_grants_v3
    EXCEPT
    SELECT grant_id, revision, actor_id, action, scope_kind, scope_project_id,
      scope_resource_revision, scope_config_revision, not_before, expires_at,
      revoked_at, issuer_grant_id, source_grant_id, created_request_id, revoked_request_id
    FROM authorization_grants
  )
  AND NOT EXISTS (SELECT 1 FROM authorization_grants WHERE capability_epoch_id IS NOT NULL)
  AND (SELECT count(*) FROM authorization_decisions) = (SELECT count(*) FROM authorization_decisions_v3)
  AND NOT EXISTS (
    SELECT decision_id, request_id, actor_id, action, result, reason, policy_result,
      grant_id, grant_revision, project_id, resource_revision, created_at
    FROM authorization_decisions
    EXCEPT
    SELECT decision_id, request_id, actor_id, action, result, reason, policy_result,
      grant_id, grant_revision, project_id, resource_revision, created_at
    FROM authorization_decisions_v3
  )
  AND NOT EXISTS (
    SELECT decision_id, request_id, actor_id, action, result, reason, policy_result,
      grant_id, grant_revision, project_id, resource_revision, created_at
    FROM authorization_decisions_v3
    EXCEPT
    SELECT decision_id, request_id, actor_id, action, result, reason, policy_result,
      grant_id, grant_revision, project_id, resource_revision, created_at
    FROM authorization_decisions
  )
  AND (SELECT count(*) FROM application_audit) = (SELECT count(*) FROM application_audit_v3)
  AND NOT EXISTS (
    SELECT audit_id, request_id, decision_id, event_kind, result, actor_id,
      correlation_id, target_kind, target_id, target_revision, reason, details_json, created_at
    FROM application_audit
    EXCEPT
    SELECT audit_id, request_id, decision_id, event_kind, result, actor_id,
      correlation_id, target_kind, target_id, target_revision, reason, details_json, created_at
    FROM application_audit_v3
  )
  AND NOT EXISTS (
    SELECT audit_id, request_id, decision_id, event_kind, result, actor_id,
      correlation_id, target_kind, target_id, target_revision, reason, details_json, created_at
    FROM application_audit_v3
    EXCEPT
    SELECT audit_id, request_id, decision_id, event_kind, result, actor_id,
      correlation_id, target_kind, target_id, target_revision, reason, details_json, created_at
    FROM application_audit
  )
  AND NOT EXISTS (SELECT 1 FROM authorization_local_identity)
  AND NOT EXISTS (SELECT 1 FROM authorization_capability_epochs)
  AND NOT EXISTS (SELECT 1 FROM application_lifecycle_authorizations)
  AND NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check)
);
DROP TABLE ep01d_migration_assertion;

DROP TABLE application_audit_v3;
DROP TABLE authorization_decisions_v3;
DROP TABLE authorization_grants_v3;
DROP TABLE authorization_bootstrap_v3;
DROP TABLE application_requests_v3;

CREATE TEMP TABLE ep01d_foreign_key_assertion (
  ok INTEGER NOT NULL CHECK (ok = 1)
) STRICT;
INSERT INTO ep01d_foreign_key_assertion
SELECT NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check);
DROP TABLE ep01d_foreign_key_assertion;

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
CREATE TRIGGER application_lifecycle_authorizations_no_update
BEFORE UPDATE ON application_lifecycle_authorizations BEGIN
  SELECT RAISE(ABORT, 'application lifecycle authorizations are immutable');
END;
CREATE TRIGGER application_lifecycle_authorizations_no_delete
BEFORE DELETE ON application_lifecycle_authorizations BEGIN
  SELECT RAISE(ABORT, 'application lifecycle authorizations are immutable');
END;
