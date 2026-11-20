---
status: accepted
---

# Codex threads may write the repository's Git folder, except its hooks and config

Decided by the owner on 2026-11-20 in the quest "Fix Vibe update": a Codex thread could not stage or commit, while a Claude Code thread could.

## Why

- **The failure.** Codex's workspace sandbox keeps `.git` read-only, so `git add` fails with `Unable to create '.git/index.lock': Operation not permitted`, even when the owner approves a command outside the sandbox (seen in Codex's own session logs on 2026-09-23 and 2026-09-25, and again here). Reproduced with `codex sandbox` on codex-cli 0.171.0, 2026-11-20, in a repository outside `/tmp` and the temporary folder, which the profile writes anyway.
- **Why Git folders are protected.** A hook or a `config` entry (`core.hooksPath`, filters, aliases) runs outside the sandbox on the owner's next Git command, so a writable `.git` would let a sandboxed command escape it.

## Decision

- The thread's permission profile (`outlore`, [0022](0022-the-vault-encrypts-secrets-and-hides-its-folder-from-sandboxes.md)) is used whenever the thread folder is in a Git repository, and adds `write` for the repository's Git folder and a linked worktree's own folder, with `read` for the `hooks` and `config` of each, the submodules' included (`codexGitGrants.ts`). Outside a repository with no Vault folder, `workspace-write` is used as before.
- Checked with `codex sandbox`: `git add` and `git commit` succeed; writing `.git/hooks/pre-commit` or appending to `.git/config` answers `Operation not permitted`.

## Consequences

- A sandboxed Codex command can move branches and rewrite history in the repository, as a Claude Code command can. The Git guard and the owner's approval for pushes still apply.
- The repository's `core.hooksPath` folder (here `.githooks`) is inside the working folder, so it was already writable; this decision does not change that.
- Not run: a live Codex turn through the app server. The profile is the one the Vault already uses, with more entries.
