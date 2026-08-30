CREATE TABLE authorization_capability_epochs_v6 (
  epoch_id TEXT PRIMARY KEY NOT NULL CHECK (length(epoch_id) BETWEEN 1 AND 128),
  epoch_revision INTEGER NOT NULL UNIQUE CHECK (epoch_revision > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  runtime_root_key TEXT NOT NULL CHECK (length(runtime_root_key) > 0),
  vocabulary_version INTEGER NOT NULL CHECK (vocabulary_version = 6),
  action_set_sha256 TEXT NOT NULL CHECK (length(action_set_sha256) = 64 AND action_set_sha256 NOT GLOB '*[^0-9A-F]*'),
  request_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  expires_at TEXT NOT NULL CHECK (length(expires_at) > 0),
  UNIQUE(epoch_id, request_id),
  FOREIGN KEY (actor_id, runtime_root_key) REFERENCES authorization_local_identity(actor_id, runtime_root_key) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE authorization_grants_v6 (
  grant_id TEXT PRIMARY KEY CHECK (length(grant_id) BETWEEN 1 AND 128),
  revision INTEGER NOT NULL CHECK (revision > 0),
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action IN (
    'execution.start', 'execution.inspect', 'execution.resume', 'execution.retry',
    'execution.cancel', 'execution.completion.accept'
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
    OR (scope_kind = 'project' AND length(scope_project_id) > 0 AND scope_resource_revision > 0 AND scope_config_revision > 0)
  ),
  CHECK ((issuer_grant_id IS NULL AND source_grant_id IS NULL) OR (issuer_grant_id IS NOT NULL AND source_grant_id IS NOT NULL)),
  CHECK ((revoked_at IS NULL AND revoked_request_id IS NULL) OR (length(revoked_at) > 0 AND revoked_request_id IS NOT NULL)),
  UNIQUE(capability_epoch_id, action),
  FOREIGN KEY (scope_project_id) REFERENCES project_registry(project_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (capability_epoch_id) REFERENCES authorization_capability_epochs_v6(epoch_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (created_request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (revoked_request_id) REFERENCES application_requests(request_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE INDEX authorization_grants_v6_actor_action_index
  ON authorization_grants_v6(actor_id, action, grant_id);
CREATE INDEX authorization_grants_v6_project_index
  ON authorization_grants_v6(scope_project_id, action, grant_id) WHERE scope_project_id IS NOT NULL;

CREATE TRIGGER authorization_grants_v6_global_id_guard
BEFORE INSERT ON authorization_grants_v6
WHEN EXISTS (SELECT 1 FROM authorization_grants WHERE grant_id=NEW.grant_id)
BEGIN
  SELECT RAISE(ABORT, 'authorization grant identifiers must be globally unique');
END;

CREATE TRIGGER authorization_grants_global_id_v6_guard
BEFORE INSERT ON authorization_grants
WHEN EXISTS (SELECT 1 FROM authorization_grants_v6 WHERE grant_id=NEW.grant_id)
BEGIN
  SELECT RAISE(ABORT, 'authorization grant identifiers must be globally unique');
END;

CREATE UNIQUE INDEX authorization_grants_id_action_v6_link_index
  ON authorization_grants(grant_id, action);

CREATE TABLE authorization_grant_epoch_v6_links (
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
  FOREIGN KEY (capability_epoch_id) REFERENCES authorization_capability_epochs_v6(epoch_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE application_lifecycle_digest_v6 (
  authorization_id TEXT PRIMARY KEY NOT NULL,
  state_digest_version INTEGER NOT NULL CHECK (state_digest_version = 3),
  FOREIGN KEY (authorization_id) REFERENCES application_lifecycle_authorizations(authorization_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

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

DROP TRIGGER execution_attempts_update_guard;
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

CREATE TRIGGER authorization_capability_epochs_v6_no_update
BEFORE UPDATE ON authorization_capability_epochs_v6 BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v6 capability epochs are immutable');
END;
CREATE TRIGGER authorization_capability_epochs_v6_no_delete
BEFORE DELETE ON authorization_capability_epochs_v6 BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v6 capability epochs cannot be deleted');
END;
CREATE TRIGGER authorization_grants_v6_revoke_only
BEFORE UPDATE ON authorization_grants_v6
WHEN NEW.grant_id <> OLD.grant_id OR NEW.actor_id <> OLD.actor_id OR NEW.action <> OLD.action
  OR NEW.scope_kind <> OLD.scope_kind OR NEW.scope_project_id IS NOT OLD.scope_project_id
  OR NEW.scope_resource_revision IS NOT OLD.scope_resource_revision OR NEW.scope_config_revision IS NOT OLD.scope_config_revision
  OR NEW.not_before <> OLD.not_before OR NEW.expires_at <> OLD.expires_at
  OR NEW.issuer_grant_id IS NOT OLD.issuer_grant_id OR NEW.source_grant_id IS NOT OLD.source_grant_id
  OR NEW.capability_epoch_id IS NOT OLD.capability_epoch_id OR NEW.created_request_id <> OLD.created_request_id
  OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoked_request_id IS NULL
  OR NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v6 grants allow one irreversible CAS revocation only');
END;
CREATE TRIGGER authorization_grants_v6_no_delete
BEFORE DELETE ON authorization_grants_v6 BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v6 grants cannot be deleted');
END;
CREATE TRIGGER authorization_grant_epoch_v6_links_insert_guard
BEFORE INSERT ON authorization_grant_epoch_v6_links
WHEN NOT EXISTS (
  SELECT 1
  FROM authorization_grants AS grant_record
  JOIN authorization_capability_epochs_v6 AS epoch
    ON epoch.epoch_id = NEW.capability_epoch_id
  WHERE grant_record.grant_id = NEW.grant_id
    AND grant_record.action = NEW.action
    AND grant_record.capability_epoch_id IS NULL
    AND grant_record.issuer_grant_id IS NULL
    AND grant_record.source_grant_id IS NULL
    AND grant_record.created_request_id = epoch.request_id
)
BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v6 legacy grant link must bind one matching origin grant and epoch request');
END;
CREATE TRIGGER authorization_grant_epoch_v6_links_no_update
BEFORE UPDATE ON authorization_grant_epoch_v6_links BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v6 legacy grant links are immutable');
END;
CREATE TRIGGER authorization_grant_epoch_v6_links_no_delete
BEFORE DELETE ON authorization_grant_epoch_v6_links BEGIN
  SELECT RAISE(ABORT, 'vocabulary-v6 legacy grant links cannot be deleted');
END;

CREATE TRIGGER application_lifecycle_digest_v6_no_update
BEFORE UPDATE ON application_lifecycle_digest_v6 BEGIN
  SELECT RAISE(ABORT, 'lifecycle digest provenance is immutable');
END;
CREATE TRIGGER application_lifecycle_digest_v6_no_delete
BEFORE DELETE ON application_lifecycle_digest_v6 BEGIN
  SELECT RAISE(ABORT, 'lifecycle digest provenance cannot be deleted');
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

CREATE TEMP TABLE ep02b_migration_assertion (ok INTEGER NOT NULL CHECK (ok = 1)) STRICT;
INSERT INTO ep02b_migration_assertion
SELECT NOT EXISTS (SELECT 1 FROM authorization_capability_epochs_v6)
  AND NOT EXISTS (SELECT 1 FROM authorization_grants_v6)
  AND NOT EXISTS (SELECT 1 FROM authorization_grant_epoch_v6_links)
  AND NOT EXISTS (SELECT 1 FROM application_lifecycle_digest_v6)
  AND NOT EXISTS (SELECT 1 FROM execution_operation_requests)
  AND NOT EXISTS (SELECT 1 FROM execution_authorization_decisions)
  AND NOT EXISTS (SELECT 1 FROM execution_operation_audit)
  AND NOT EXISTS (SELECT 1 FROM execution_operation_intents)
  AND NOT EXISTS (SELECT 1 FROM execution_intent_authorization_bindings)
  AND NOT EXISTS (SELECT 1 FROM execution_observations)
  AND NOT EXISTS (SELECT 1 FROM execution_verified_receipts)
  AND NOT EXISTS (SELECT 1 FROM execution_finalizations)
  AND NOT EXISTS (SELECT 1 FROM execution_terminal_states)
  AND NOT EXISTS (SELECT 1 FROM manual_backend_turns)
  AND NOT EXISTS (SELECT 1 FROM manual_backend_operations)
  AND NOT EXISTS (SELECT 1 FROM manual_completion_decisions)
  AND NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check);
DROP TABLE ep02b_migration_assertion;
