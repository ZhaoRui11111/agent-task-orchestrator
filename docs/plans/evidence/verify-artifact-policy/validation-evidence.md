# Manifest-backed task-artifact lifecycle verification

This focused coordinator task validates the repository artifact policy after
that policy became part of `master`. It does not change product behavior,
expand the disposable-root manifest, or authorize branch/worktree cleanup.

## Frozen task-start evidence

- Task ID: `verify-artifact-policy`
- Initial base: `5c286f340e9cd6ee268def325f28f5c1af57da64`
- Manifest path: `.codex/harness-git-flow.json`
- Manifest blob: `49507c5e7c2cb284457e29e5e7014324bc5dcf9d`
- Schema version: `1`
- Frozen disposable roots: `.task-artifacts`
- Required gates: `artifact-prune-receipt`, `documentation`, `lint`, and
  `offline-full`

The coordinator accepted `start` only while the registered root was absent.
After that receipt, this task created the regular, ignored sentinel
`.task-artifacts/verify-artifact-policy/sentinel.txt`. Its SHA-256 before the
task-result commit is
`61AAC6FA15AD9EB1A12112885C6C51D6B889836E8940659236EFE8544381CE53`.
The root, generation directory, and sentinel were checked as non-reparse
entries, and `git check-ignore` resolved the sentinel through the exact
`/.task-artifacts/` rule.

## Binary completion contract

After this file is committed as the task result, the maintainer coordinator
must explicitly invoke `prune-artifacts` before recording any passed gate. The
operation passes only if its durable receipt binds the exact task head and the
frozen manifest blob, identifies only `.task-artifacts`, reports successful
terminal absence, and a direct filesystem check also finds the root absent.

The coordinator state is the authoritative receipt owner. Gate evidence may
summarize the observed receipt, but this pre-prune source artifact does not
pretend the later external transition has already succeeded. A task-head
change makes the receipt stale. No `cleanup`, force operation, pull request,
release, deployment, or external-repository action belongs to this
verification.
