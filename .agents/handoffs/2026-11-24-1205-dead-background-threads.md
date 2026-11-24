# Handoff: Claude background wakes

Supersedes: none
Workspace: Outlore, `worktree/publish-dead-background-threads`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Verify that a Claude Code quest or errand continues receiving messages after a background task completes.

## State

- Verified by two regression tests that a wake received during turn settlement is recorded and that a wake whose original process has exited fails without opening a new process.
- Verified in the original errand worktree that 31 focused tests passed, including the two regressions across the Claude steering and harness process suites.
- Verified in the first workspace test run that the eight-thread queue test failed; its relation to this change is unverified.
- Verified by reading the app and service code that Underway offers Stop with an empty composer, while Resting has no Stop and its queued messages offer Edit and Remove.

## Decisions

- Admit a background wake after the preceding turn outcome is recorded, and run it only on the process that produced it.
- Keep the wait for a legitimate long-running turn unchanged while investigating the reported failure separately from the two reproduced races.

## Next

1. In the running app, let a Claude Code quest and an errand each finish a turn with a background task still running, then check that the task completion and the next owner message both get a reply.
2. If messages still queue indefinitely, record the thread state, the task status, and the order of the last turn result, task notification, and next prompt echo.
3. Run the eight-thread admission test on the base revision and on the fix before attributing its failure.

## Open questions

- The reported live incident has not been reproduced.
- Setup can precede interrupt registration, and the process read has no overall deadline; neither was reproduced as the cause of the incident.
- The existing Claude overlap test covers a wake result before the prompt echo; a standalone wake result arriving after the echo is unconfirmed.

## Sources

- `packages/service/src/harness/harnessProcesses.ts`, `packages/service/src/harness/claude.ts`, `packages/service/src/work/threads.ts`, and `packages/service/src/work/turnAdmission.ts`.
- `packages/service/test/harness/claudeSteering.test.ts`, `packages/service/test/harness/harnessProcesses.test.ts`, and `packages/service/test/work/threads.test.ts`.
- `apps/app/src/conversation/queuedMessageActions.tsx` and `packages/service/src/work/lifecycle.ts`.
