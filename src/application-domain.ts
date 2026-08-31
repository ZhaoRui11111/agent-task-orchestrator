import {
  addTaskDependency,
  createTask,
  registerProject,
  removeTaskDependency,
  setProjectEnabled,
  setTaskParent,
  transitionTask,
  updateTaskBody,
  type DomainMutation,
  type DomainSnapshot,
  type ProjectDomainMutation,
  type Task,
} from "./domain.ts";
import type { ApplicationState } from "./persistence/application-repository.ts";
import type {
  ApplicationCommand,
  ApplicationFailure,
  OperationIdentity,
  ProjectCommandResult,
} from "./application-model.ts";
import {
  failed,
  isDomainApplicationCommand,
  policyFor,
  projectById,
} from "./application-policy.ts";

export function projectCommandResult(state: ApplicationState, projectId: string): ProjectCommandResult {
  const project = projectById(state, projectId);
  const domainProject = state.domain.projects.find((candidate) => candidate.id === projectId);
  if (project === null || domainProject === undefined) {
    throw new TypeError("Project terminal projection is absent");
  }
  return Object.freeze({
    projectId: project.projectId,
    enabled: domainProject.enabled,
    configRevision: project.configRevision,
    resourceRevision: project.resourceRevision,
  });
}

export function affectedProjectIds(mutation: DomainMutation): readonly string[] {
  const projectIds = new Set<string>();
  for (const taskId of mutation.changedTaskIds) {
    const task = mutation.snapshot.tasks.find((candidate) => candidate.id === taskId);
    if (task === undefined) throw new TypeError("Domain mutation changed an absent Task");
    projectIds.add(task.projectId);
  }
  return Object.freeze([...projectIds].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
}

export function sameProjectIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((projectId, index) => projectId === right[index]);
}

export function taskById(snapshot: DomainSnapshot, taskId: string): Task | null {
  return snapshot.tasks.find((task) => task.id === taskId) ?? null;
}

export function projectDomainMutation(
  command: ApplicationCommand,
  state: ApplicationState,
  identity: OperationIdentity,
): ProjectDomainMutation | ApplicationFailure | null {
  if (command.kind !== "project.disable" && command.kind !== "project.update") return null;
  const enabled = state.domain.projects.find((project) => project.id === command.projectId)?.enabled;
  if (enabled === undefined) {
    return failed("PROJECT_NOT_FOUND", "Domain Project is not registered", identity, { projectId: command.projectId });
  }
  if ((command.kind === "project.disable" && enabled) || (command.kind === "project.update" && !enabled)) {
    const result = setProjectEnabled(state.domain, {
      projectId: command.projectId,
      enabled: command.kind === "project.update",
    });
    return result.ok
      ? result.value
      : failed("DOMAIN_REJECTED", "Domain Core rejected Project enablement", identity, { domainCode: result.error.code });
  }
  return command.kind === "project.disable"
    ? failed("DOMAIN_REJECTED", "Domain Core rejected Project disablement", identity, { domainCode: "NO_OP" })
    : null;
}

export function projectRegistrationMutation(
  state: ApplicationState,
  projectId: string,
): ProjectDomainMutation | null {
  const domainProject = state.domain.projects.find((project) => project.id === projectId);
  if (domainProject !== undefined) return null;
  const result = registerProject(state.domain, { projectId });
  if (!result.ok) throw new TypeError("Domain Project registration failed: " + result.error.code);
  return result.value;
}

export function domainMutation(command: ApplicationCommand, state: ApplicationState): DomainMutation | ApplicationFailure | null {
  if (!isDomainApplicationCommand(command)) return null;
  if (command.kind !== "task.create") {
    const task = taskById(state.domain, command.taskId);
    if (task === null) return failed("TASK_NOT_FOUND", "Task is not registered", null, { taskId: command.taskId });
    if (task.projectId !== command.projectId || task.revision !== command.expectedTaskRevision) {
      return failed("STALE_REVISION", "Task identity, Project, or revision is stale", null, { taskId: command.taskId });
    }
  }
  if (
    command.kind === "task.cancel" &&
    state.executions.some((execution) => execution.taskId === command.taskId && execution.status === "active")
  ) {
    return failed(
      "DOMAIN_REJECTED",
      "An active execution claim requires a later verified interruption path before Task cancellation",
      null,
      { domainCode: "EXTERNAL_PRECONDITION_FAILED" },
    );
  }
  let result;
  switch (command.kind) {
    case "task.create":
      result = createTask(state.domain, { id: command.taskId, projectId: command.projectId, body: command.body, supersedesTaskId: command.supersedesTaskId });
      break;
    case "task.update":
      result = command.change.kind === "body"
        ? updateTaskBody(state.domain, { taskId: command.taskId, body: command.change.body })
        : setTaskParent(state.domain, { taskId: command.taskId, parentId: command.change.parentId });
      break;
    case "task.mark_ready":
      result = transitionTask(state.domain, { taskId: command.taskId, event: "mark_ready", targetState: "ready", payload: {} });
      break;
    case "task.cancel": {
      const dependentWaiting = state.domain.tasks
        .filter((task) => task.state === "ready" && task.dependencyIds.includes(command.taskId))
        .map((task) => ({
          taskId: task.id,
          waiting: {
            reason: "dependency_cancelled" as const,
            phase: "task_management",
            requiredAction: "review_dependency",
            lastErrorCode: "DEPENDENCY_CANCELLED",
            lastErrorSummary: null,
            retryable: false,
            retryCount: 0,
            retryAfter: null,
            executionId: null,
            workspaceRevision: null,
            backendThreadId: null,
          },
        }));
      result = transitionTask(state.domain, {
        taskId: command.taskId,
        event: "cancel",
        targetState: "cancelled",
        payload: { reason: command.reason, executionDisposition: null, dependentWaiting },
      });
      break;
    }
    case "dependency.add":
    case "dependency.remove": {
      const dependency = taskById(state.domain, command.dependencyId);
      if (dependency === null || dependency.revision !== command.expectedDependencyRevision) {
        return failed("STALE_REVISION", "Dependency identity or revision is stale", null, { dependencyId: command.dependencyId });
      }
      result = command.kind === "dependency.add"
        ? addTaskDependency(state.domain, { taskId: command.taskId, dependencyId: command.dependencyId })
        : removeTaskDependency(state.domain, { taskId: command.taskId, dependencyId: command.dependencyId });
      break;
    }
    default:
      return null;
  }
  return result.ok
    ? result.value
    : failed("DOMAIN_REJECTED", "Domain Core rejected the command", null, { domainCode: result.error.code });
}

export function outputFor(command: ApplicationCommand, state: ApplicationState, schemaVersion: number): unknown {
  switch (command.kind) {
    case "authorization.grant.issue":
      return state.grants.at(-1) ?? null;
    case "authorization.grant.inspect":
    case "authorization.grant.revoke":
      return state.grants.find((grant) => grant.grantId === command.grantId) ?? null;
    case "authorization.grant.list": {
      const actorId = state.identity?.actorId ?? state.bootstrap?.actorId ?? "";
      const matches = state.grants
        .filter((grant) => grant.actorId === actorId && (command.afterGrantId === null || grant.grantId > command.afterGrantId))
        .sort((left, right) => left.grantId < right.grantId ? -1 : left.grantId > right.grantId ? 1 : 0);
      const grants = Object.freeze(matches.slice(0, command.limit));
      return Object.freeze({
        grants,
        nextCursor: matches.length > command.limit ? grants.at(-1)?.grantId ?? null : null,
      });
    }
    case "runtime.status":
      return Object.freeze({
        initialized: true,
        schemaVersion,
        projectCount: state.projects.length,
        taskCount: state.domain.tasks.length,
        dependencyCount: state.domain.tasks.reduce((count, task) => count + task.dependencyIds.length, 0),
        grantCount: state.grants.length,
        auditCount: state.audit.length,
      });
    case "runtime.backup":
    case "runtime.restore":
      throw new TypeError("Lifecycle output requires an exact authorization identity");
    case "policy.evaluate": {
      const project = projectById(state, command.projectId);
      return Object.freeze({
        action: command.action,
        policy: policyFor(command.action, project, state),
        projectId: command.projectId,
        resourceRevision: project?.resourceRevision ?? null,
      });
    }
    case "project.register":
    case "project.update":
    case "project.disable":
    case "project.inspect":
      return projectCommandResult(state, command.projectId);
    case "task.create":
    case "task.update":
    case "task.mark_ready":
    case "task.cancel":
    case "task.inspect":
    case "dependency.add":
    case "dependency.remove":
      return taskById(state.domain, command.taskId);
  }
}
