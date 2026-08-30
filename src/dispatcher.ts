import {
  createDispatcherApplicationService,
  type DispatcherApplicationOptions,
  type DispatcherApplicationService,
  type DispatcherFailure,
  type DispatcherIngress,
  type DispatcherReconciliationResolution,
  type DispatcherResult,
  type DispatcherRunView,
  type DispatcherStartCommand,
} from "./dispatcher-application.ts";
import {
  createReliableExecutionService,
  type ExecutionLoopCancelCommand,
  type ExecutionLoopInspectCommand,
  type ExecutionLoopResumeCommand,
  type ExecutionLoopStartCommand,
  type ManualOutcomeCommand,
  type ReliableExecutionIngress,
  type ReliableExecutionResult,
  type ReliableExecutionService,
} from "./execution-loop.ts";
import {
  createExecutionApplicationService,
  type ExecutionApplicationService,
} from "./execution-application.ts";
import type { ExecutionBackend, ManualOutcomeControl } from "./execution-port.ts";
import {
  readApplicationStateForOwner,
  type ApplicationState,
  type DispatcherMemberRecord,
  type DispatcherRunRecord,
  type ExecutionOperationIntent,
} from "./persistence/application-repository.ts";
import type { PersistenceStore } from "./persistence/store.ts";

export interface ManualDispatcherIngress extends ReliableExecutionIngress {
  currentRuntimeRootKey(): string;
}

export interface ManualDispatcherOptions {
  readonly executionLeaseSeconds?: number;
  readonly operationDeadlineSeconds?: number;
}

export interface ManualDispatcher {
  run(command: DispatcherStartCommand): DispatcherResult<DispatcherRunView>;
  resume(runId: string): DispatcherResult<DispatcherRunView>;
}

function dispatcherIngress(ingress: ManualDispatcherIngress): DispatcherIngress {
  return Object.freeze({
    currentActor: () => ingress.currentActor(),
    currentWorkerOwner: () => ingress.currentLeaseOwner(),
    currentRuntimeRootKey: () => ingress.currentRuntimeRootKey(),
    now: () => ingress.now(),
    nextId: (kind: Parameters<DispatcherIngress["nextId"]>[0]) => ingress.nextId(kind === "observation" || kind === "run" ||
      kind === "reconciliation_item" || kind === "member" || kind === "execution" ? "operation" : kind),
  });
}

function operationDeadline(ingress: ManualDispatcherIngress): string {
  const now = ingress.now();
  const milliseconds = Date.parse(now);
  return Number.isFinite(milliseconds) ? new Date(milliseconds + 3600 * 1000).toISOString() : now;
}

function reliableDisposition(result: ReliableExecutionResult): Pick<DispatcherReconciliationResolution, "disposition" | "code"> {
  if (result.ok) return Object.freeze({ disposition: "reconciled" as const, code: "reliable_reconciled" });
  switch (result.error.code) {
    case "AUTHORIZATION_DENIED":
    case "CONFIRMATION_REQUIRED":
      return Object.freeze({ disposition: "authorization_denied" as const, code: "reliable_authorization_denied" });
    case "RECONCILIATION_REQUIRED":
    case "LEASE_EXPIRED":
    case "STALE_FENCE":
    case "STALE_REVISION":
      return Object.freeze({ disposition: "ambiguous" as const, code: "reliable_state_ambiguous" });
    default:
      return Object.freeze({ disposition: "failed" as const, code: "reliable_recovery_failed" });
  }
}

function dispatcherRecoveryFailure(
  resolution: Pick<DispatcherReconciliationResolution, "disposition" | "code">,
): DispatcherFailure | null {
  if (resolution.disposition === "reconciled" || resolution.disposition === "no_effect") return null;
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({
      code: resolution.disposition === "authorization_denied"
        ? "AUTHORIZATION_DENIED" as const
        : "RECONCILIATION_INCOMPLETE" as const,
      message: "Claimed dispatcher work requires durable reliable-loop reconciliation",
    }),
    requestId: null,
    correlationId: null,
  });
}

function startCommand(intent: ExecutionOperationIntent): ExecutionLoopStartCommand {
  return Object.freeze({
    kind: "execution.start" as const,
    projectId: intent.projectId,
    expectedProjectResourceRevision: intent.projectResourceRevision,
    expectedProjectConfigRevision: intent.projectConfigRevision,
    taskId: intent.taskId,
    expectedTaskRevision: intent.taskRevision,
    inputReference: intent.inputReference,
    executionId: intent.executionId,
    expectedExecutionRevision: intent.executionRevision,
    expectedAttemptNumber: intent.attemptNumber,
    expectedFencingToken: intent.fencingToken,
    idempotencyKey: intent.idempotencyKey,
    policyBindingReference: intent.policyBindingReference,
    requestedDeadline: intent.requestedDeadline,
  });
}

function inspectCommand(
  state: ApplicationState,
  intent: ExecutionOperationIntent,
  ingress: ManualDispatcherIngress,
): ExecutionLoopInspectCommand | null {
  const execution = state.executions.find((candidate) => candidate.executionId === intent.executionId);
  const task = state.domain.tasks.find((candidate) => candidate.id === intent.taskId);
  const turn = state.manualTurns.find((candidate) => candidate.executionId === intent.executionId);
  const backendExecutionId = intent.backendExecutionId ?? turn?.backendExecutionId ?? null;
  const threadId = intent.threadId ?? turn?.threadId ?? null;
  if (execution === undefined || task === undefined || backendExecutionId === null || threadId === null) return null;
  const observations = state.executionObservations.filter((candidate) => candidate.intentId === intent.intentId);
  const lastObservationNumber = observations.reduce((maximum, candidate) =>
    Math.max(maximum, candidate.observationNumber), intent.lastObservationNumber);
  return Object.freeze({
    kind: "execution.inspect" as const,
    projectId: intent.projectId,
    expectedProjectResourceRevision: intent.projectResourceRevision,
    expectedProjectConfigRevision: intent.projectConfigRevision,
    taskId: intent.taskId,
    expectedTaskRevision: task.revision,
    inputReference: intent.inputReference,
    executionId: intent.executionId,
    expectedExecutionRevision: execution.revision,
    expectedAttemptNumber: execution.attemptNumber,
    expectedFencingToken: execution.fencingToken,
    idempotencyKey: `dispatch-inspect:${intent.intentId}`,
    policyBindingReference: intent.policyBindingReference,
    requestedDeadline: operationDeadline(ingress),
    backendExecutionId,
    threadId,
    lastObservationNumber,
  });
}

function processIntent(
  state: ApplicationState,
  intent: ExecutionOperationIntent,
  reliable: ReliableExecutionService,
  ingress: ManualDispatcherIngress,
): ReliableExecutionResult | null {
  if (intent.operationKind === "start") {
    const execution = state.executions.find((candidate) => candidate.executionId === intent.executionId);
    const turn = state.manualTurns.find((candidate) => candidate.executionId === intent.executionId);
    const now = ingress.now();
    if (execution !== undefined && (execution.ownerId !== ingress.currentLeaseOwner() || execution.leaseExpiresAt <= now)) {
      if (turn === undefined && !state.manualBackendOperations.some((candidate) => candidate.intentId === intent.intentId)) {
        return reliable.reconcileExpiredStartNoEffect(startCommand(intent));
      }
      const command = inspectCommand(state, intent, ingress);
      return command === null ? null : reliable.reconcile(command);
    }
    return reliable.start(startCommand(intent));
  }
  const execution = state.executions.find((candidate) => candidate.executionId === intent.executionId);
  const task = state.domain.tasks.find((candidate) => candidate.id === intent.taskId);
  const turn = state.manualTurns.find((candidate) => candidate.executionId === intent.executionId);
  if (execution === undefined || task === undefined) return null;
  const base = Object.freeze({
    projectId: intent.projectId,
    expectedProjectResourceRevision: intent.projectResourceRevision,
    expectedProjectConfigRevision: intent.projectConfigRevision,
    taskId: intent.taskId,
    inputReference: intent.inputReference,
    executionId: intent.sourceExecutionId ?? intent.executionId,
    expectedExecutionRevision: intent.sourceExecutionRevision ?? intent.executionRevision,
    expectedAttemptNumber: intent.sourceAttemptNumber ?? intent.attemptNumber,
    expectedFencingToken: intent.sourceFencingToken ?? intent.fencingToken,
    idempotencyKey: intent.idempotencyKey,
    policyBindingReference: intent.policyBindingReference,
    requestedDeadline: intent.requestedDeadline,
  });
  if (intent.operationKind === "inspect") {
    const command = inspectCommand(state, intent, ingress);
    return command === null ? null : reliable.reconcile(command);
  }
  if (intent.operationKind === "resume" || intent.operationKind === "retry") {
    if (intent.backendExecutionId === null || intent.threadId === null || intent.continuationReference === null ||
      intent.previousReceiptId === null || intent.requiredActionReceiptId === null || intent.sourceObservationNumber === null) return null;
    const command: ExecutionLoopResumeCommand = Object.freeze({
      ...base,
      kind: `execution.${intent.operationKind}` as "execution.resume" | "execution.retry",
      expectedTaskRevision: intent.taskRevision - 1,
      backendExecutionId: intent.backendExecutionId,
      threadId: intent.threadId,
      continuationReference: intent.continuationReference,
      previousTurnReceiptId: intent.previousReceiptId,
      requiredActionReceiptId: intent.requiredActionReceiptId,
      lastObservationNumber: intent.sourceObservationNumber,
    });
    return intent.operationKind === "resume" ? reliable.resume(command) : reliable.retry(command);
  }
  if (intent.operationKind === "request_cancel") {
    if (intent.backendExecutionId === null || intent.threadId === null || intent.expectedLifecycle === null || intent.reasonCode === null) return null;
    const command: ExecutionLoopCancelCommand = Object.freeze({
      ...base,
      kind: "execution.cancel" as const,
      expectedTaskRevision: intent.taskRevision,
      backendExecutionId: intent.backendExecutionId,
      threadId: intent.threadId,
      expectedLifecycle: intent.expectedLifecycle,
      reasonCode: intent.reasonCode,
      lastObservationNumber: intent.lastObservationNumber,
    });
    return reliable.requestCancel(command);
  }
  if (intent.operationKind === "manual_report") {
    if (intent.backendExecutionId === null || intent.threadId === null || intent.expectedLifecycle === null ||
      intent.reportId === null || intent.reportOperation === null || intent.reportCode === null ||
      intent.expectedJournalRevision === null) return null;
    const command: ManualOutcomeCommand = Object.freeze({
      ...base,
      kind: "manual.turn.report" as const,
      expectedTaskRevision: intent.taskRevision,
      reportId: intent.reportId,
      backendExecutionId: intent.backendExecutionId,
      threadId: intent.threadId,
      expectedJournalRevision: intent.expectedJournalRevision,
      expectedLifecycle: intent.expectedLifecycle,
      outcomeOperation: intent.reportOperation,
      code: intent.reportCode,
      evidenceReference: intent.evidenceReference,
      lastObservationNumber: intent.lastObservationNumber,
    });
    return reliable.recordManualOutcome(command);
  }
  return null;
}

function resolveExecutionLease(
  initialState: ApplicationState,
  executionId: string,
  reliable: ReliableExecutionService,
  ingress: ManualDispatcherIngress,
  executionApplication: ExecutionApplicationService,
  store: PersistenceStore,
): Pick<DispatcherReconciliationResolution, "disposition" | "code"> {
  let state = initialState;
  let execution = state.executions.find((candidate) => candidate.executionId === executionId);
  if (execution === undefined || state.executionTerminalStates.some((candidate) => candidate.executionId === executionId)) {
    return Object.freeze({ disposition: "no_effect" as const, code: "execution_already_terminal" });
  }
  const sourceIntent = [...state.executionIntents]
    .filter((candidate) => candidate.executionId === executionId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt, "en"))[0];
  if (sourceIntent === undefined) return Object.freeze({ disposition: "ambiguous" as const, code: "execution_intent_absent" });
  if (sourceIntent.state !== "finalized") {
    const reconciled = processIntent(state, sourceIntent, reliable, ingress);
    if (reconciled === null) return Object.freeze({ disposition: "ambiguous" as const, code: "execution_intent_ambiguous" });
    if (!reconciled.ok) return reliableDisposition(reconciled);
  }
  state = readApplicationStateForOwner(store);
  execution = state.executions.find((candidate) => candidate.executionId === executionId);
  if (execution === undefined || execution.status !== "active" ||
    state.executionTerminalStates.some((candidate) => candidate.executionId === executionId)) {
    return Object.freeze({ disposition: "reconciled" as const, code: "execution_no_longer_active" });
  }
  if (state.executionIntents.some((candidate) => candidate.executionId === executionId && candidate.state !== "finalized")) {
    return Object.freeze({ disposition: "ambiguous" as const, code: "execution_intent_unfinished" });
  }
  const existingTurn = state.manualTurns.find((candidate) => candidate.executionId === executionId);
  if (existingTurn !== undefined) {
    return Object.freeze({ disposition: "reconciled" as const, code: `execution_turn_${existingTurn.lifecycle}` });
  }
  const executionIntentIds = new Set(
    state.executionIntents.filter((candidate) => candidate.executionId === executionId).map((candidate) => candidate.intentId),
  );
  if (state.manualBackendOperations.some((candidate) => executionIntentIds.has(candidate.intentId))) {
    return Object.freeze({ disposition: "ambiguous" as const, code: "execution_backend_journal_present" });
  }
  const task = state.domain.tasks.find((candidate) => candidate.id === execution!.taskId);
  const project = task === undefined ? undefined : state.projects.find((candidate) => candidate.projectId === task.projectId);
  if (task === undefined || project === undefined || task.state !== "running") {
    return Object.freeze({ disposition: "ambiguous" as const, code: "execution_binding_changed" });
  }
  const takeover = executionApplication.takeover({
    kind: "execution.lease.takeover",
    projectId: project.projectId,
    expectedProjectResourceRevision: project.resourceRevision,
    expectedProjectConfigRevision: project.configRevision,
    taskId: task.id,
    expectedTaskRevision: task.revision,
    predecessorExecutionId: execution.executionId,
    expectedExecutionRevision: execution.revision,
    expectedLeaseRevision: execution.leaseRevision,
    expectedFencingToken: execution.fencingToken,
    idempotencyKey: `dispatch-takeover:${execution.executionId}`,
    leaseDurationSeconds: execution.requestedLeaseSeconds,
  });
  if (!takeover.ok) {
    return takeover.error.code === "AUTHORIZATION_DENIED"
      ? Object.freeze({ disposition: "authorization_denied" as const, code: "execution_takeover_denied" })
      : takeover.error.code === "RECONCILIATION_REQUIRED" || takeover.error.code === "STALE_FENCE" ||
          takeover.error.code === "STALE_REVISION" || takeover.error.code === "LEASE_NOT_EXPIRED"
        ? Object.freeze({ disposition: "ambiguous" as const, code: "execution_takeover_stale" })
        : Object.freeze({ disposition: "failed" as const, code: "execution_takeover_failed" });
  }
  const start: ExecutionLoopStartCommand = Object.freeze({
    kind: "execution.start" as const,
    projectId: project.projectId,
    expectedProjectResourceRevision: project.resourceRevision,
    expectedProjectConfigRevision: project.configRevision,
    taskId: task.id,
    expectedTaskRevision: task.revision,
    inputReference: sourceIntent.inputReference,
    executionId: takeover.value.executionId,
    expectedExecutionRevision: takeover.value.revision,
    expectedAttemptNumber: takeover.value.attemptNumber,
    expectedFencingToken: takeover.value.fencingToken,
    idempotencyKey: `dispatch-recovery-start:${takeover.value.executionId}`,
    policyBindingReference: sourceIntent.policyBindingReference,
    requestedDeadline: operationDeadline(ingress),
  });
  return reliableDisposition(reliable.start(start));
}

function memberStartCommand(state: ApplicationState, member: DispatcherMemberRecord): ExecutionLoopStartCommand | null {
  if (member.outcome !== "claimed" || member.intentId === null) return null;
  const intent = state.executionIntents.find((candidate) => candidate.intentId === member.intentId);
  return intent === undefined || intent.operationKind !== "start" ? null : startCommand(intent);
}

function createManualDispatcherInternal(
  store: PersistenceStore,
  ingress: ManualDispatcherIngress,
  backend: ExecutionBackend,
  control: ManualOutcomeControl,
  options: ManualDispatcherOptions,
): ManualDispatcher {
  const applicationOptions: DispatcherApplicationOptions = Object.freeze({
    adapterId: backend.adapterId,
    adapterVersion: backend.adapterVersion,
    ...(options.executionLeaseSeconds === undefined ? {} : { executionLeaseSeconds: options.executionLeaseSeconds }),
    ...(options.operationDeadlineSeconds === undefined ? {} : { operationDeadlineSeconds: options.operationDeadlineSeconds }),
  });
  const application = createDispatcherApplicationService(store, dispatcherIngress(ingress), applicationOptions);
  const reliable = createReliableExecutionService(store, ingress, backend, control);
  const executionApplication = createExecutionApplicationService(store, Object.freeze({
    currentActor: () => ingress.currentActor(),
    currentLeaseOwner: () => ingress.currentLeaseOwner(),
    now: () => ingress.now(),
    nextId: (kind: "request" | "correlation" | "decision" | "audit" | "execution") =>
      ingress.nextId(kind === "execution" ? "operation" : kind),
  }));
  const active = new Set<string>();

  const heartbeatCheckpoint = (runId: string): DispatcherResult<DispatcherRunView> => {
    const current = application.inspect(runId);
    if (!current.ok || current.value.terminalStatus !== null) return current;
    const now = ingress.now();
    const nowMilliseconds = Date.parse(now);
    const heartbeatMilliseconds = Date.parse(current.value.heartbeatAt);
    const expiryMilliseconds = Date.parse(current.value.leaseExpiresAt);
    if (!Number.isFinite(nowMilliseconds) || !Number.isFinite(heartbeatMilliseconds) ||
      !Number.isFinite(expiryMilliseconds)) {
      return Object.freeze({
        ok: false as const,
        error: Object.freeze({ code: "INVALID_INPUT" as const, message: "Dispatcher checkpoint time is invalid" }),
        requestId: null,
        correlationId: null,
      });
    }
    if (nowMilliseconds >= expiryMilliseconds) {
      return Object.freeze({
        ok: false as const,
        error: Object.freeze({ code: "LEASE_EXPIRED" as const, message: "Dispatcher run lease expired before its checkpoint" }),
        requestId: null,
        correlationId: null,
      });
    }
    const nextExpiryMilliseconds = nowMilliseconds + current.value.requestedLeaseSeconds * 1000;
    if (nowMilliseconds <= heartbeatMilliseconds || nextExpiryMilliseconds <= expiryMilliseconds) return current;
    if (current.value.status !== "starting" && current.value.status !== "reconciling" && current.value.status !== "sweeping") {
      return current;
    }
    return application.heartbeat({
      kind: "dispatch.heartbeat",
      runId: current.value.runId,
      expectedOwnerRevision: current.value.ownerRevision,
      expectedRunRevision: current.value.runRevision,
      expectedStatus: current.value.status,
    });
  };

  const continueRun = (initial: DispatcherRunView): DispatcherResult<DispatcherRunView> => {
    if (initial.terminalStatus !== null) return application.inspect(initial.runId);
    if (active.has(initial.runId)) return Object.freeze({
      ok: false as const,
      error: Object.freeze({ code: "INTEGRITY_FAILURE" as const, message: "Dispatcher stale-run recovery cycle was detected" }),
      requestId: null,
      correlationId: null,
    });
    active.add(initial.runId);
    try {
      let view = application.inspect(initial.runId);
      if (!view.ok) return view;
      if (view.value.ownerId !== ingress.currentLeaseOwner()) {
        const takeover = application.takeover({
          kind: "dispatch.takeover",
          runId: view.value.runId,
          expectedOwnerId: view.value.ownerId,
          expectedOwnerRevision: view.value.ownerRevision,
          expectedRunRevision: view.value.runRevision,
          expectedStatus: view.value.status as "starting" | "reconciling" | "sweeping",
        });
        if (!takeover.ok) return takeover;
        view = takeover;
      }
      if (view.value.status === "starting") {
        const begun = application.beginReconciliation({
          kind: "dispatch.begin_reconciliation",
          runId: view.value.runId,
          expectedOwnerRevision: view.value.ownerRevision,
          expectedRunRevision: view.value.runRevision,
        });
        if (!begun.ok) return begun;
        view = begun;
      }
      if (view.value.status === "reconciling" && !view.value.reconciliationComplete) {
        const inventory = application.reconciliationInventory(view.value.runId);
        if (!inventory.ok) return inventory as DispatcherResult<DispatcherRunView>;
        const resolutions: DispatcherReconciliationResolution[] = [];
        for (const resource of inventory.value) {
          const beforeResource = heartbeatCheckpoint(view.value.runId);
          if (!beforeResource.ok) return beforeResource;
          view = beforeResource;
          let resolution: Pick<DispatcherReconciliationResolution, "disposition" | "code">;
          if (resource.resourceKind === "dispatcher_run") {
            const staleState = readApplicationStateForOwner(store);
            const stale = staleState.dispatcherRuns.find((candidate) => candidate.runId === resource.resourceId);
            if (stale === undefined || !(["starting", "reconciling", "sweeping"] as const).includes(
              stale.status as "starting" | "reconciling" | "sweeping",
            )) {
              resolution = Object.freeze({ disposition: "no_effect" as const, code: "stale_run_already_terminal" });
            } else {
              const recovered = continueRun(Object.freeze({
                runId: stale.runId, status: stale.status, actorId: stale.actorId, ownerId: stale.ownerId,
                ownerRevision: stale.ownerRevision, runRevision: stale.runRevision,
                heartbeatAt: stale.heartbeatAt, leaseExpiresAt: stale.leaseExpiresAt,
                requestedLeaseSeconds: stale.requestedLeaseSeconds,
                reconciliationComplete: staleState.dispatcherReconciliationSummaries.some((candidate) => candidate.runId === stale.runId),
                membershipRevision: staleState.dispatcherMemberships.find((candidate) => candidate.runId === stale.runId)?.membershipRevision ?? null,
                expectedMemberCount: staleState.dispatcherMemberships.find((candidate) => candidate.runId === stale.runId)?.expectedMemberCount ?? null,
                pendingMemberCount: staleState.dispatcherMembers.filter((candidate) => candidate.runId === stale.runId && candidate.lifecycle === "pending").length,
                terminalMemberCount: staleState.dispatcherMembers.filter((candidate) => candidate.runId === stale.runId && candidate.lifecycle === "terminal").length,
                terminalStatus: staleState.dispatcherRunSummaries.find((candidate) => candidate.runId === stale.runId)?.terminalStatus ?? null,
              }));
              if (recovered.ok && recovered.value.terminalStatus !== null) {
                resolution = Object.freeze({ disposition: "reconciled" as const, code: "stale_run_recovered" });
              } else if (!recovered.ok && recovered.error.code === "AUTHORIZATION_DENIED") {
                resolution = Object.freeze({ disposition: "authorization_denied" as const, code: "stale_run_authorization_denied" });
              } else if (!recovered.ok && (recovered.error.code === "PERSISTENCE_FAILURE" ||
                recovered.error.code === "INTEGRITY_FAILURE")) {
                resolution = Object.freeze({ disposition: "failed" as const, code: "stale_run_recovery_failed" });
              } else {
                resolution = Object.freeze({ disposition: "ambiguous" as const, code: "stale_run_recovery_pending" });
              }
            }
          } else {
            const state = readApplicationStateForOwner(store);
            const result = resource.resourceKind === "execution_intent"
              ? (() => {
                const intent = state.executionIntents.find((candidate) => candidate.intentId === resource.resourceId);
                return intent === undefined || intent.state === "finalized" ? null : processIntent(state, intent, reliable, ingress);
              })()
              : resolveExecutionLease(
                state, resource.resourceId, reliable, ingress, executionApplication, store,
              );
            resolution = resource.resourceKind === "execution_lease"
              ? result as Pick<DispatcherReconciliationResolution, "disposition" | "code">
              : result === null
                ? Object.freeze({ disposition: "no_effect" as const, code: "resource_already_settled" })
                : reliableDisposition(result as ReliableExecutionResult);
          }
          resolutions.push(Object.freeze({ ...resource, ...resolution }));
          const afterResource = heartbeatCheckpoint(view.value.runId);
          if (!afterResource.ok) return afterResource;
          view = afterResource;
        }
        const refreshed = heartbeatCheckpoint(view.value.runId);
        if (!refreshed.ok) return refreshed;
        const committed = application.commitReconciliation({
          kind: "dispatch.commit_reconciliation",
          runId: refreshed.value.runId,
          expectedOwnerRevision: refreshed.value.ownerRevision,
          expectedRunRevision: refreshed.value.runRevision,
          resolutions: Object.freeze(resolutions),
        });
        if (!committed.ok) return committed;
        view = committed;
      }
      if (view.value.status === "reconciling") {
        const sealed = application.sealCandidates({
          kind: "dispatch.seal_candidates",
          runId: view.value.runId,
          expectedOwnerRevision: view.value.ownerRevision,
          expectedRunRevision: view.value.runRevision,
        });
        if (!sealed.ok) return sealed;
        view = sealed;
      }
      if (view.value.status === "sweeping") {
        const sweepingRunId = view.value.runId;
        let state = readApplicationStateForOwner(store);
        const members = state.dispatcherMembers.filter((candidate) => candidate.runId === sweepingRunId)
          .sort((left, right) => left.ordinal - right.ordinal);
        for (const member of members) {
          const beforeMember = heartbeatCheckpoint(sweepingRunId);
          if (!beforeMember.ok) return beforeMember;
          view = beforeMember;
          let resolved = member;
          if (member.lifecycle === "pending") {
            const claimed = application.claimAndPrepareMember({
              kind: "dispatch.claim_member",
              runId: view.value.runId,
              expectedOwnerRevision: view.value.ownerRevision,
              expectedRunRevision: view.value.runRevision,
              memberId: member.memberId,
              expectedMembershipRevision: member.membershipRevision,
              expectedMemberRevision: member.revision,
            });
            if (!claimed.ok) return claimed as DispatcherResult<DispatcherRunView>;
            state = readApplicationStateForOwner(store);
            resolved = state.dispatcherMembers.find((candidate) => candidate.memberId === member.memberId) ?? member;
          }
          const afterClaim = heartbeatCheckpoint(sweepingRunId);
          if (!afterClaim.ok) return afterClaim;
          view = afterClaim;
          state = readApplicationStateForOwner(store);
          const command = memberStartCommand(state, resolved);
          if (command !== null) {
            const execution = state.executions.find((candidate) => candidate.executionId === resolved.executionId);
            const now = ingress.now();
            const resolution = execution !== undefined &&
              (execution.ownerId !== ingress.currentLeaseOwner() || execution.leaseExpiresAt <= now)
              ? resolveExecutionLease(
                  state, execution.executionId, reliable, ingress, executionApplication, store,
                )
              : reliableDisposition(reliable.start(command));
            const recoveryFailure = dispatcherRecoveryFailure(resolution);
            if (recoveryFailure !== null) return recoveryFailure;
          }
          const afterEffect = heartbeatCheckpoint(sweepingRunId);
          if (!afterEffect.ok) return afterEffect;
          view = afterEffect;
        }
        const latest = heartbeatCheckpoint(sweepingRunId);
        if (!latest.ok) return latest;
        const finalized = application.finalize({
          kind: "dispatch.finalize",
          runId: latest.value.runId,
          expectedOwnerRevision: latest.value.ownerRevision,
          expectedRunRevision: latest.value.runRevision,
        });
        if (!finalized.ok) return finalized;
        view = finalized;
      }
      return view;
    } finally {
      active.delete(initial.runId);
    }
  };

  return Object.freeze({
    run: (command: DispatcherStartCommand) => {
      const started = application.start(command);
      return started.ok ? continueRun(started.value) : started;
    },
    resume: (runId: string) => {
      const current = application.inspect(runId);
      return current.ok ? continueRun(current.value) : current;
    },
  });
}

export function createManualDispatcher(
  store: PersistenceStore,
  ingress: ManualDispatcherIngress,
  backend: ExecutionBackend,
  control: ManualOutcomeControl,
  options: ManualDispatcherOptions = Object.freeze({}),
): ManualDispatcher {
  return createManualDispatcherInternal(store, ingress, backend, control, options);
}
