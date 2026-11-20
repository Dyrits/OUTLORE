# Verification of turns woken by a background command

The owner saw a Claude Code thread end its turn with "I resume at its notification" and then never log the answer, and later saw its commands refused with "This thread is not at work, so nothing runs." The batch started at `2002857e` on `worktree/resume-after-background`.

## Cause, probed on the real Claude Code

Claude Code 2.1.328 was run in stream-json mode, asked to start `sleep 8 && echo finished` as a background command and to stop its turn.
It sent `background_tasks_changed` (the pending tasks) and `task_started`, then the turn's `result` at 4.4 s.
When the command ended at 11.8 s it sent, with no message written to it, `task_updated`, `task_notification` (with a `summary`), `background_tasks_changed` (no tasks), `init`, its replies and a second `result`.
Outlore read the process only inside a turn, so those events waited unread, and any prompt in that stretch found no running turn and was refused.

## Checks run

- `packages/service/test/harness/harnessProcesses.test.ts`: 7 new tests on the pool: it asks its listener for a turn and runs it on the same process; asks once for repeated signals; closes a process whose wake is refused; ignores a process that is not stirred; leaves a wake that comes during a turn to that turn; asks after a turn that ended with a wake it never read; keeps a process with background work longer than the idle timeout.
- `packages/service/test/harness/claudeSteering.test.ts`: 2 new tests through the whole service with the Claude Code stand-in (`background <millis>`): the woken turn's reply is recorded, a line gives the ended command's summary, the thread reads Idle, one process ran both turns; a message sent afterwards runs its own turn. Both fail when the listener registration in `work/threads.ts` is removed.
- Service typecheck passed; Biome passed on the 11 changed files.
- Full service suite: 1,502 passed, 54 skipped, 1 failed (`loreOverTime` fading test timed out at 5 s under load; it passes alone, 15 of 15).

## Not checked

- A real long-running command in the app with Claude Code: the stand-in follows the probed event order, but no live Outlore turn was run.
- Other background kinds (a background subagent, a monitor): the same `task_notification` is assumed, not probed.
- A harness other than Claude Code: Codex, OpenCode and Vibe never wake themselves through this path; the owner has not said whether they show the problem.
- The hour a pending background command keeps its process is a choice, not a measurement; the option is `backgroundHold`.
- A thread whose harness or model changed while its process waited would run the woken turn on the old process, recorded under the new harness.
