# Handoff: Conversation terminal follows the agent's worktree

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/OUTLORE, branch `main` (built in `.worktrees/shell-follows-worktree-114db68b` on `mission/shell-follows-worktree-114db68b`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Ensure the conversation `!` terminal starts in the git worktree an agent created or entered itself (not only an own-copy worktree made by the service), and verify the behavior interactively in a running desktop app and against a live Claude Code `EnterWorktree` run.

## State

- **Verified** on `90a4d0b2` (rebased onto `origin/main` `48542392`):
  - **Service inference & persistence:** `packages/service/src/work/folderMoves.ts` parses shell moves (`cd`, `pushd`, `git worktree add` with `git -C`, `EnterWorktree`, `ExitWorktree`), `packages/service/src/work/workingFolders.ts` validates the stored path as an existing linked worktree of the workspace repository, `packages/service/src/core/recentStoreMigrations.ts` adds `threads.working_folder` (migration `0075`), and `turns.ts`, `threads.ts`, and `missionDetail.ts` record and expose optional `ThreadView.workingFolder`.
  - **Contract & app:** `packages/contracts/src/records.ts` adds optional `workingFolder` on `ThreadView`, and `apps/app/src/conversation/terminalFolder.ts` (`terminalFolderOf`) prefers `workingFolder`, then `ownCopy.path`, then `workspace.path` so older paired hosts fall back cleanly.
  - **Docs & changelog:** Updated `documentation/capabilities/conversation-terminal/specifications.md`, `documentation/architecture.md`, and appended `CHG-0699` to `documentation/changelog/0.2.5-Pre-Alpha.md`.
  - **Checks on `90a4d0b2`:** `bunx biome check` passed on all 11 touched code/config files (0 issues); `CI=1 bun run test packages/service/test/work/folderMoves.test.ts packages/service/test/work/workingFolders.test.ts apps/app/test/conversation/terminalFolder.test.ts` passed (3 files, 23/23 tests); `bun run typecheck` passed across all 7 workspace packages; `git diff --check 48542392..90a4d0b2` passed.
  - **Pre-rebase related suite (on `d27899cb`):** The pre-commit hook ran 257 affected test files (254 passed, 3 sandbox-skipped; 2,039 passed, 16 skipped tests).
- **Assumed / not verified:**
  - Interactive behavior in the running desktop app when opening the `!` terminal after an agent creates or enters a worktree, or after removing that worktree.
  - The real `EnterWorktree` tool-call input/result shape from a live Claude Code session (refused in `-p` mode).
  - Shell-move inference on harnesses other than Claude Code and OpenCode (Codex and ACP providers do not emit shell commands as `Bash` tool calls, so they keep existing fallback behavior).

## Decisions

- **Infer from tool calls instead of harness cwd:** No harness reports its live working directory after launch, so the owner decided the service infers it from the thread's tool calls (2026-11-24).
- **Restrict to existing linked worktrees of the workspace repo:** A candidate folder is exposed as `ThreadView.workingFolder` only when it exists on disk as a real path and is a linked worktree of the workspace repository; removed folders, paths outside the repo, the workspace's own checkout, and scratch-folder threads resolve to none.
- **No ADR added:** The inferred optional field and parser are easily reversible and additive to `ThreadView`.

## Next

1. In a running desktop build, start a Claude Code thread in a git-backed realm, have the agent create and enter a worktree (via `git worktree add` + `cd`, and separately via `EnterWorktree`), open the `!` terminal, and confirm `pwd` opens in that worktree.
2. Remove that worktree (or have the agent `cd` back to the workspace root / call `ExitWorktree`), reopen or restart the `!` terminal, and confirm it falls back to `ownCopy.path` or `workspace.path`.
3. Inspect a real Claude Code `EnterWorktree` tool call transcript/event to confirm the payload shape matches `packages/service/src/work/folderMoves.ts`; adjust and add a regression fixture if it differs.

## Open questions

- Does a live Claude Code `EnterWorktree` tool call pass the created worktree path in the exact field shape assumed by `packages/service/src/work/folderMoves.ts`? Answerable by capturing one live Claude Code session using `EnterWorktree`.
- Should Codex or ACP harnesses gain shell-command tracking later if their adapters expose shell tool calls? Owner product call if needed.

## Sources

- `packages/service/src/work/folderMoves.ts`
- `packages/service/src/work/workingFolders.ts`
- `packages/service/src/core/recentStoreMigrations.ts`
- `packages/contracts/src/records.ts`
- `apps/app/src/conversation/terminalFolder.ts`
- `packages/service/test/work/folderMoves.test.ts`
- `packages/service/test/work/workingFolders.test.ts`
- `apps/app/test/conversation/terminalFolder.test.ts`
- `documentation/capabilities/conversation-terminal/specifications.md`
- `documentation/architecture.md`
- `documentation/changelog/0.2.5-Pre-Alpha.md` (`CHG-0699`)
- Commit `90a4d0b2` on `mission/shell-follows-worktree-114db68b`
