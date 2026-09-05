import { randomUUID } from "node:crypto";
import { BASE_AUTHORIZATION_ACTIONS } from "./authorization.ts";
import {
  createCodexProductApplication,
  lookupCodexContinuationReplayForCli,
  type CodexProductIngress,
  type CodexProductApplicationService,
  type CodexProductResult,
} from "./codex-product-application.ts";
import {
  createApplicationService,
  type ApplicationResult,
} from "./application.ts";
import {
  inspectRuntimeDoctor,
  inspectRuntimeForRestoreAuthorizationPreflight,
} from "./persistence/doctor.ts";
import { PersistenceError } from "./persistence/errors.ts";
import { inspectPrimaryIdentity, restoreBackup } from "./persistence/backup.ts";
import {
  createLocalProductIngress,
  loadLocalRuntime,
  prepareLocalRuntime,
  selectTrustedLocalRuntimeRoot,
} from "./persistence/local-ingress.ts";
import {
  parseApplicationLifecycleAuthorization,
  readApplicationStateForOwner,
} from "./persistence/application-repository.ts";
import { openPersistence, type PersistenceStore } from "./persistence/store.ts";
import { createManualExecutionBackend } from "./manual-execution-backend.ts";
import {
  createProductRuntime,
  type ProductRuntime,
  type ProductRuntimeResult,
} from "./product-runtime.ts";
import {
  PRODUCT_COMMAND_IDS,
  type CliRunOptions,
  type CliRunResult,
  type ParsedCliCommand,
} from "./cli-api-model.ts";
import {
  applicationCommand,
  confirmationFor,
  option,
  optionProfileRevision,
  optionRevision,
  parseCliArguments,
} from "./cli-api-parser.ts";
import {
  applicationValueResult,
  failureResult,
  mapApplicationFailure,
  mapCodexProductFailureToPublicCode,
  mapDoctorBlock,
  mapPersistenceFailure,
  mapProductFailureToPublicCode,
  successResult,
} from "./cli-api-presentation.ts";

function productCommon(command: ParsedCliCommand): Readonly<Record<string, unknown>> {
  return Object.freeze({
    projectId: option(command, "project-id"),
    expectedProjectResourceRevision: optionRevision(command, "expected-project-resource-revision"),
    expectedProjectConfigRevision: optionRevision(command, "expected-project-config-revision"),
    taskId: option(command, "task-id"),
    expectedTaskRevision: optionRevision(command, "expected-task-revision"),
    executionId: option(command, "execution-id"),
    expectedExecutionRevision: optionRevision(command, "expected-execution-revision"),
    expectedAttemptNumber: optionRevision(command, "expected-attempt-number"),
    expectedFencingToken: optionRevision(command, "expected-fencing-token"),
    idempotencyKey: option(command, "idempotency-key"),
  });
}

type CliProductResult = ProductRuntimeResult<object> | CodexProductResult<object>;

function codexProfileCommon(command: ParsedCliCommand): Readonly<Record<string, unknown>> {
  return Object.freeze({
    projectId: option(command, "project-id"),
    expectedProjectResourceRevision: optionRevision(command, "expected-project-resource-revision"),
    expectedProjectConfigRevision: optionRevision(command, "expected-project-config-revision"),
    profileId: option(command, "profile-id"),
    expectedProfileRevision: optionProfileRevision(command),
  });
}

function executionFamily(
  store: PersistenceStore,
  command: ParsedCliCommand,
): "manual" | "codex" {
  const state = readApplicationStateForOwner(store);
  const executionId = option(command, "execution-id");
  const codexOwned = state.codexProductOperations.some((candidate) => candidate.executionId === executionId);
  const manualOwned = state.manualTurns.some((candidate) => candidate.executionId === executionId);
  if (codexOwned && manualOwned) {
    throw new PersistenceError("CORRUPT_ROW", "Execution backend ownership is mixed");
  }
  return codexOwned ? "codex" : "manual";
}

function invalidCodexProductResult(): CodexProductResult<object> {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({ code: "INVALID_INPUT" as const, message: "The command input is invalid." }),
  });
}

function codexContinuationConfirmationRequiredResult(): CodexProductResult<object> {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({
      code: "CONFIRMATION_REQUIRED" as const,
      message: "Fresh Codex continuation confirmation is required.",
    }),
  });
}

async function executeProductCommand(
  store: PersistenceStore,
  product: ProductRuntime,
  codex: CodexProductApplicationService,
  codexIngress: CodexProductIngress,
  command: ParsedCliCommand,
): Promise<CliProductResult> {
  switch (command.id) {
    case "authorization.upgrade": return product.upgrade(Object.freeze({
      kind: "authorization.upgrade",
      expiresAt: option(command, "expires-at"),
    }));
    case "dispatch.run": return product.dispatchRun(Object.freeze({
      kind: "dispatch.run",
      idempotencyKey: option(command, "idempotency-key"),
      leaseDurationSeconds: Number(option(command, "lease-duration-seconds")),
    }));
    case "dispatch.resume": return product.dispatchResume(Object.freeze({
      kind: "dispatch.resume",
      runId: option(command, "run-id"),
    }));
    case "execution.inspect": {
      const input = Object.freeze({ kind: "execution.inspect", ...productCommon(command) });
      return executionFamily(store, command) === "codex" ? codex.inspect(input) : product.inspect(input);
    }
    case "execution.resume":
    case "execution.retry": {
      const input = Object.freeze({
        kind: command.id,
        ...productCommon(command),
        continuationReference: option(command, "continuation-reference"),
        requiredActionReceiptId: option(command, "required-action-receipt-id"),
      });
      const lookup = lookupCodexContinuationReplayForCli(store, codexIngress, input, command.id);
      if (!lookup.ok) return lookup;
      const family = lookup.value.found ? "codex" : executionFamily(store, command);
      if (family === "manual" && command.options.confirm !== undefined) return invalidCodexProductResult();
      if (family === "codex" && command.options.confirm === undefined) {
        return codexContinuationConfirmationRequiredResult();
      }
      return family === "codex"
        ? command.id === "execution.resume" ? codex.resume(input) : codex.retry(input)
        : command.id === "execution.resume" ? product.resume(input) : product.retry(input);
    }
    case "execution.request-cancel": {
      const input = Object.freeze({
        kind: "execution.request-cancel",
        ...productCommon(command),
        reasonCode: option(command, "reason-code"),
      });
      return executionFamily(store, command) === "codex" ? codex.requestCancel(input) : product.requestCancel(input);
    }
    case "manual.outcome-report": return product.recordManualOutcome(Object.freeze({
      kind: "manual.outcome-report",
      ...productCommon(command),
      reportId: option(command, "report-id"),
      outcome: option(command, "outcome"),
      code: option(command, "code"),
      evidenceReference: command.options["evidence-reference"] ?? null,
    }));
    case "execution.accept-manual-completion": return product.acceptManualCompletion(Object.freeze({
      kind: "execution.accept-manual-completion",
      ...productCommon(command),
    }));
    case "codex.profile.activate": return codex.activateProfile(Object.freeze({
      kind: "codex.profile.activate",
      ...codexProfileCommon(command),
      workspaceRootKey: option(command, "workspace-root-key"),
      workspaceRoot: option(command, "workspace-root"),
      codexHomeKey: option(command, "codex-home-key"),
      codexHome: option(command, "codex-home"),
      gitExecutable: option(command, "git-executable"),
      idempotencyKey: option(command, "idempotency-key"),
    }));
    case "codex.profile.inspect": return codex.inspectProfile(Object.freeze({
      kind: "codex.profile.inspect",
      ...codexProfileCommon(command),
    }));
    case "codex.profile.deactivate": return codex.deactivateProfile(Object.freeze({
      kind: "codex.profile.deactivate",
      ...codexProfileCommon(command),
      idempotencyKey: option(command, "idempotency-key"),
    }));
    case "codex.dispatch-run": return codex.dispatchRun(Object.freeze({
      kind: "codex.dispatch-run",
      ...codexProfileCommon(command),
      taskId: option(command, "task-id"),
      expectedTaskRevision: optionRevision(command, "expected-task-revision"),
      baseReference: option(command, "base-reference"),
      idempotencyKey: option(command, "idempotency-key"),
      leaseDurationSeconds: Number(option(command, "lease-duration-seconds")),
    }));
    default: throw new TypeError("CLI command has no Phase 2 product route");
  }
}

export async function runCli(args: readonly string[], options: CliRunOptions): Promise<CliRunResult> {
  const clock = options.now ?? (() => new Date().toISOString());
  let parseNow: string;
  try {
    parseNow = clock();
  } catch {
    parseNow = "";
  }
  const parsed = parseCliArguments(args, parseNow);
  if (!parsed.ok) return failureResult(parsed.format, parsed.command, parsed.code);
  const command = parsed.command;
  let store: PersistenceStore | null = null;
  let outcome: CliRunResult;
  try {
    const runtimeRoot = selectTrustedLocalRuntimeRoot(command.runtimeRoot);
    if (command.id === "doctor") {
      return successResult(command.format, command.id, inspectRuntimeDoctor(runtimeRoot, options.sourceCheckoutRoot));
    }
    const doctor = command.id === "restore"
      ? inspectRuntimeForRestoreAuthorizationPreflight(runtimeRoot, options.sourceCheckoutRoot)
      : inspectRuntimeDoctor(runtimeRoot, options.sourceCheckoutRoot);
    const block = mapDoctorBlock(command.id, doctor);
    if (block !== null) return failureResult(command.format, command.id, block);
    const selection = command.id === "init"
      ? prepareLocalRuntime(command.runtimeRoot, options.sourceCheckoutRoot)
      : loadLocalRuntime(command.runtimeRoot, options.sourceCheckoutRoot);
    const confirmation = confirmationFor(command);
    const ingressOptions = Object.freeze({
      confirmation: command.options.confirm ?? null,
      expectedConfirmation: confirmation.phrase,
      expectedAction: confirmation.action,
      now: clock,
      ...(options.nextId === undefined ? {} : { nextId: options.nextId }),
    });
    const productIngress = createLocalProductIngress(selection.identity, Object.freeze({
      ...ingressOptions,
      expectedProductAction: confirmation.productAction,
    }));
    const ingress = productIngress;
    store = await openPersistence(selection.layout, {
      applicationVersion: options.applicationVersion ?? "0.0.0-development",
    });
    const service = createApplicationService(store, ingress);
    outcome = await (async (): Promise<CliRunResult> => {
      if (PRODUCT_COMMAND_IDS.has(command.id)) {
        const backend = createManualExecutionBackend(store!, { ingress: productIngress });
        const product = createProductRuntime(store!, productIngress, backend, backend);
        const codex = createCodexProductApplication(store!, productIngress);
        const result = await executeProductCommand(store!, product, codex, productIngress, command);
        return result.ok
          ? successResult(command.format, command.id, result.value)
          : failureResult(
            command.format,
            command.id,
            "owner" in result.error
              ? mapProductFailureToPublicCode(result.error)
              : mapCodexProductFailureToPublicCode(result.error),
          );
      }
      if (command.id === "init") {
        const initialized = service.bootstrap({ kind: "authorization.bootstrap", expiresAt: option(command, "expires-at") });
        if (!initialized.ok) return failureResult(command.format, command.id, mapApplicationFailure(initialized));
        return successResult(command.format, command.id, Object.freeze({
          mode: "initialized",
          expiresAt: option(command, "expires-at"),
          capabilityCount: BASE_AUTHORIZATION_ACTIONS.length,
          epochRevision: 0,
        }));
      }
      if (command.id === "authorization.renew") {
        const renewed = service.renew({ kind: "authorization.capability.renew", expiresAt: option(command, "expires-at") });
        if (!renewed.ok) return failureResult(command.format, command.id, mapApplicationFailure(renewed));
        return successResult(command.format, command.id, renewed.value as unknown as Readonly<Record<string, unknown>>);
      }

      const generationId = command.id === "backup.create" ? randomUUID() : null;
      const routed = applicationCommand(command, selection, generationId);
      if (routed === null) throw new TypeError("CLI command has no application route");
      const result: ApplicationResult<unknown> = service.execute(routed);
      if (!result.ok) return failureResult(command.format, command.id, mapApplicationFailure(result));
      if (command.id === "backup.create") {
        const authorization = parseApplicationLifecycleAuthorization(result.value);
        const generation = await store!.createBackup(authorization);
        const manifest = generation.manifest;
        return successResult(command.format, command.id, Object.freeze({
          generationId: generation.generationId,
          kind: manifest.kind,
          sourceSchemaVersion: manifest.sourceSchemaVersion,
          createdAt: manifest.createdAt,
          verified: true,
        }));
      }
      if (command.id === "restore") {
        const authorization = parseApplicationLifecycleAuthorization(result.value);
        await store!.close();
        store = null;
        const restoreDoctor = inspectRuntimeDoctor(runtimeRoot, options.sourceCheckoutRoot);
        const restoreBlock = mapDoctorBlock(command.id, restoreDoctor);
        if (restoreBlock !== null) {
          return failureResult(command.format, command.id, restoreBlock);
        }
        const expectedCurrent = await inspectPrimaryIdentity(selection.layout);
        const receipt = await restoreBackup(selection.layout, {
          generationId: option(command, "generation-id"),
          expectedCurrent,
          acknowledgeDataLoss: true,
          applicationVersion: options.applicationVersion ?? "0.0.0-development",
          authorization,
        });
        return successResult(command.format, command.id, Object.freeze({
          backupGenerationId: receipt.backupGenerationId,
          targetSchemaVersion: receipt.targetSchemaVersion,
          restoredAt: receipt.restoredAt,
          dataLossAcknowledged: true,
        }));
      }
      return successResult(command.format, command.id, applicationValueResult(command, result.value, clock()));
    })();
  } catch (error) {
    const code = error instanceof PersistenceError ? mapPersistenceFailure(error) : "INTERNAL_ERROR";
    outcome = failureResult(command.format, command.id, code);
  }
  if (store !== null) {
    try {
      await store.close();
    } catch (error) {
      const code = error instanceof PersistenceError ? mapPersistenceFailure(error) : "INTERNAL_ERROR";
      return failureResult(command.format, command.id, code);
    }
  }
  return outcome;
}
