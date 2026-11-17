# A handover replays the full history

A harness's own session cannot be resumed by another harness, so a handover starts a new session and gives it the thread's full history from the stored turns, as Delta does. Only when that history exceeds the new model's context window is the oldest part summarized. A short briefing was rejected because the user wants nothing lost across a handover.

## Amendment · 2026-11-16

The current handover replays stored message text only. Tool calls and their results are not replayed, and earlier images are named without their bytes. When the replay exceeds half the new model's context window, the oldest messages are omitted with a notice rather than summarized. The remaining work is recorded in the [thread handover specification](../capabilities/thread-handover/specifications.md#current-replay-boundary--2026-11-15).
