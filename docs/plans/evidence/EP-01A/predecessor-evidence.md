# EP-01A predecessor evidence

This record binds EP-01A to its immediate predecessor without copying the predecessor's machine state.

## Binary criterion

EP-00B must have one terminal commit; its historical scope at that exact commit must have no completion blocker; and strict chain-check must bind the EP-01A material base to that same commit.

## Observation

Observed on 2026-08-28 from the canonical EP-01A task worktree with Python `3.12.7` and Git `2.53.0.windows.1`:

- `exec_plan.py terminal-resolve --repo <task-worktree> --plan docs/plans/completed/EP-00B-toolchain-feasibility.md --json` exited `0` and returned the sole terminal commit `fdac1101e539a26957847a589d0a7c3a5dbc37c2`.
- `exec_plan.py scope --repo <task-worktree> --plan docs/plans/completed/EP-00B-toolchain-feasibility.md --at fdac1101e539a26957847a589d0a7c3a5dbc37c2 --json` exited `0` with `errors=[]`, `warnings=[]`, `outside_scope=[]`, no completion blocker, and historical material state `git-sha1:923b6bc33674b89c29dea896041c35507fb805f6`.
- `exec_plan.py chain-check --repo <task-worktree> --plan docs/plans/completed/EP-00B-toolchain-feasibility.md --successor-plan docs/plans/active/EP-01A-domain-core.md --json` exited `0` and bound both predecessor terminal and successor material base to `fdac1101e539a26957847a589d0a7c3a5dbc37c2`.

Result: `passed`.
