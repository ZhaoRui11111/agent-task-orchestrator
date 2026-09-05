import { canonicalJson, sha256 } from "./values.ts";

export const CODEX_PRODUCT_DESTINATION = "openai-codex-api" as const;
export const CODEX_PRODUCT_CREDENTIAL_REFERENCE = "process-env:CODEX_API_KEY" as const;

export const CODEX_PRODUCT_CONSTRUCTOR_IDENTITY = Object.freeze({
  destination: CODEX_PRODUCT_DESTINATION,
  sdk: "@openai/codex-sdk" as const,
  sdkVersion: "0.153.2" as const,
  baseUrl: "https://api.openai.com/v1" as const,
  envKeys: Object.freeze(["CODEX_HOME"] as const),
  codexPathOverride: null,
  config: Object.freeze({ model_provider: "openai" as const }),
  configOverrides: null,
  thread: Object.freeze({
    sandboxMode: "workspace-write" as const,
    networkAccessEnabled: false,
    webSearchMode: "disabled" as const,
    approvalPolicy: "never" as const,
    skipGitRepoCheck: false,
  }),
});

export interface CodexProfileConfigurationDigestInput {
  readonly projectRootKey: string;
  readonly workspaceRootKey: string;
  readonly codexHomeKey: string;
  readonly gitExecutableKey: string;
}

export interface CodexRequiredGrantWitness {
  readonly owner: "codex-product" | "execution-core" | "dispatcher" | "execution-claim" | "workspace";
  readonly action: string;
  readonly projectId: string | null;
  readonly resourceRevision: number | null;
  readonly configRevision: number | null;
  readonly allowed: boolean;
  readonly reason: string;
  readonly policy: string;
  readonly grantId: string | null;
  readonly grantRevision: number | null;
}

export function compactCanonicalJson(value: unknown): string {
  const encoded = canonicalJson(value);
  return encoded.endsWith("\n") ? encoded.slice(0, -1) : encoded;
}

export function codexRequiredGrantSetJson(
  witnesses: readonly CodexRequiredGrantWitness[],
): string {
  return compactCanonicalJson(Object.freeze({
    version: 1 as const,
    conjuncts: Object.freeze(witnesses.map((witness) => Object.freeze({ ...witness }))),
  }));
}

export function codexRequiredGrantSetSha256(requiredGrantSetJson: string): string {
  return sha256(requiredGrantSetJson);
}

/** Bounded identity commitment used until the product owner releases Task bytes at Act. */
export function codexProductTaskInputReference(
  productOperationId: string,
  taskId: string,
  taskRevision: number,
): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(productOperationId) ||
    taskId.length === 0 || taskId.length > 1024 ||
    !Number.isSafeInteger(taskRevision) || taskRevision <= 0) {
    throw new TypeError("Codex product Task binding input is invalid");
  }
  return `codex-task-binding:${sha256(canonicalJson([productOperationId, taskId, taskRevision])).slice(0, 64)}`;
}

export function codexProfileConfigurationProjection(
  input: CodexProfileConfigurationDigestInput,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    constructor: CODEX_PRODUCT_CONSTRUCTOR_IDENTITY,
    credentialReference: CODEX_PRODUCT_CREDENTIAL_REFERENCE,
    projectRootKey: input.projectRootKey,
    workspaceRootKey: input.workspaceRootKey,
    codexHomeKey: input.codexHomeKey,
    gitExecutableKey: input.gitExecutableKey,
  });
}

export function codexProfileConfigurationSha256(input: CodexProfileConfigurationDigestInput): string {
  return sha256(compactCanonicalJson(codexProfileConfigurationProjection(input)));
}
