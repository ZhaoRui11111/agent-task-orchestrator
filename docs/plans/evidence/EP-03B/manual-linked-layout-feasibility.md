# EP-03B manual linked-worktree layout feasibility

- Observed at: `2026-09-02 14:02:14+08:00`
- Host scope: the current Windows development host only
- Node observation: `24.19.0`
- Git observation: `2.53.0.windows.1`
- Fixture scope: one fresh synthetic repository and sibling workspace below the task worktree's ignored `.task-artifacts` root
- Remote count: `0`
- Network and credential operations: not invoked

The probe acquired a new common `worktrees` directory, deterministic linked-admin directory, target directory, every admin control file, the target `.git` file, and one regular target blob without adopting or replacing an existing leaf. It wrote the compatible detached linked-worktree control layout directly, invoked `read-tree` only against the resulting exact admin directory, and then used Git read operations to validate it.

Binary acceptance and actual result:

- `rev-parse --absolute-git-dir` had to resolve the exact newly created linked-admin directory: passed.
- `worktree list --porcelain` had to list the exact target, exact full commit object ID, and `detached`: passed.
- `status --porcelain=v1` had to be empty after the exact blob and index were written: passed.
- No `git worktree add`, checkout, remote, network, or credential operation could occur: passed.

The synthetic commit object ID was `71f6cdd6a2192b95375c9c458fa33837b1405cc6`. The disposable fixture remains an ignored task artifact for the coordinator-owned `prune-artifacts` transition after the terminal result commit. This is feasibility evidence only, not production-adapter validation or a Windows/Git support claim.
