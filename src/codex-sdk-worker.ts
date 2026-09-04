import { Codex, type ThreadEvent, type Usage } from "@openai/codex-sdk";

export const PINNED_CODEX_SDK_VERSION = "0.153.2" as const;

export type CodexSdkTerminalEvent =
  | Readonly<{ type: "turn.completed"; usage: Usage }>
  | Readonly<{ type: "turn.failed" }>;

export type CodexSdkObservedEvent =
  | Readonly<{ type: "thread.started"; threadId: string }>
  | Readonly<{ type: "turn.started" }>
  | CodexSdkTerminalEvent;

export interface CodexSdkRunRequest {
  readonly operation: "start" | "resume";
  readonly threadId: string | null;
  readonly workingDirectory: string;
  readonly input: string;
  readonly signal: AbortSignal;
}

export interface CodexSdkDriver {
  run(
    request: CodexSdkRunRequest,
    observe: (event: CodexSdkObservedEvent) => void,
  ): Promise<void>;
}

export type CodexSdkDriverErrorCode =
  | "invalid_event"
  | "thread_identity_changed"
  | "terminal_missing"
  | "terminal_duplicated"
  | "stream_error";

export class CodexSdkDriverError extends Error {
  readonly code: CodexSdkDriverErrorCode;

  constructor(code: CodexSdkDriverErrorCode) {
    super("Codex SDK stream did not provide an authoritative bounded result");
    this.name = "CodexSdkDriverError";
    this.code = code;
  }
}

const USAGE_KEYS = Object.freeze([
  "cache_write_input_tokens",
  "cached_input_tokens",
  "input_tokens",
  "output_tokens",
  "reasoning_output_tokens",
] as const);

function boundedUsage(value: unknown): Usage | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (JSON.stringify(Object.keys(descriptors).sort()) !== JSON.stringify(USAGE_KEYS)) return null;
  const counts = Object.fromEntries(USAGE_KEYS.map((key) => {
    const descriptor = descriptors[key];
    return descriptor !== undefined && "value" in descriptor &&
      Number.isSafeInteger(descriptor.value) && descriptor.value >= 0
      ? [key, descriptor.value]
      : [key, null];
  })) as Readonly<Record<(typeof USAGE_KEYS)[number], number | null>>;
  if (Object.values(counts).some((count) => count === null)) return null;
  return Object.freeze({
    input_tokens: counts.input_tokens!,
    cached_input_tokens: counts.cached_input_tokens!,
    cache_write_input_tokens: counts.cache_write_input_tokens!,
    output_tokens: counts.output_tokens!,
    reasoning_output_tokens: counts.reasoning_output_tokens!,
  });
}

function validThreadId(value: string): boolean {
  return value.length > 0 && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
}

function observeEvent(
  event: ThreadEvent,
  request: CodexSdkRunRequest,
  observe: (event: CodexSdkObservedEvent) => void,
  state: { threadId: string | null; turnStarted: boolean; terminal: boolean },
): void {
  if (event.type === "thread.started") {
    if (!validThreadId(event.thread_id) || (request.threadId !== null && request.threadId !== event.thread_id) ||
      state.turnStarted || state.terminal || (state.threadId !== null && state.threadId !== event.thread_id)) {
      throw new CodexSdkDriverError("thread_identity_changed");
    }
    state.threadId = event.thread_id;
    observe(Object.freeze({ type: "thread.started", threadId: event.thread_id }));
    return;
  }
  if (event.type === "turn.started") {
    if (state.turnStarted || state.terminal || (request.operation === "start" && state.threadId === null)) {
      throw new CodexSdkDriverError("invalid_event");
    }
    state.turnStarted = true;
    observe(Object.freeze({ type: "turn.started" }));
    return;
  }
  if (event.type === "turn.completed") {
    if (state.terminal) throw new CodexSdkDriverError("terminal_duplicated");
    const usage = boundedUsage(event.usage);
    if (!state.turnStarted || usage === null) throw new CodexSdkDriverError("invalid_event");
    state.terminal = true;
    observe(Object.freeze({ type: "turn.completed", usage }));
    return;
  }
  if (event.type === "turn.failed") {
    if (state.terminal) throw new CodexSdkDriverError("terminal_duplicated");
    if (!state.turnStarted) throw new CodexSdkDriverError("invalid_event");
    state.terminal = true;
    observe(Object.freeze({ type: "turn.failed" }));
    return;
  }
  if (event.type === "error") throw new CodexSdkDriverError("stream_error");
  // Item events may contain model text, commands, paths, tool arguments, or raw output.
  // They are intentionally neither returned nor persisted by this boundary.
}

export class PinnedCodexSdkDriver implements CodexSdkDriver {
  readonly #codex: Pick<Codex, "startThread" | "resumeThread">;

  constructor(codex: Pick<Codex, "startThread" | "resumeThread"> = new Codex()) {
    this.#codex = codex;
  }

  async run(
    request: CodexSdkRunRequest,
    observe: (event: CodexSdkObservedEvent) => void,
  ): Promise<void> {
    const threadOptions = Object.freeze({
      workingDirectory: request.workingDirectory,
      skipGitRepoCheck: false,
      sandboxMode: "workspace-write" as const,
      networkAccessEnabled: false,
      webSearchMode: "disabled" as const,
      approvalPolicy: "never" as const,
    });
    const thread = request.operation === "start"
      ? this.#codex.startThread(threadOptions)
      : this.#codex.resumeThread(request.threadId!, threadOptions);
    const streamed = await thread.runStreamed(request.input, Object.freeze({ signal: request.signal }));
    const state = { threadId: request.threadId, turnStarted: false, terminal: false };
    try {
      for await (const event of streamed.events) observeEvent(event, request, observe, state);
    } catch (error) {
      if (error instanceof CodexSdkDriverError) throw error;
      throw new CodexSdkDriverError("stream_error");
    }
    if (request.operation === "start" && state.threadId === null) {
      throw new CodexSdkDriverError("thread_identity_changed");
    }
    if (!state.terminal) throw new CodexSdkDriverError("terminal_missing");
  }
}

export function createPinnedCodexSdkDriver(): CodexSdkDriver {
  return new PinnedCodexSdkDriver();
}
