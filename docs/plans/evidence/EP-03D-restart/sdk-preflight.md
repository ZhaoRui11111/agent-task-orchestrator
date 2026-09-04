# EP-03D pinned Codex SDK preflight

Observed at: `2026-09-04` (`Asia/Shanghai`)

This evidence is a no-account package-surface preflight. It did not run a Codex turn, read credentials, mutate an external Project, or establish Windows/account support. `externalE2E=not_run` and `supportClaim=false` remain required.

## Exact package identity

With explicit registry-read authorization:

```text
pnpm view @openai/codex-sdk version dist.integrity dist.tarball engines dependencies --json
```

returned:

- package: `@openai/codex-sdk`
- exact version: `0.153.2`
- integrity: `sha512-If4CYvo+Zpf6CCKxhuoyhgNbaS93UI9pYfscWr529CxCQK5fhlLQA29efutQVwuj8w9EcMhNM4rjn7zu67S+/w==`
- engine: Node `>=18`
- exact runtime dependency: `@openai/codex` `0.153.2`

The exact SDK was then installed with `ignore-scripts=true` into the task-owned isolated `.task-artifacts/sdk-preflight` directory. The repository `package.json` and `pnpm-lock.yaml` were not changed by this preflight. An attempted `pnpm pack @openai/codex-sdk@0.153.2` instead packed the current local project under pnpm 11; that tarball is explicitly not evidence and remains only in the task artifact inventory for later workflow-owned pruning.

## Public surface and shipped implementation

The shipped `dist/index.d.ts`, `dist/index.js`, source map, and package README establish:

- `Codex.startThread(options)` creates a new in-memory `Thread` whose `id` is initially `null`.
- `ThreadStartedEvent` is documented and implemented as the first stream event. It carries `thread_id`, and the implementation assigns that value to `Thread.id` as the event is consumed.
- `Codex.resumeThread(id, options)` creates a `Thread` whose `id` is the supplied durable identifier and passes that identifier to the CLI `resume` operation.
- `ThreadOptions.workingDirectory` is public and maps to the CLI `--cd` argument.
- `Thread.runStreamed()` exposes a structured async event stream. `turn.started`, `turn.completed`, and `turn.failed` are non-model-text events; `turn.completed` carries usage and `turn.failed` carries a closed SDK error object.
- The SDK exposes no external turn identifier and no inspect operation. EP-03D must therefore bind exactly one local durable turn/attempt to exactly one serialized SDK event stream; it must not invent an external turn ID or external inspection result.
- `TurnOptions.signal` accepts an `AbortSignal`. The implementation forwards it to the spawned Codex child process, but the public surface does not promise an authoritative cancelled terminal observation. Abort/cancel without a terminal event must remain requested/refused/ambiguous rather than verified cancellation.
- The SDK implementation spawns the packaged `@openai/codex` executable only when a run consumes the event generator. Import, `new Codex(...)`, `startThread(...)`, and `resumeThread(...)` do not run a turn.

The no-account probe:

```text
node --input-type=module -e "import { Codex } from '@openai/codex-sdk'; ..."
```

returned:

```json
{"constructor":"ok","newThreadId":null,"resumedThreadId":"preflight-thread-id","spawned":false}
```

## Gate conclusion

V2's minimum package capability is present, with these mandatory implementation bounds:

1. consume `runStreamed()` rather than infer state from `finalResponse`;
2. durably record the first `thread.started.thread_id` before accepting later events;
3. bind the local operation/turn identity to the single serialized event stream because the SDK has no external turn ID;
4. accept success only from `turn.completed` and failure only from `turn.failed` or a classified process/stream failure;
5. treat process loss before durable thread identity, loss after identity but before terminal event, unavailable inspection, and abort without terminal evidence as explicit ambiguity/waiting/refusal with no blind replay;
6. validate the exact owned workspace/cwd binding before invoking the driver; and
7. keep the Codex implementation package-private and non-composed so current vocabulary-v6 authority remains Manual-only.

Direct App Server integration remains excluded and no real-account/platform claim follows from this preflight.
