# Handoff: Delayed Claude Code replies

Supersedes: none
Workspace: Outlore, `worktree/delayed-quest-replies` targeting `origin/main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Verify in the desktop app that a quest answers a message sent as a Claude Code background command finishes.
Each reply should appear without the owner sending a second message.

## State

- Verified by source inspection that the Claude Code adapter tracks the prompt's echo and keeps reading if a background result arrives before that echo.
- The verification note records the stand-in reproduction, 33 passing tests, and passing static checks.
- The overlap in the installed desktop app is unverified.

## Decisions

- Exercise the overlap with a stand-in that emits the background result before acknowledging the next prompt.
- Keep a single Outlore turn open through both results in this overlap and count usage and cost from both.

## Next

1. Run a desktop build containing CHG-0669 with a signed-in Claude Code Companion.
2. Start a short background command, let Claude end its turn, and send a fresh message near the command's completion.
3. Check that the fresh reply appears without another send and that a follow-up gets its own reply.

## Open questions

Can the overlap be observed reliably in the desktop app with the installed Claude Code version?

## Sources

- `documentation/verification/2026-11-23-delayed-quest-replies.md`
- `documentation/changelog/0.2.3-Pre-Alpha.md` (CHG-0669)
- `packages/service/src/harness/claude.ts`
- `packages/service/test/harness/claudeSteering.test.ts`
