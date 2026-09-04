# Codex stable public contract feasibility record

This is the non-normative EP-03D capability record for the package-private
Codex adapter. The repository pins `@openai/codex-sdk` `0.153.2`, but no
supported product, application, dispatcher, CLI, or package-root factory can
select or construct the adapter.

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
documentation sources, four closed package-verified capabilities, and the
explicit no-account boundary. It also checks the SDK import has one internal
driver owner and that the package root exposes no Codex factory,
configuration, driver, or injected composition service.

## Current boundary

The official [Codex SDK documentation](https://developers.openai.com/codex/sdk)
describes the server-side TypeScript library and its start, continue, and
resume operations. The pinned package's declarations and shipped implementation
add the exact evidence used here: `workingDirectory`, `runStreamed()`, the
first `thread.started` identity event, `turn.completed`/`turn.failed`, and
`AbortSignal` forwarding without an authoritative cancelled terminal promise.
The [App Server documentation](https://developers.openai.com/codex/app-server)
is recorded only to preserve the explicit exclusion: EP-03D does not implement
or fall back to App Server.

No real Codex turn, credential, account, external Project, or platform-support
test was used. `externalE2E=not_run` and `supportClaim=false` therefore remain
mandatory. Package/type inspection, deterministic injected-driver tests, and
disposable local Git tests establish the internal adapter boundary; they do not
establish Windows/account support.
