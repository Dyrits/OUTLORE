# Delayed quest replies in Claude Code

The owner reported that a quest waiting on a pre-commit hook showed a reply only after a second message.
The batch started at `4776ad15` on `worktree/delayed-quest-replies`.

The Claude Code stand-in emits a background command notification and result immediately before it acknowledges the new prompt.
Before the fix, Outlore marked the quest idle with the background reply as the last visible message on all three attempts.
The adapter now reads through a background result received before the prompt's echo and includes both results in the turn's usage and cost.
The regression checks that “Continue” gets its reply without another send and a subsequent “So?” gets its own reply on the same process.

## Checks

```sh
bun run test packages/service/test/harness/claudeSteering.test.ts packages/service/test/harness/claude.test.ts packages/service/test/harness/harnessProcesses.test.ts
```

All 33 tests passed.
The overlap was exercised through the service with a stand-in process.
The installed app and a signed-in Claude Code session still need a live check.
The service typecheck, Biome on the changed code, and `git diff --check` passed.
