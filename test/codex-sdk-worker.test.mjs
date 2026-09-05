import assert from "node:assert/strict";
import test from "node:test";
import {
  CodexSdkDriverError,
  PinnedCodexSdkDriver,
  createProductCodexSdkDriver,
} from "../src/codex-sdk-worker.ts";

const USAGE = Object.freeze({
  input_tokens: 2,
  cached_input_tokens: 1,
  cache_write_input_tokens: 0,
  output_tokens: 3,
  reasoning_output_tokens: 1,
});

function stream(events) {
  return Object.freeze({
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event;
    },
  });
}

function fakeCodex(startEvents, resumeEvents = startEvents) {
  const calls = [];
  const thread = (events) => Object.freeze({
    async runStreamed(input, options) {
      calls.push(Object.freeze({ kind: "turn", input, signal: options.signal }));
      return Object.freeze({ events: stream(events) });
    },
  });
  return Object.freeze({
    calls,
    startThread(options) {
      calls.push(Object.freeze({ kind: "start", options }));
      return thread(startEvents);
    },
    resumeThread(threadId, options) {
      calls.push(Object.freeze({ kind: "resume", threadId, options }));
      return thread(resumeEvents);
    },
  });
}

function request(operation, threadId = null) {
  return Object.freeze({
    operation,
    threadId,
    workingDirectory: "D:\\bounded-workspace",
    input: "ephemeral input",
    signal: new AbortController().signal,
  });
}

test("pinned driver starts once, drops item payloads, and binds non-model terminal evidence", async () => {
  const rawSecret = "SENTINEL MODEL TEXT MUST BE DROPPED";
  const client = fakeCodex([
    Object.freeze({ type: "thread.started", thread_id: "thread-1" }),
    Object.freeze({ type: "turn.started" }),
    Object.freeze({ type: "item.completed", item: Object.freeze({ type: "agent_message", text: rawSecret }) }),
    Object.freeze({ type: "turn.completed", usage: USAGE }),
  ]);
  const observed = [];
  await new PinnedCodexSdkDriver(client).run(request("start"), (event) => observed.push(event));
  assert.deepEqual(observed, [
    { type: "thread.started", threadId: "thread-1" },
    { type: "turn.started" },
    { type: "turn.completed", usage: USAGE },
  ]);
  assert.equal(JSON.stringify(observed).includes(rawSecret), false);
  assert.equal(client.calls.filter((call) => call.kind === "start").length, 1);
  assert.equal(client.calls[0].options.workingDirectory, "D:\\bounded-workspace");
  assert.equal(client.calls[0].options.networkAccessEnabled, false);
  assert.equal(client.calls[0].options.approvalPolicy, "never");
});

test("product driver constructs the pinned SDK with only the closed product tuple", async () => {
  const apiKey = "SENTINEL EP03F CONSTRUCTOR KEY";
  const codexHome = "D:\\private-codex-home";
  const client = fakeCodex([
    Object.freeze({ type: "thread.started", thread_id: "thread-1" }),
    Object.freeze({ type: "turn.started" }),
    Object.freeze({ type: "turn.completed", usage: USAGE }),
  ]);
  let captured = null;
  const driver = createProductCodexSdkDriver(Object.freeze({ apiKey, codexHome }), (options) => {
    captured = options;
    return client;
  });

  assert.deepEqual(captured, {
    baseUrl: "https://api.openai.com/v1",
    apiKey,
    env: { CODEX_HOME: codexHome },
    config: { model_provider: "openai" },
  });
  assert.deepEqual(Reflect.ownKeys(captured).sort(), ["apiKey", "baseUrl", "config", "env"]);
  assert.deepEqual(Reflect.ownKeys(captured.env), ["CODEX_HOME"]);
  assert.deepEqual(Reflect.ownKeys(captured.config), ["model_provider"]);
  assert.equal(Object.isFrozen(captured), true);
  assert.equal(Object.isFrozen(captured.env), true);
  assert.equal(Object.isFrozen(captured.config), true);
  assert.equal("codexPathOverride" in captured, false);
  assert.equal("configOverrides" in captured, false);

  const selected = request("start");
  await driver.run(selected, () => {});
  assert.deepEqual(client.calls[0], {
    kind: "start",
    options: {
      workingDirectory: selected.workingDirectory,
      skipGitRepoCheck: false,
      sandboxMode: "workspace-write",
      networkAccessEnabled: false,
      webSearchMode: "disabled",
      approvalPolicy: "never",
    },
  });
  assert.equal(client.calls[1].signal, selected.signal);
});

test("pinned driver resumes only the supplied thread and refuses replacement identity", async () => {
  const client = fakeCodex([], [
    Object.freeze({ type: "turn.started" }),
    Object.freeze({ type: "turn.completed", usage: USAGE }),
  ]);
  const observed = [];
  await new PinnedCodexSdkDriver(client).run(request("resume", "thread-1"), (event) => observed.push(event));
  assert.equal(client.calls[0].kind, "resume");
  assert.equal(client.calls[0].threadId, "thread-1");
  assert.deepEqual(observed, [{ type: "turn.started" }, { type: "turn.completed", usage: USAGE }]);

  const changed = fakeCodex([], [
    Object.freeze({ type: "thread.started", thread_id: "thread-2" }),
    Object.freeze({ type: "turn.completed", usage: USAGE }),
  ]);
  await assert.rejects(
    new PinnedCodexSdkDriver(changed).run(request("resume", "thread-1"), () => {}),
    (error) => error instanceof CodexSdkDriverError && error.code === "thread_identity_changed",
  );
});

test("pinned driver rejects every duplicate thread.started event for start and resume", async () => {
  const duplicateStart = fakeCodex([
    Object.freeze({ type: "thread.started", thread_id: "thread-1" }),
    Object.freeze({ type: "thread.started", thread_id: "thread-1" }),
    Object.freeze({ type: "turn.started" }),
    Object.freeze({ type: "turn.completed", usage: USAGE }),
  ]);
  await assert.rejects(
    new PinnedCodexSdkDriver(duplicateStart).run(request("start"), () => {}),
    (error) => error instanceof CodexSdkDriverError && error.code === "thread_identity_changed",
  );

  const duplicateResume = fakeCodex([], [
    Object.freeze({ type: "thread.started", thread_id: "thread-1" }),
    Object.freeze({ type: "thread.started", thread_id: "thread-1" }),
    Object.freeze({ type: "turn.started" }),
    Object.freeze({ type: "turn.completed", usage: USAGE }),
  ]);
  await assert.rejects(
    new PinnedCodexSdkDriver(duplicateResume).run(request("resume", "thread-1"), () => {}),
    (error) => error instanceof CodexSdkDriverError && error.code === "thread_identity_changed",
  );
});

test("pinned driver maps turn.failed without retaining the SDK error payload", async () => {
  const rawSecret = "SENTINEL SDK FAILURE MUST BE DROPPED";
  const client = fakeCodex([
    Object.freeze({ type: "thread.started", thread_id: "thread-1" }),
    Object.freeze({ type: "turn.started" }),
    Object.freeze({ type: "turn.failed", error: Object.freeze({ message: rawSecret }) }),
  ]);
  const observed = [];
  await new PinnedCodexSdkDriver(client).run(request("start"), (event) => observed.push(event));
  assert.deepEqual(observed, [
    { type: "thread.started", threadId: "thread-1" },
    { type: "turn.started" },
    { type: "turn.failed" },
  ]);
  assert.equal(JSON.stringify(observed).includes(rawSecret), false);
});

test("pinned driver refuses missing, duplicate, malformed, and stream-error terminal evidence", async () => {
  const cases = [
    [[{ type: "thread.started", thread_id: "thread-1" }, { type: "turn.started" }], "terminal_missing"],
    [[
      { type: "thread.started", thread_id: "thread-1" },
      { type: "turn.started" },
      { type: "turn.completed", usage: USAGE },
      { type: "turn.failed", error: { message: "raw" } },
    ], "terminal_duplicated"],
    [[
      { type: "thread.started", thread_id: "thread-1" },
      { type: "turn.completed", usage: USAGE },
    ], "invalid_event"],
    [[
      { type: "thread.started", thread_id: "thread-1" },
      { type: "turn.started" },
      { type: "turn.completed", usage: { ...USAGE, output_tokens: -1 } },
    ], "invalid_event"],
    [[{ type: "thread.started", thread_id: "thread-1" }, { type: "error", message: "raw" }], "stream_error"],
  ];
  for (const [events, code] of cases) {
    await assert.rejects(
      new PinnedCodexSdkDriver(fakeCodex(events)).run(request("start"), () => {}),
      (error) => error instanceof CodexSdkDriverError && error.code === code,
    );
  }

  const disconnected = Object.freeze({
    startThread() {
      return Object.freeze({
        async runStreamed() {
          return Object.freeze({
            events: Object.freeze({
              async *[Symbol.asyncIterator]() {
                yield Object.freeze({ type: "thread.started", thread_id: "thread-1" });
                throw new Error("SENTINEL DISCONNECT MUST NOT ESCAPE");
              },
            }),
          });
        },
      });
    },
    resumeThread() {
      throw new Error("resume is outside this fixture");
    },
  });
  await assert.rejects(
    new PinnedCodexSdkDriver(disconnected).run(request("start"), () => {}),
    (error) => error instanceof CodexSdkDriverError && error.code === "stream_error" &&
      !error.message.includes("SENTINEL"),
  );
});
