# Codex stable public contract feasibility record

This is the non-normative EP-03F capability record for the locally callable
authorized Codex product route. The repository pins `@openai/codex-sdk`
`0.153.2`; the package root exposes the bounded
`createCodexProductApplication` factory, while the concrete SDK driver,
credential resolver, targeted dispatcher, configuration inputs, and injected
test seams remain package-private.

## Required observations

A positive Windows compatibility claim would require official stable public
documentation and real target-environment evidence for all of:

- starting a new thread;
- continuing or resuming the same durable thread;
- binding execution to the exact working directory or project; and
- obtaining stable completion evidence without scraping private state.

The exact package-evidence schema is
[`codex-stable-public-contract.json`](codex-stable-public-contract.json). The
contract checker accepts only the pinned package identity, official OpenAI
documentation sources, four closed package-verified capabilities, the exact
public product factory/types, and the explicit no-account and no-administrator-
attestation boundaries. It also checks that the SDK import has one internal
driver owner and that the package root exposes no credential, configuration,
driver, backend, targeted-dispatcher, replay-lookup, or injected-composition
seam.

## Current boundary

The official [Codex SDK documentation](https://developers.openai.com/codex/sdk)
describes the server-side TypeScript library and its start, continue, and
resume operations. The pinned package's declarations and shipped implementation
add the exact evidence used here: `workingDirectory`, `runStreamed()`, the
first `thread.started` identity event, `turn.completed`/`turn.failed`, and
`AbortSignal` forwarding without an authoritative cancelled terminal promise.
The [App Server documentation](https://developers.openai.com/codex/app-server)
is recorded only to preserve the explicit exclusion: EP-03F does not implement
or fall back to App Server.

The local product route binds the fixed `openai-codex-api` profile to
`process-env:CODEX_API_KEY`, performs workspace Prepare before credential
availability, persists the targeted claim and effect intent, and atomically
consumes fresh profile and execution authorization before resolving the secret
and calling the pinned SDK. Continuations allocate a fresh targeted member,
execution fence, and owned workspace while retaining predecessor history.
These observations establish `productComposition=true` for the closed local
mechanics only.

No real Codex turn, credential, account, external Project, administrator-policy
review, or platform-support test was used. The local OS administrator, installed
Codex runtime, and administrator-managed layers remain explicit trusted-computing-
base assumptions. `administratorPolicyAttestation=not_run`,
`externalE2E=not_run`, and `supportClaim=false` therefore remain mandatory.
Package/type inspection, deterministic injected-driver tests, and disposable
local Git tests establish the closed product mechanics; they do not establish
effective post-managed policy, Windows/account support, or provider behavior.
