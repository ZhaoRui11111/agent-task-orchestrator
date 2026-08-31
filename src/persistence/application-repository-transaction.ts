import type { DomainMutation, DomainSnapshot, ProjectDomainMutation } from "../domain.ts";
import { runWriteTransaction } from "./database.ts";
import type { SqliteDatabase } from "./database.ts";
import { normalizeSqliteFailure, persistenceFailure } from "./errors.ts";
import { applicationStateSha256 } from "./application-repository-digest.ts";
import type {
  RegisteredProject,
  AuthorizationBootstrap,
  ApplicationRequestRecord,
  AuthorizationDecisionRecord,
  ApplicationAuditRecord,
  TaskExecutionSequence,
  ExecutionIntentState,
  ExecutionOperationRequestRecord,
  ExecutionAuthorizationDecisionRecord,
  ExecutionOperationAuditRecord,
  ExecutionOperationIntent,
  ExecutionAdapterFailureCategory,
  ExecutionIntentAuthorizationBindingRecord,
  ExecutionObservationRecord,
  ExecutionVerifiedReceiptRecord,
  ExecutionFinalizationRecord,
  ExecutionTerminalStateRecord,
  ManualBackendTurnRecord,
  ManualBackendOperationRecord,
  ManualCompletionDecisionRecord,
  DispatcherTriggerRequestRecord,
  DispatcherAuthorizationDecisionRecord,
  DispatcherRunStatus,
  DispatcherRunRecord,
  DispatcherAuditRecord,
  DispatcherReconciliationItemRecord,
  DispatcherReconciliationSummaryRecord,
  DispatcherMembershipRecord,
  DispatcherMemberOutcome,
  DispatcherMemberRecord,
  DispatcherMemberDenialRequestRecord,
  DispatcherMemberDenialDecisionRecord,
  DispatcherMemberDenialAuditRecord,
  DispatcherRunSummaryRecord,
  ApplicationState,
  NewGrantRecord,
  NewLocalIdentityRecord,
  NewCapabilityEpochRecord,
  NewLifecycleAuthorizationRecord,
  NewExecutionAttemptRecord,
} from "./application-repository-model.ts";
import { readApplicationRequestActionValue, readTaskExecutionSequenceById } from "./application-repository-readers.ts";
import { readApplicationState, readApplicationStateUntransactional } from "./application-repository-state.ts";
import {
  commitDomainMutation,
  initializeDomainSnapshot,
  writeDomainMutationUntransactional,
  writeProjectMutationUntransactional,
} from "./repository.ts";
import { canonicalJson } from "./values.ts";

interface ApplicationDatabaseBinding {
  readonly database: SqliteDatabase;
  readonly assertOpen: () => void;
  readonly assertWriteAllowed: () => void;
}

const boundDatabases = new WeakMap<object, ApplicationDatabaseBinding>();

export function bindApplicationDatabase(
  owner: object,
  database: SqliteDatabase,
  assertOpen: () => void,
  assertWriteAllowed: () => void,
): void {
  if (boundDatabases.has(owner)) throw persistenceFailure("INTEGRITY_ERROR", "Persistence owner is already bound");
  boundDatabases.set(owner, Object.freeze({ database, assertOpen, assertWriteAllowed }));
}

export function unbindApplicationDatabase(owner: object): void {
  boundDatabases.delete(owner);
}

function changes(value: number | bigint): number {
  const result = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(result)) throw persistenceFailure("INTEGRITY_ERROR", "SQLite change count is invalid");
  return result;
}

export class ApplicationTransaction {
  readonly #database: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    this.#database = database;
  }

  read(): ApplicationState {
    return readApplicationStateUntransactional(this.#database);
  }

  stateSha256(): string {
    return applicationStateSha256(this.read());
  }

  insertRequest(record: ApplicationRequestRecord): void {
    this.#database.prepare(
      `INSERT INTO application_requests(
        request_id, correlation_id, actor_id, action, target_kind, target_id,
        target_revision, result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.requestId, record.correlationId, record.actorId, record.action, record.targetKind,
      record.targetId, record.targetRevision, record.result, record.createdAt,
    );
  }

  insertDecision(record: AuthorizationDecisionRecord): void {
    this.#database.prepare(
      `INSERT INTO authorization_decisions(
        decision_id, request_id, actor_id, action, result, reason, policy_result,
        grant_id, grant_revision, project_id, resource_revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.decisionId, record.requestId, record.actorId, record.action, record.result,
      record.reason, record.policy, record.grantId, record.grantRevision, record.projectId,
      record.resourceRevision, record.createdAt,
    );
  }

  insertAudit(record: ApplicationAuditRecord): void {
    const details = canonicalJson({
      action: readApplicationRequestActionValue(this.#database, record.requestId),
      reason: record.reason,
      targetKind: record.targetKind,
      targetRevision: record.targetRevision,
    });
    if (details.length > 1024) throw persistenceFailure("INVALID_INPUT", "Audit details exceed the bounded shape");
    this.#database.prepare(
      `INSERT INTO application_audit(
        audit_id, request_id, decision_id, event_kind, result, actor_id, correlation_id,
        target_kind, target_id, target_revision, reason, details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.auditId, record.requestId, record.decisionId, record.eventKind, record.result,
      record.actorId, record.correlationId, record.targetKind, record.targetId,
      record.targetRevision, record.reason, details, record.createdAt,
    );
  }

  insertBootstrap(record: AuthorizationBootstrap): void {
    this.#database.prepare(
      `INSERT INTO authorization_bootstrap(
        singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
        runtime_platform, runtime_device, runtime_inode, runtime_mode,
        request_id, created_at, expires_at, vocabulary_version
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.actorId, record.trustedPrincipal, record.canonicalRoot, record.rootKey,
      record.platform, record.device, record.inode, record.mode,
      record.requestId, record.createdAt, record.expiresAt, record.vocabularyVersion,
    );
  }

  insertLocalIdentity(record: NewLocalIdentityRecord): void {
    this.#database.prepare(
      `INSERT INTO authorization_local_identity(
        singleton, identity_version, actor_id, principal_sha256, platform,
        runtime_root_key, bootstrap_request_id, created_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.identityVersion, record.actorId, record.principalSha256, record.platform,
      record.runtimeRootKey, record.bootstrapRequestId, record.createdAt,
    );
  }

  insertCapabilityEpoch(record: NewCapabilityEpochRecord): void {
    this.#database.prepare(
      `INSERT INTO authorization_capability_epochs(
        epoch_id, epoch_revision, actor_id, runtime_root_key, vocabulary_version,
        action_set_sha256, request_id, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.epochId, record.epochRevision, record.actorId, record.runtimeRootKey,
      record.vocabularyVersion, record.actionSetSha256, record.requestId, record.createdAt,
      record.expiresAt,
    );
  }

  insertGrant(record: NewGrantRecord): void {
    this.#database.prepare(
      `INSERT INTO authorization_grants(
        grant_id, revision, actor_id, action, scope_kind, scope_project_id,
        scope_resource_revision, scope_config_revision, not_before, expires_at,
        revoked_at, issuer_grant_id, source_grant_id, capability_epoch_id,
        created_request_id, revoked_request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(
      record.grantId, record.revision, record.actorId, record.action, record.scope.kind,
      record.scope.projectId, record.scope.resourceRevision, record.scope.configRevision,
      record.notBefore, record.expiresAt, record.revokedAt, record.issuerGrantId, record.sourceGrantId,
      record.capabilityEpochId ?? null, record.createdRequestId,
    );
  }

  insertLifecycleAuthorization(record: NewLifecycleAuthorizationRecord): void {
    this.#database.prepare(
      `INSERT INTO application_lifecycle_authorizations(
        authorization_id, operation, backup_generation_id, actor_id, runtime_root_key,
        grant_id, grant_revision, request_id, decision_id, audit_id, authorized_state_sha256,
        state_digest_version, expected_request_count, expected_decision_count, expected_audit_count,
        issued_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4, ?, ?, ?, ?, ?)`,
    ).run(
      record.authorizationId, record.operation, record.backupGenerationId, record.actorId,
      record.runtimeRootKey, record.grantId, record.grantRevision, record.requestId,
      record.decisionId, record.auditId, record.authorizedStateSha256,
      record.expectedRequestCount, record.expectedDecisionCount, record.expectedAuditCount,
      record.issuedAt, record.expiresAt,
    );
  }

  insertExecutionSequence(record: TaskExecutionSequence): void {
    this.#database.prepare(
      `INSERT INTO task_execution_sequences(
        task_id, last_attempt_number, current_fencing_token, revision
      ) VALUES (?, ?, ?, ?)`,
    ).run(record.taskId, record.lastAttemptNumber, record.currentFencingToken, record.revision);
  }

  advanceExecutionSequence(
    taskId: string,
    expectedAttemptNumber: number,
    expectedFencingToken: number,
    expectedRevision: number,
  ): TaskExecutionSequence {
    const result = this.#database.prepare(
      `UPDATE task_execution_sequences
       SET last_attempt_number=last_attempt_number+1,
           current_fencing_token=current_fencing_token+1,
           revision=revision+1
       WHERE task_id=? AND last_attempt_number=? AND current_fencing_token=? AND revision=?`,
    ).run(taskId, expectedAttemptNumber, expectedFencingToken, expectedRevision);
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Task execution sequence CAS failed", { taskId });
    }
    const sequence = readTaskExecutionSequenceById(this.#database, taskId);
    if (sequence === null) {
      throw persistenceFailure("INTEGRITY_ERROR", "Advanced execution sequence is absent", { taskId });
    }
    return sequence;
  }

  insertExecutionAttempt(record: NewExecutionAttemptRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_attempts(
        execution_id, task_id, attempt_number, operation_kind, status, idempotency_key,
        owner_id, requested_lease_seconds, predecessor_execution_revision,
        predecessor_lease_revision, predecessor_fencing_token,
        lease_revision, lease_expires_at, fencing_token, revision,
        expected_task_revision, pre_task_revision, post_task_revision,
        project_resource_revision, project_config_revision, request_id, decision_id,
        supersedes_execution_id, superseded_by_execution_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.executionId, record.taskId, record.attemptNumber, record.operationKind, record.status,
      record.idempotencyKey, record.ownerId, record.requestedLeaseSeconds,
      record.predecessorExecutionRevision, record.predecessorLeaseRevision,
      record.predecessorFencingToken, record.leaseRevision, record.leaseExpiresAt,
      record.fencingToken, record.revision, record.expectedTaskRevision, record.preTaskRevision,
      record.postTaskRevision, record.projectResourceRevision, record.projectConfigRevision,
      record.requestId, record.decisionId, record.supersedesExecutionId,
      record.supersededByExecutionId, record.createdAt, record.updatedAt,
    );
  }

  insertExecutionOperationRequest(record: ExecutionOperationRequestRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_operation_requests(
        request_id, correlation_id, actor_id, action, target_execution_id,
        target_revision, result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.requestId, record.correlationId, record.actorId, record.action,
      record.targetExecutionId, record.targetRevision, record.result, record.createdAt,
    );
  }

  insertExecutionAuthorizationDecision(record: ExecutionAuthorizationDecisionRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_authorization_decisions(
        decision_id, request_id, actor_id, action, result, reason, policy_result,
        grant_id, grant_revision, project_id, resource_revision, config_revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.decisionId, record.requestId, record.actorId, record.action, record.result,
      record.reason, record.policy, record.grantId, record.grantRevision,
      record.projectId, record.resourceRevision, record.configRevision, record.createdAt,
    );
  }

  insertExecutionOperationAudit(record: ExecutionOperationAuditRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_operation_audit(
        audit_id, request_id, decision_id, event_kind, result, actor_id,
        correlation_id, execution_id, execution_revision, code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.auditId, record.requestId, record.decisionId, record.eventKind, record.result,
      record.actorId, record.correlationId, record.executionId, record.executionRevision,
      record.code, record.createdAt,
    );
  }

  insertExecutionIntent(record: ExecutionOperationIntent): void {
    this.#database.prepare(
      `INSERT INTO execution_operation_intents(
        intent_id, operation_id, idempotency_key, operation_kind, action, state, revision,
        actor_id, request_id, decision_id, current_authorization_decision_id,
        authorization_binding_revision, confirmation_id, project_id,
        project_resource_revision, project_config_revision, task_id, task_revision,
        input_reference, execution_id, execution_revision, attempt_number, fencing_token,
        source_execution_id, source_execution_revision, source_attempt_number, source_fencing_token,
        source_observation_number,
        contract_id, adapter_id, adapter_version, policy_binding_reference, workspace_mode,
        backend_execution_id, thread_id, previous_receipt_id, expected_journal_revision,
        requested_deadline, continuation_reference, required_action_receipt_id, expected_lifecycle,
        reason_code, report_id, report_operation, report_code, evidence_reference, last_observation_number,
        last_error_category, last_error_code, last_error_retryable, last_error_ambiguous,
        retry_after, retry_count,
        created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
        ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28,
        ?29, ?30, ?31, ?32, ?33, ?34, ?35, ?36, ?37, ?38, ?39, ?40, ?41, ?42,
        ?43, ?44, ?45, ?46, ?47, ?48, ?49, ?50, ?51, ?52, ?53, ?54, ?55)`,
    ).run(
      record.intentId, record.operationId, record.idempotencyKey, record.operationKind,
      record.action, record.state, record.revision, record.actorId, record.requestId,
      record.decisionId, record.currentAuthorizationDecisionId,
      record.authorizationBindingRevision, record.confirmationId, record.projectId,
      record.projectResourceRevision, record.projectConfigRevision, record.taskId,
      record.taskRevision, record.inputReference, record.executionId,
      record.executionRevision, record.attemptNumber, record.fencingToken,
      record.sourceExecutionId, record.sourceExecutionRevision, record.sourceAttemptNumber,
      record.sourceFencingToken, record.sourceObservationNumber,
      record.contractId, record.adapterId, record.adapterVersion,
      record.policyBindingReference, record.workspaceMode, record.backendExecutionId,
      record.threadId, record.previousReceiptId, record.expectedJournalRevision,
      record.requestedDeadline, record.continuationReference, record.requiredActionReceiptId,
      record.expectedLifecycle, record.reasonCode, record.reportId, record.reportOperation,
      record.reportCode, record.evidenceReference, record.lastObservationNumber,
      record.lastErrorCategory, record.lastErrorCode,
      record.lastErrorRetryable === null ? null : record.lastErrorRetryable ? 1 : 0,
      record.lastErrorAmbiguous === null ? null : record.lastErrorAmbiguous ? 1 : 0,
      record.retryAfter, record.retryCount,
      record.createdAt, record.updatedAt,
    );
  }

  insertExecutionIntentAuthorizationBinding(record: ExecutionIntentAuthorizationBindingRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_intent_authorization_bindings(
        binding_id, intent_id, binding_revision, phase, request_id, decision_id,
        audit_id, prior_decision_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.bindingId, record.intentId, record.bindingRevision, record.phase,
      record.requestId, record.decisionId, record.auditId, record.priorDecisionId,
      record.createdAt,
    );
  }

  bindExecutionIntentAuthorization(
    intentId: string,
    expectedState: ExecutionIntentState,
    expectedRevision: number,
    nextState: ExecutionIntentState,
    expectedDecisionId: string,
    expectedBindingRevision: number,
    nextDecisionId: string,
    nextBindingRevision: number,
    updatedAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE execution_operation_intents
       SET state=?, current_authorization_decision_id=?, authorization_binding_revision=?,
           revision=revision+1, updated_at=?
       WHERE intent_id=? AND state=? AND revision=?
         AND current_authorization_decision_id=? AND authorization_binding_revision=?`,
    ).run(
      nextState, nextDecisionId, nextBindingRevision, updatedAt, intentId,
      expectedState, expectedRevision, expectedDecisionId, expectedBindingRevision,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Execution authorization binding CAS failed", { intentId });
    }
  }

  recordExecutionIntentFailure(
    intentId: string,
    expectedRevision: number,
    nextState: Extract<ExecutionIntentState, "retry_wait" | "ambiguous" | "failed">,
    failure: Readonly<{
      category: ExecutionAdapterFailureCategory;
      code: string;
      retryable: boolean;
      ambiguous: boolean;
      retryAfter: string | null;
    }>,
    updatedAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE execution_operation_intents
       SET state=?, last_error_category=?, last_error_code=?, last_error_retryable=?,
           last_error_ambiguous=?, retry_after=?, retry_count=retry_count+1,
           revision=revision+1, updated_at=?
       WHERE intent_id=? AND state='executing' AND revision=?`,
    ).run(
      nextState, failure.category, failure.code, failure.retryable ? 1 : 0,
      failure.ambiguous ? 1 : 0, failure.retryAfter, updatedAt, intentId, expectedRevision,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Execution adapter failure CAS failed", { intentId });
    }
  }

  transitionExecutionIntent(
    intentId: string,
    expectedState: ExecutionIntentState,
    expectedRevision: number,
    nextState: ExecutionIntentState,
    updatedAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE execution_operation_intents
       SET state=?, revision=revision+1, updated_at=?
       WHERE intent_id=? AND state=? AND revision=?`,
    ).run(nextState, updatedAt, intentId, expectedState, expectedRevision);
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Execution intent CAS failed", { intentId });
    }
  }

  insertExecutionObservation(record: ExecutionObservationRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_observations(
        observation_id, intent_id, observation_number, adapter_receipt_id, receipt_sha256,
        authorization_decision_id, lifecycle, outcome, code,
        backend_execution_id, thread_id, journal_revision, evidence_reference, observed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.observationId, record.intentId, record.observationNumber, record.adapterReceiptId,
      record.receiptSha256, record.authorizationDecisionId, record.lifecycle, record.outcome,
      record.code, record.backendExecutionId, record.threadId, record.journalRevision,
      record.evidenceReference, record.observedAt,
    );
  }

  insertExecutionVerifiedReceipt(record: ExecutionVerifiedReceiptRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_verified_receipts(
        verified_receipt_id, intent_id, adapter_receipt_id, receipt_sha256, lifecycle,
        backend_execution_id, thread_id, observation_number, observed_revision,
        fencing_token, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.verifiedReceiptId, record.intentId, record.adapterReceiptId,
      record.receiptSha256, record.lifecycle, record.backendExecutionId,
      record.threadId, record.observationNumber, record.observedRevision,
      record.fencingToken, record.verifiedAt,
    );
  }

  insertExecutionFinalization(record: ExecutionFinalizationRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_finalizations(
        finalization_id, intent_id, verified_receipt_id, authorization_decision_id, outcome, code,
        task_revision, execution_revision, finalized_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.finalizationId, record.intentId, record.verifiedReceiptId,
      record.authorizationDecisionId, record.outcome,
      record.code, record.taskRevision, record.executionRevision, record.finalizedAt,
    );
  }

  insertExecutionTerminalState(record: ExecutionTerminalStateRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_terminal_states(
        execution_id, status, attempt_number, fencing_token, verified_receipt_id,
        finalization_id, completion_decision_id, pre_task_revision, post_task_revision,
        execution_revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.executionId, record.status, record.attemptNumber, record.fencingToken,
      record.verifiedReceiptId, record.finalizationId, record.completionDecisionId,
      record.preTaskRevision, record.postTaskRevision, record.executionRevision, record.createdAt,
    );
  }

  insertManualTurn(record: ManualBackendTurnRecord): void {
    this.#database.prepare(
      `INSERT INTO manual_backend_turns(
        backend_execution_id, thread_id, start_idempotency_key, project_id,
        project_resource_revision, project_config_revision, task_id, task_revision,
        input_reference, execution_id, execution_revision, attempt_number, fencing_token,
        predecessor_backend_execution_id, predecessor_thread_id,
        policy_binding_reference, workspace_mode, lifecycle, cancellation_request_revision,
        cancellation_requested_at, code, evidence_reference, last_report_id, revision,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.backendExecutionId, record.threadId, record.startIdempotencyKey,
      record.projectId, record.projectResourceRevision, record.projectConfigRevision,
      record.taskId, record.taskRevision, record.inputReference, record.executionId,
      record.executionRevision, record.attemptNumber, record.fencingToken,
      record.predecessorBackendExecutionId, record.predecessorThreadId,
      record.policyBindingReference, record.workspaceMode, record.lifecycle,
      record.cancellationRequestRevision, record.cancellationRequestedAt, record.code,
      record.evidenceReference, record.lastReportId, record.revision,
      record.createdAt, record.updatedAt,
    );
  }

  updateManualTurn(record: ManualBackendTurnRecord, expectedRevision: number): void {
    const result = this.#database.prepare(
      `UPDATE manual_backend_turns SET
        lifecycle=?, cancellation_request_revision=?, cancellation_requested_at=?,
        code=?, evidence_reference=?, last_report_id=?, revision=?, updated_at=?
      WHERE backend_execution_id=? AND thread_id=? AND execution_id=?
        AND fencing_token=? AND revision=?`,
    ).run(
      record.lifecycle, record.cancellationRequestRevision, record.cancellationRequestedAt,
      record.code, record.evidenceReference, record.lastReportId, record.revision,
      record.updatedAt, record.backendExecutionId, record.threadId, record.executionId,
      record.fencingToken, expectedRevision,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Manual turn revision/fence CAS failed", {
        backendExecutionId: record.backendExecutionId,
      });
    }
  }

  insertManualBackendOperation(record: ManualBackendOperationRecord): void {
    this.#database.prepare(
      `INSERT INTO manual_backend_operations(
        backend_operation_id, idempotency_key, intent_id, authorization_decision_id, operation_kind,
        report_operation, backend_execution_id, thread_id, source_backend_execution_id,
        source_thread_id, expected_fencing_token,
        expected_pre_revision, post_revision, result_lifecycle, receipt_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.backendOperationId, record.idempotencyKey, record.intentId,
      record.authorizationDecisionId,
      record.operationKind, record.reportOperation, record.backendExecutionId,
      record.threadId, record.sourceBackendExecutionId, record.sourceThreadId,
      record.expectedFencingToken, record.expectedPreRevision,
      record.postRevision, record.resultLifecycle, record.receiptId, record.createdAt,
    );
  }

  insertManualCompletionDecision(record: ManualCompletionDecisionRecord): void {
    this.#database.prepare(
      `INSERT INTO manual_completion_decisions(
        completion_decision_id, operation_id, idempotency_key, task_id, execution_id,
        attempt_number, fencing_token, verified_receipt_id, finalization_id,
        pre_task_revision, post_task_revision, request_id, decision_id, audit_id,
        confirmation_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.completionDecisionId, record.operationId, record.idempotencyKey,
      record.taskId, record.executionId, record.attemptNumber, record.fencingToken,
      record.verifiedReceiptId, record.finalizationId, record.preTaskRevision,
      record.postTaskRevision, record.requestId, record.decisionId, record.auditId,
      record.confirmationId, record.createdAt,
    );
  }

  insertDispatcherTriggerRequest(record: DispatcherTriggerRequestRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_trigger_requests(
        request_id, observation_id, idempotency_key, correlation_id, actor_id, action,
        worker_owner_id, requested_lease_seconds, result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.requestId, record.observationId, record.idempotencyKey, record.correlationId,
      record.actorId, record.action, record.workerOwnerId, record.requestedLeaseSeconds,
      record.result, record.createdAt,
    );
  }

  insertDispatcherAuthorizationDecision(record: DispatcherAuthorizationDecisionRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_authorization_decisions(
        decision_id, request_id, actor_id, action, result, reason, policy_result,
        grant_id, grant_revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.decisionId, record.requestId, record.actorId, record.action, record.result,
      record.reason, record.policy, record.grantId, record.grantRevision, record.createdAt,
    );
  }

  insertDispatcherRun(record: DispatcherRunRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_runs(
        run_id, observation_id, request_id, decision_id, actor_id, owner_id, owner_revision,
        run_revision, requested_lease_seconds, heartbeat_at, lease_expires_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.runId, record.observationId, record.requestId, record.decisionId, record.actorId,
      record.ownerId, record.ownerRevision, record.runRevision, record.requestedLeaseSeconds,
      record.heartbeatAt, record.leaseExpiresAt, record.status, record.createdAt, record.updatedAt,
    );
  }

  insertDispatcherAudit(record: DispatcherAuditRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_audit(
        audit_id, request_id, decision_id, run_id, event_kind, result,
        actor_id, correlation_id, code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.auditId, record.requestId, record.decisionId, record.runId, record.eventKind,
      record.result, record.actorId, record.correlationId, record.code, record.createdAt,
    );
  }

  advanceDispatcherRun(
    runId: string,
    ownerId: string,
    expectedOwnerRevision: number,
    expectedRunRevision: number,
    expectedStatus: DispatcherRunStatus,
    nextStatus: DispatcherRunStatus,
    now: string,
    leaseExpiresAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE dispatcher_runs
       SET status=?, run_revision=run_revision+1, heartbeat_at=?, lease_expires_at=?, updated_at=?
       WHERE run_id=? AND owner_id=? AND owner_revision=? AND run_revision=? AND status=?
         AND heartbeat_at<? AND lease_expires_at<?`,
    ).run(
      nextStatus, now, leaseExpiresAt, now, runId, ownerId, expectedOwnerRevision,
      expectedRunRevision, expectedStatus, now, leaseExpiresAt,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Dispatcher run owner/revision/status CAS failed", { runId });
    }
  }

  takeOverDispatcherRun(
    runId: string,
    expectedOwnerId: string,
    newOwnerId: string,
    expectedOwnerRevision: number,
    expectedRunRevision: number,
    expectedStatus: DispatcherRunStatus,
    now: string,
    leaseExpiresAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE dispatcher_runs
       SET owner_id=?, owner_revision=owner_revision+1, run_revision=run_revision+1,
           heartbeat_at=?, lease_expires_at=?, updated_at=?
       WHERE run_id=? AND owner_id=? AND owner_revision=? AND run_revision=? AND status=?
         AND status NOT IN ('completed', 'partial', 'failed', 'interrupted') AND lease_expires_at<=?`,
    ).run(
      newOwnerId, now, leaseExpiresAt, now, runId, expectedOwnerId, expectedOwnerRevision,
      expectedRunRevision, expectedStatus, now,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Dispatcher run takeover CAS or expiry check failed", { runId });
    }
  }

  insertDispatcherReconciliationItem(record: DispatcherReconciliationItemRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_reconciliation_items(
        reconciliation_item_id, run_id, ordinal, resource_kind, resource_id, disposition, code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.reconciliationItemId, record.runId, record.ordinal, record.resourceKind,
      record.resourceId, record.disposition, record.code, record.createdAt,
    );
  }

  insertDispatcherReconciliationSummary(record: DispatcherReconciliationSummaryRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_reconciliation_summaries(
        run_id, summary_revision, expected_count, reconciled_count, no_effect_count,
        authorization_denied_count, ambiguous_count, failed_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.runId, record.summaryRevision, record.expectedCount, record.reconciledCount,
      record.noEffectCount, record.authorizationDeniedCount, record.ambiguousCount,
      record.failedCount, record.createdAt,
    );
  }

  insertDispatcherMembership(record: DispatcherMembershipRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_memberships(run_id, membership_revision, expected_member_count, sealed_at)
       VALUES (?, ?, ?, ?)`,
    ).run(record.runId, record.membershipRevision, record.expectedMemberCount, record.sealedAt);
  }

  insertDispatcherMember(record: DispatcherMemberRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_members(
        member_id, run_id, membership_revision, ordinal, project_id, project_resource_revision,
        project_config_revision, task_id, task_revision, lifecycle, outcome, execution_id,
        intent_id, code, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.memberId, record.runId, record.membershipRevision, record.ordinal, record.projectId,
      record.projectResourceRevision, record.projectConfigRevision, record.taskId, record.taskRevision,
      record.lifecycle, record.outcome, record.executionId, record.intentId, record.code,
      record.revision, record.createdAt, record.updatedAt,
    );
  }

  insertDispatcherMemberDenialRequest(record: DispatcherMemberDenialRequestRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_member_denial_requests(
        request_id, correlation_id, run_id, member_id, actor_id, action,
        target_execution_id, target_revision, result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.requestId, record.correlationId, record.runId, record.memberId,
      record.actorId, record.action, record.targetExecutionId, record.targetRevision,
      record.result, record.createdAt,
    );
  }

  insertDispatcherMemberDenialDecision(record: DispatcherMemberDenialDecisionRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_member_denial_decisions(
        decision_id, request_id, actor_id, action, result, reason, policy_result,
        grant_id, grant_revision, project_id, resource_revision, config_revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.decisionId, record.requestId, record.actorId, record.action,
      record.result, record.reason, record.policy, record.grantId, record.grantRevision,
      record.projectId, record.resourceRevision, record.configRevision, record.createdAt,
    );
  }

  insertDispatcherMemberDenialAudit(record: DispatcherMemberDenialAuditRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_member_denial_audit(
        audit_id, request_id, decision_id, run_id, member_id, event_kind, result,
        actor_id, correlation_id, target_execution_id, target_revision, code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.auditId, record.requestId, record.decisionId, record.runId,
      record.memberId, record.eventKind, record.result, record.actorId,
      record.correlationId, record.targetExecutionId, record.targetRevision,
      record.code, record.createdAt,
    );
  }

  resolveDispatcherMember(
    memberId: string,
    runId: string,
    expectedMembershipRevision: number,
    expectedRevision: number,
    outcome: DispatcherMemberOutcome,
    executionId: string | null,
    intentId: string | null,
    code: string,
    updatedAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE dispatcher_members
       SET lifecycle='terminal', outcome=?, execution_id=?, intent_id=?, code=?,
           revision=revision+1, updated_at=?
       WHERE member_id=? AND run_id=? AND membership_revision=? AND revision=? AND lifecycle='pending'`,
    ).run(
      outcome, executionId, intentId, code, updatedAt, memberId, runId,
      expectedMembershipRevision, expectedRevision,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Dispatcher member terminal CAS failed", { memberId, runId });
    }
  }

  insertDispatcherRunSummary(record: DispatcherRunSummaryRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_run_summaries(
        run_id, membership_revision, expected_member_count, claimed_count, already_claimed_count,
        ineligible_count, authorization_denied_count, policy_deferred_count, resource_deferred_count,
        reconciliation_required_count, failed_count, terminal_status, owner_revision, run_revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.runId, record.membershipRevision, record.expectedMemberCount, record.claimedCount,
      record.alreadyClaimedCount, record.ineligibleCount, record.authorizationDeniedCount,
      record.policyDeferredCount, record.resourceDeferredCount, record.reconciliationRequiredCount,
      record.failedCount, record.terminalStatus, record.ownerRevision, record.runRevision, record.createdAt,
    );
  }

  renewExecutionLease(
    executionId: string,
    ownerId: string,
    expectedRevision: number,
    expectedLeaseRevision: number,
    expectedFencingToken: number,
    expectedTaskRevision: number,
    now: string,
    leaseExpiresAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE execution_attempts
       SET lease_revision=lease_revision+1, revision=revision+1,
           lease_expires_at=?, updated_at=?
       WHERE execution_id=? AND owner_id=? AND revision=? AND lease_revision=?
         AND fencing_token=? AND post_task_revision=? AND status='active'
         AND lease_expires_at>?`,
    ).run(
      leaseExpiresAt, now, executionId, ownerId, expectedRevision, expectedLeaseRevision,
      expectedFencingToken, expectedTaskRevision, now,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Execution lease CAS or fence check failed", { executionId });
    }
  }

  supersedeExecutionAttempt(
    executionId: string,
    supersededByExecutionId: string,
    ownerId: string,
    expectedRevision: number,
    expectedLeaseRevision: number,
    expectedFencingToken: number,
    expectedTaskRevision: number,
    observedAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE execution_attempts
       SET status='superseded', superseded_by_execution_id=?, revision=revision+1, updated_at=?
       WHERE execution_id=? AND owner_id=? AND revision=? AND lease_revision=?
         AND fencing_token=? AND post_task_revision=? AND status='active'
         AND superseded_by_execution_id IS NULL AND lease_expires_at<=?`,
    ).run(
      supersededByExecutionId, observedAt, executionId, ownerId, expectedRevision,
      expectedLeaseRevision, expectedFencingToken, expectedTaskRevision, observedAt,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Expired execution takeover CAS or fence check failed", { executionId });
    }
  }

  revokeGrant(grantId: string, expectedRevision: number, revokedAt: string, requestId: string): void {
    const result = this.#database.prepare(
      `UPDATE authorization_grants
       SET revision=revision+1, revoked_at=?, revoked_request_id=?
       WHERE grant_id=? AND revision=? AND revoked_at IS NULL`,
    ).run(revokedAt, requestId, grantId, expectedRevision);
    if (changes(result.changes) !== 1) throw persistenceFailure("REVISION_CONFLICT", "Grant revocation CAS failed", { grantId });
  }

  supersedeExecutionAttemptAfterReconciliation(
    executionId: string,
    supersededByExecutionId: string,
    expectedOwnerId: string,
    expectedRevision: number,
    expectedLeaseRevision: number,
    expectedFencingToken: number,
    observedAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE execution_attempts
       SET status='superseded', superseded_by_execution_id=?, revision=revision+1, updated_at=?
       WHERE execution_id=? AND owner_id=? AND revision=? AND lease_revision=?
         AND fencing_token=? AND status='active' AND superseded_by_execution_id IS NULL`,
    ).run(
      supersededByExecutionId, observedAt, executionId, expectedOwnerId,
      expectedRevision, expectedLeaseRevision, expectedFencingToken,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Reconciled execution successor CAS or fence check failed", { executionId });
    }
  }

  insertProject(project: RegisteredProject): void {
    this.#database.prepare(
      `INSERT INTO project_registry(
        project_id, canonical_root, root_key, platform, root_device, root_inode, root_mode,
        config_revision, resource_revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      project.projectId, project.canonicalRoot, project.rootKey, project.platform, project.device,
      project.inode, project.mode, project.configRevision, project.resourceRevision,
      project.createdAt, project.updatedAt,
    );
  }

  updateProject(project: RegisteredProject, expectedConfigRevision: number, expectedResourceRevision: number): void {
    const result = this.#database.prepare(
      `UPDATE project_registry SET
        canonical_root=?, root_key=?, platform=?, root_device=?, root_inode=?, root_mode=?,
        config_revision=?, resource_revision=?, updated_at=?
      WHERE project_id=? AND config_revision=? AND resource_revision=?`,
    ).run(
      project.canonicalRoot, project.rootKey, project.platform, project.device, project.inode,
      project.mode, project.configRevision, project.resourceRevision, project.updatedAt,
      project.projectId, expectedConfigRevision, expectedResourceRevision,
    );
    if (changes(result.changes) !== 1) throw persistenceFailure("REVISION_CONFLICT", "ProjectRegistry revision CAS failed", { projectId: project.projectId });
  }

  writeDomain(expected: DomainSnapshot, mutation: DomainMutation): DomainSnapshot {
    return writeDomainMutationUntransactional(this.#database, expected, mutation);
  }

  writeProjectDomain(expected: DomainSnapshot, mutation: ProjectDomainMutation): DomainSnapshot {
    return writeProjectMutationUntransactional(this.#database, expected, mutation);
  }
}

export function withApplicationTransaction<T>(owner: object, callback: (transaction: ApplicationTransaction) => T): T {
  const binding = boundDatabases.get(owner);
  if (binding === undefined || !binding.database.isOpen) throw persistenceFailure("STORE_CLOSED", "Persistence store is unavailable");
  binding.assertOpen();
  binding.assertWriteAllowed();
  const database = binding.database;
  return runWriteTransaction(database, () => {
    try {
      const result = callback(new ApplicationTransaction(database));
      readApplicationStateUntransactional(database);
      return result;
    } catch (error) {
      throw normalizeSqliteFailure(error, "INTEGRITY_ERROR");
    }
  });
}

export function readApplicationStateForOwner(owner: object): ApplicationState {
  const binding = boundDatabases.get(owner);
  if (binding === undefined || !binding.database.isOpen) throw persistenceFailure("STORE_CLOSED", "Persistence store is unavailable");
  binding.assertOpen();
  return readApplicationState(binding.database);
}

export function readDomainForOwner(owner: object): DomainSnapshot {
  return readApplicationStateForOwner(owner).domain;
}

export function initializeDomainForOwner(owner: object, snapshot: DomainSnapshot): DomainSnapshot {
  const binding = boundDatabases.get(owner);
  if (binding === undefined || !binding.database.isOpen) throw persistenceFailure("STORE_CLOSED", "Persistence store is unavailable");
  binding.assertOpen();
  return initializeDomainSnapshot(binding.database, snapshot);
}

export function commitDomainForOwner(
  owner: object,
  expected: DomainSnapshot,
  mutation: DomainMutation,
): DomainSnapshot {
  const binding = boundDatabases.get(owner);
  if (binding === undefined || !binding.database.isOpen) throw persistenceFailure("STORE_CLOSED", "Persistence store is unavailable");
  binding.assertOpen();
  return commitDomainMutation(binding.database, expected, mutation);
}
