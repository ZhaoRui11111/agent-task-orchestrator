# Security policy

## Current status

This repository contains governance and architecture contracts plus a minimal
toolchain and feasibility harness. There is no supported runtime release.
Planned product security controls must not be described as implemented until
matching code and negative tests exist.

## Reporting a vulnerability

Use GitHub private vulnerability reporting after it is enabled for the repository. Do not publish secrets, credentials, personal paths, task prompts, logs, databases, or exploitable details in a public issue.

If private reporting is not yet available, open a minimal public issue requesting a private contact channel without including sensitive or exploitable details.

Do not send secrets or exploit details to an unverified address. The repository does not currently publish a dedicated security email address or promise a response-time service level.

Dependency vulnerability reports follow the same private-first path. The
frozen dependency inventory can be checked locally with
`pnpm dependency:check`; `pnpm dependency:audit` is a separate registry query
and must not be reported as passed when network access was unavailable. The
[toolchain contract](docs/reference/toolchain-contract.md) owns the current
dependency and update mechanics.

## Data handling

For repository contributions, vulnerability reports, and shared diagnostic
evidence:

- Treat task prompts, repository content, adapter responses, and tool output as untrusted input.
- Do not commit credentials, personal information, runtime databases, logs, backups, project paths, worktrees, or execution identifiers.
- Redact diagnostic material before sharing it.
- Require explicit authorization for irreversible or externally visible actions.
- Fail closed when identity, path, revision, receipt, ownership, or authorization is ambiguous.

The [threat model](docs/security/threat-model.md) owns threat and mitigation requirements. [Privacy and logging](docs/security/privacy-and-logging.md) owns data classification, redaction, retention, diagnostic disclosure, and telemetry defaults. These are design contracts, not claims that a runtime currently enforces them.

## Supported versions

No versions are currently supported. A version support table will be added with the first release.

## License

Repository contents are provided under the [Apache License 2.0](LICENSE). Nothing in this security policy creates a warranty or support obligation beyond that license.
