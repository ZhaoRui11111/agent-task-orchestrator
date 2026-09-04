# Scheduler local contract feasibility record

This is the non-normative EP-03E evidence record for the library-level
`ato.scheduler/v1` boundary. It records the pure port, injected application
owner, and scheduled-dispatch ingress as implemented. Tests exercise those
surfaces with a deterministic no-effect Fake that is neither production code
nor a package export.

The exact evidence schema is
[`scheduler-local-contract.json`](scheduler-local-contract.json). The contract
checker also verifies that production contains only the scheduler port,
application owner, and receipt-digest helper; that the port imports no Node.js
infrastructure; that the package root exports the pure contract and injected
application surface but not the Fake; and that the default product and CLI have
no scheduler operation route or construction path.

No concrete scheduler backend, platform grammar, registration effect, scheduled
task, daemon, external Project, or real trigger execution was selected or used.
The generic authorization-management surface can manage the vocabulary-version-7
scheduler action labels, but that does not create a scheduler operation route.
Accordingly `adapterImplemented=false`, `externalE2E=not_run`, and
`supportClaim=false` are mandatory.
