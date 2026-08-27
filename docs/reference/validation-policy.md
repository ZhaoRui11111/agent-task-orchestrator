# Validation policy

Validation is selected by impact rather than by a single fixed command. Every validation report records commands, binary acceptance criteria, actual results, and omitted gates.

## Impact routes

| Impact | Minimum validation when that surface exists |
| --- | --- |
| Documentation | Link resolution, authority consistency, current-capability wording, whitespace |
| Domain or state machine | Targeted unit tests and property/state-machine tests |
| Persistence or migration | Targeted tests, migration matrix, concurrency, crash recovery |
| Dispatcher or recovery | Contract tests, fencing tests, failpoint recovery |
| Adapter | Adapter contract tests and relevant operating-system E2E |
| CLI or MCP | Schema tests, application-service contract tests, negative input tests |
| Security boundary | Threat-driven negative tests and authorization tests |
| Cross-cutting or high risk | Full applicable gate |

## Current documentation gate

Only the documentation route exists today. A documentation change passes when:

- Every repository-relative Markdown link points to an existing committed or staged file.
- Current capabilities are not mixed with planned capabilities.
- Authority owners are unambiguous.
- `git diff --check` reports no whitespace errors.
- The staged inventory contains only task-owned paths.
- No runtime data, local project data, credential, or secret is staged.

Future code must add executable validation commands and CI gates before claiming the corresponding route is enforced.
