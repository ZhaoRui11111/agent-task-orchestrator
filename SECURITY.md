# Security policy

## Current status

This repository currently contains governance documentation only. There is no supported runtime release. Planned security controls must not be described as implemented until their code and negative tests exist.

## Reporting a vulnerability

Use GitHub private vulnerability reporting after it is enabled for the repository. Do not publish secrets, credentials, personal paths, task prompts, logs, databases, or exploitable details in a public issue.

If private reporting is not yet available, open a minimal public issue requesting a private contact channel without including sensitive or exploitable details.

## Data handling

- Treat task prompts, repository content, adapter responses, and tool output as untrusted input.
- Do not commit credentials, personal information, runtime databases, logs, backups, project paths, worktrees, or execution identifiers.
- Redact diagnostic material before sharing it.
- Require explicit authorization for irreversible or externally visible actions.
- Fail closed when identity, path, revision, receipt, ownership, or authorization is ambiguous.

## Supported versions

No versions are currently supported. A version support table will be added with the first release.
