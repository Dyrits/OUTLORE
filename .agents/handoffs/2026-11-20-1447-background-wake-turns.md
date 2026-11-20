# Handoff: Turns woken by a background command

Supersedes: none
Workspace: OUTLORE repository, branch `worktree/resume-after-background` (worktree `.worktrees/resume-after-background`), rebased on `origin/main` at `cb7f3f51`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A Claude Code thread that ends its turn to wait for a background command must get the command's result: the replies it writes after waking are recorded, and its commands are not refused. Done means that works on a real long-running command in the app.

## State

- Cause, verified by a probe of Claude Code 2.1.328 in stream-json mode: after the turn's `result`, the end of a background command makes Claude Code send `task_notification`, `init`, replies and a second `result` with no message written to it. Outlore read the process only inside a turn, so those events waited unread, and prompts in that stretch were refused with "This thread is not at work, so nothing runs." (`work/promptPolicy.ts`, `work/approvals.ts`). Details in the verification note.
- Fix, committed as CHG-0595 (`5982eb38`): `core/lineProcess.ts` `observe` hook; `harness/claude.ts` tracks `background_tasks_changed` and `task_notification` and signals the pool; `harness/harnessProcesses.ts` asks a registered listener (`HarnessAdapter.onResume`) for a turn, closes a process whose wake is refused, and keeps a process with background tasks for `backgroundHold` (one hour); `work/threads.ts` `resumeWork` admits a message-less turn (`admitTurn(threadId, true)`); `TurnRequest.isResuming` makes the adapter write no message. Read from the files.
- Tests: 7 new pool tests, 2 new stand-in Claude Code tests (`background <millis>` in `test/fixtures/stand-in-claude.mjs`); the two service tests fail without the listener registration. Before the rebase: service typecheck and Biome passed; the full service suite had 1,502 passed and 1 failed (`loreOverTime` fading test, a 5 s timeout under load that passes alone). After the rebase onto `origin/main` (verified by running them): the service typecheck passed and `bunx vitest run test/harness test/work` passed (916 passed, 38 skipped); the rest of the service suite and the app were not rerun after the rebase.
- Not checked: a real long-running command in the app; background subagents and monitors (assumed to send the same notification); Codex, OpenCode and Vibe (never wake themselves through this path, and it is not known whether they show the problem).
- The rebase dropped the old local commit `2002857e` (file diffs), which `origin/main` already has as `d0e4574c` (CHG-0593).
- The Outlore build that was running during this work lacks the fix: a background command's notification woke that session and its commands were refused, which is the bug itself. Verified by the refusal seen then.

## Decisions

- Run the woken work as a normal turn with no message, rather than reading its events silently: so replies, steps and approvals work unchanged. Recorded in CHG-0595 and the thread-messaging specification (Delivery).
- A woken process the thread may not run (Stopped, held, over budget) is closed, not left running unseen. In the specification and verification note.
- A process with background tasks pending is kept one hour, a choice and not a measurement (`backgroundHold` in `PoolOptions`).
- A line in the thread always names the ended command, using Claude Code's own `summary`; the owner was asked whether to mark the turn and did not answer.

## Next

1. Confirm the pushed state of `origin/main` and that CI or the typecheck and suite pass after the rebase.
2. Run the fix against real Claude Code in the app: ask a thread to start a command that takes a minute in the background and to wait, and check the reply and a following `git` command are recorded and allowed.
3. Probe a background subagent or monitor for the same `task_notification`, and check Codex, OpenCode and Vibe for a similar wait.
4. Decide whether one hour is the right hold, and whether a changed harness or model while the process waits needs a restart (the woken turn would run on the old process).

## Open questions

- Does the owner want the thread line shown for every woken turn, or only on failure? Owner.
- Do Codex, OpenCode or Vibe threads show the same problem? Owner, or a live run.

## Sources

- [Verification](../../documentation/verification/2026-11-20-background-wake-turns.md)
- [Changelog](../../documentation/changelog/0.1.13-Prototype.md), CHG-0595
- [Thread messaging specification](../../documentation/capabilities/thread-messaging/specifications.md), Delivery
- Commit `5982eb38`; `packages/service/src/harness/harnessProcesses.ts`, `harness/claude.ts`, `work/threads.ts`, `work/turnAdmission.ts`
- `packages/service/test/harness/harnessProcesses.test.ts`, `claudeSteering.test.ts`
