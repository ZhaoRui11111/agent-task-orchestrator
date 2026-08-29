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
