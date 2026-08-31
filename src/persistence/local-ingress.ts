import { createHash, randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { userInfo } from "node:os";
import path from "node:path";
import type { ApplicationIngress, ConfirmationRequest, TrustedActorAssertion } from "../application.ts";
import type { AuthorizationAction } from "../authorization.ts";
import { inspectTrustedRuntimeRoot, type ProjectRootIdentity } from "../project-registry.ts";
import { persistenceFailure } from "./errors.ts";
import {
  inspectExistingRuntimeLayout,
  prepareTrustedRuntimeLayoutForLocalIngress,
  type RuntimeLayout,
} from "./runtime.ts";
import { canonicalJson } from "./values.ts";

export const LOCAL_IDENTITY_VERSION = 1 as const;
export const DEFAULT_RUNTIME_DIRECTORY = "agent-task-orchestrator" as const;

export interface LocalIdentity {
  readonly identityVersion: 1;
  readonly actorId: string;
  readonly principalSha256: string;
  readonly platform: string;
  readonly runtimeRootKey: string;
}

export interface LocalRuntimeSelection {
  readonly layout: RuntimeLayout;
  readonly rootIdentity: ProjectRootIdentity;
  readonly identity: LocalIdentity;
}

export interface LocalIngressOptions {
  readonly confirmation: string | null;
  readonly expectedConfirmation: string | null;
  readonly expectedAction: AuthorizationAction | "authorization.capability.renew" | "authorization.capability.upgrade" | null;
  readonly now?: () => string;
  readonly nextId?: () => string;
}

export type LocalProductConfirmationAction = "manual.turn.report" | "execution.completion.accept";

export interface LocalProductIngressOptions extends LocalIngressOptions {
  readonly expectedProductAction: LocalProductConfirmationAction | null;
}

export interface LocalProductConfirmationRequest {
  readonly actorId: string;
  readonly action: LocalProductConfirmationAction;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface LocalProductIngress extends ApplicationIngress {
  currentLeaseOwner(): string;
  currentDispatcherOwner(): string;
  currentRuntimeRootKey(): string;
  nextId(kind: string): string;
  confirmOperation(request: LocalProductConfirmationRequest): Readonly<{ confirmationId: string }> | null;
}

const FORBIDDEN_IDENTITY = /[\p{Cc}\p{Cf}]/u;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").toUpperCase();
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function canonicalPathKey(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLocaleLowerCase("en-US") : resolved;
}

function trustedOsUserHome(): string {
  try {
    const home = userInfo({ encoding: "utf8" }).homedir;
    if (
      process.platform !== "win32" ||
      typeof home !== "string" ||
      home.length === 0 ||
      !path.isAbsolute(home) ||
      byteLength(home) > 1024
    ) {
      throw new TypeError("OS account home is unavailable");
    }
    return home;
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure(
      "UNSAFE_RUNTIME_ROOT",
      "A trusted per-user application-data root is unavailable",
      {},
      error,
    );
  }
}

export function trustedApplicationDataRoot(): string {
  return path.join(trustedOsUserHome(), "AppData", "Local", DEFAULT_RUNTIME_DIRECTORY);
}

function assertSelectedRuntimeRoot(selected: string, trustedRoot: string): void {
  if (typeof selected !== "string" || selected.length === 0 || !path.isAbsolute(selected) || byteLength(selected) > 1024) {
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Runtime root is not a bounded absolute path");
  }
  const selectedKey = canonicalPathKey(selected);
  const trustedKey = canonicalPathKey(trustedRoot);
  const parentKey = canonicalPathKey(path.dirname(selected));
  const trustedKeys = new Set([trustedKey]);
  try {
    trustedKeys.add(canonicalPathKey(realpathSync.native(trustedRoot)));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Trusted application-data root cannot be resolved", {}, error);
    }
  }
  if (!trustedKeys.has(selectedKey) && !trustedKeys.has(parentKey)) {
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Runtime root is outside the trusted per-user application-data root");
  }
}

export function selectTrustedLocalRuntimeRoot(explicitRuntimeRoot: string | null): string {
  const trustedRoot = trustedApplicationDataRoot();
  const selected = explicitRuntimeRoot ?? trustedRoot;
  assertSelectedRuntimeRoot(selected, trustedRoot);
  return path.resolve(selected);
}

export function deriveLocalIdentity(rootIdentity: ProjectRootIdentity): LocalIdentity {
  try {
    const info = userInfo({ encoding: "utf8" });
    const username = info.username.normalize("NFC");
    if (
      username.length === 0 ||
      username !== info.username ||
      FORBIDDEN_IDENTITY.test(username) ||
      byteLength(username) > 256 ||
      !Number.isSafeInteger(info.uid) ||
      !Number.isSafeInteger(info.gid) ||
      !Number.isFinite(info.uid) ||
      !Number.isFinite(info.gid) ||
      typeof process.platform !== "string" ||
      process.platform.length === 0
    ) {
      throw new TypeError("OS identity is not canonical");
    }
    const principalSha256 = sha256(canonicalJson({
      domain: "ato.local-principal/v1",
      gid: info.gid,
      platform: process.platform,
      uid: info.uid,
      username: username.toLocaleLowerCase("en-US"),
    }));
    const actorId = `local-v1:${sha256(canonicalJson({
      domain: "ato.local-actor/v1",
      principalSha256,
      runtimeRootKey: rootIdentity.rootKey,
    }))}`;
    return Object.freeze({
      identityVersion: LOCAL_IDENTITY_VERSION,
      actorId,
      principalSha256,
      platform: process.platform,
      runtimeRootKey: rootIdentity.rootKey,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("OS_IDENTITY_UNAVAILABLE", "Trusted local OS identity is unavailable", {}, error);
  }
}

export function prepareLocalRuntime(
  explicitRuntimeRoot: string | null,
  sourceCheckoutRoot: string,
  projectRoots: readonly string[] = Object.freeze([]),
): LocalRuntimeSelection {
  const selected = selectTrustedLocalRuntimeRoot(explicitRuntimeRoot);
  const layout = prepareTrustedRuntimeLayoutForLocalIngress(
    { runtimeRoot: selected, sourceCheckoutRoot, projectRoots },
    trustedOsUserHome(),
  );
  const rootIdentity = inspectTrustedRuntimeRoot(layout.root);
  const identity = deriveLocalIdentity(rootIdentity);
  return Object.freeze({ layout, rootIdentity, identity });
}

export function loadLocalRuntime(
  explicitRuntimeRoot: string | null,
  sourceCheckoutRoot: string,
): LocalRuntimeSelection {
  const selected = selectTrustedLocalRuntimeRoot(explicitRuntimeRoot);
  const layout = inspectExistingRuntimeLayout({ runtimeRoot: selected, sourceCheckoutRoot, projectRoots: [] });
  const rootIdentity = inspectTrustedRuntimeRoot(layout.root);
  return Object.freeze({ layout, rootIdentity, identity: deriveLocalIdentity(rootIdentity) });
}

export function createLocalApplicationIngress(
  identity: LocalIdentity,
  options: LocalIngressOptions,
): ApplicationIngress {
  const actor: TrustedActorAssertion = Object.freeze({
    actorId: identity.actorId,
    principal: identity.principalSha256,
  });
  const clock = options.now ?? (() => new Date().toISOString());
  const ids = options.nextId ?? randomUUID;
  return Object.freeze({
    currentActor(): TrustedActorAssertion {
      return actor;
    },
    now(): string {
      return clock();
    },
    nextId(): string {
      return ids();
    },
    confirmHighRisk(request: ConfirmationRequest): boolean {
      return options.expectedConfirmation !== null &&
        options.confirmation === options.expectedConfirmation &&
        options.expectedAction === request.action &&
        request.actorId === identity.actorId;
    },
  });
}

export function createLocalProductIngress(
  identity: LocalIdentity,
  options: LocalProductIngressOptions,
): LocalProductIngress {
  const actor: TrustedActorAssertion = Object.freeze({
    actorId: identity.actorId,
    principal: identity.principalSha256,
  });
  const clock = options.now ?? (() => new Date().toISOString());
  const ids = options.nextId ?? randomUUID;
  let lastClockMilliseconds: number | null = null;
  const monotonicClock = (): string => {
    const value = clock();
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) return value;
    const next = lastClockMilliseconds === null ? milliseconds : Math.max(milliseconds, lastClockMilliseconds + 1);
    lastClockMilliseconds = next;
    return new Date(next).toISOString();
  };
  const ownerId = `owner-v1:${sha256(canonicalJson({
    actorId: identity.actorId,
    domain: "ato.local-manual-owner/v1",
    runtimeRootKey: identity.runtimeRootKey,
  }))}`;
  const dispatcherOwnerId = `dispatcher-v1:${sha256(canonicalJson({
    actorId: identity.actorId,
    domain: "ato.local-manual-dispatcher/v1",
    nonce: randomUUID(),
    runtimeRootKey: identity.runtimeRootKey,
  }))}`;
  return Object.freeze({
    currentActor(): TrustedActorAssertion {
      return actor;
    },
    currentLeaseOwner(): string {
      return ownerId;
    },
    currentDispatcherOwner(): string {
      return dispatcherOwnerId;
    },
    currentRuntimeRootKey(): string {
      return identity.runtimeRootKey;
    },
    now(): string {
      return monotonicClock();
    },
    nextId(_kind: string): string {
      return ids();
    },
    confirmHighRisk(request: ConfirmationRequest): boolean {
      return options.expectedConfirmation !== null &&
        options.confirmation === options.expectedConfirmation &&
        options.expectedAction === request.action &&
        request.actorId === identity.actorId;
    },
    confirmOperation(request: LocalProductConfirmationRequest): Readonly<{ confirmationId: string }> | null {
      if (
        options.expectedConfirmation === null ||
        options.confirmation !== options.expectedConfirmation ||
        options.expectedProductAction !== request.action ||
        request.actorId !== identity.actorId
      ) return null;
      return Object.freeze({ confirmationId: ids() });
    },
  });
}
