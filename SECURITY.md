# Security policy

## Current status

This repository currently contains governance and architecture-contract documentation only. There is no supported runtime release. Planned security controls must not be described as implemented until matching code and negative tests exist.

## Reporting a vulnerability

Use GitHub private vulnerability reporting after it is enabled for the repository. Do not publish secrets, credentials, personal paths, task prompts, logs, databases, or exploitable details in a public issue.

If private reporting is not yet available, open a minimal public issue requesting a private contact channel without including sensitive or exploitable details.

Do not send secrets or exploit details to an unverified address. The repository does not currently publish a dedicated security email address or promise a response-time service level.

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
