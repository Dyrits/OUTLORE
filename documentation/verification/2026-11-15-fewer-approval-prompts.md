# Proof: fewer questions to leave the sandbox (CHG-0294)

- **Verdict:** the full suite now runs inside a Claude Code thread's sandbox and fails nothing there; before, 31 tests failed there, so every run, and every commit whose hook ran related tests, was run outside it. Not yet shown: the skipped tests running where their capability exists (the owner's machine, outside the sandbox), and the drop in questions in a live thread.
- **Environment:** macOS 26 (Darwin 25.6.0), Electron 45.3.1 from the repository's `node_modules` as the test runtime, a Claude Code thread's sandbox (`SANDBOX_RUNTIME=1`), worktree `.worktrees/fewer-approval-prompts` on `worktree/fewer-approval-prompts` from `3269091`. Runs on 2026-11-15.

## The cause, from the app's approval history

Read from a copy of the app's database, last 3 days (2026-11-13 to 2026-11-15), only counts and the shape of each command. About 120 "Run outside the sandbox" questions, 6 of them answered by a saved permission (Always allow saves the exact command, so a changed word asks again; 122 permissions were saved in those 3 days).

| Kind of command | Questions |
| --- | --- |
| Test runs (`bun run test`, `vitest`) | 21 |
| `git commit` (the pre-commit hook runs the related tests) | 13 |
| `git push` | 18 |
| `git worktree add`, and commands in a worktree beside the checkout | about 23 |
| Other git, other bun, kills, window drives, `gh` | about 36 |

This change addresses the first two rows and the worktree part of the fourth. Pushes, fetches over SSH, killing processes, and window drives still ask by design.

## Before and after, inside the sandbox

`CI=1 bun run test --maxWorkers=4`, json report, in the worktree:

| Run | Passed | Failed | Skipped |
| --- | --- | --- | --- |
| Before (no change) | 1,568 | 31 | 18 |
| After, with `CLAUDE_CONFIG_DIR` set to a leaking value | 1,563 | 1 | 53 |
| After the last guard, full suite, `CLAUDE_CONFIG_DIR` leaking (157 files) | **1,563** | **0** | 54 |

The 31 were: 15 OpenCode threads under Seatbelt (`harnesses.test.ts`), 10 in `openCodeSandbox.test.ts` (Seatbelt, the process tree and the process table), 4 terminals (`posix_spawnp failed`), 2 disk image staging (`hdiutil create` refused). The one failure left after the second run was a process-tree test not yet guarded; it was guarded, and the full run in the last row passed.

Red then green: with `CLAUDE_CONFIG_DIR=/nonexistent/leak` and `vitest.setup.ts` disabled, "runs a thread with an added account's own folder" fails; with it, it passes.

## Not checked

- The guarded tests on a machine where their capability exists: the probes might read false there. Run the suite outside the sandbox once and compare the skipped count (18 before this change, 54 inside the sandbox after it).
- A live thread's number of questions after this lands.
- Codex's sandbox and Linux.
