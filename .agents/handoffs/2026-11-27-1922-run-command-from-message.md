# Handoff: Run shell commands from message code blocks

Supersedes: none
Workspace: OUTLORE, branch `feat/run-command-from-message`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Add a Run button on fenced shell code blocks in completed messages so clicking it opens or reveals the conversation's `!` inline terminal bubble below the feed and launches the command directly. Done looks like the owner accepting the live desktop and paired-web behavior, merging the PR, and recording Delivery in the changelog.

## State

- Work commit `64339a82` (`Add Run button on fenced shell code blocks in messages`) on `feat/run-command-from-message` (branched from `b5abfbc9`) implements the feature, tests, specifications update, working-state note, and verification proof (verified via `git commit` and pre-commit hook).
- Standards review (`STD-1`–`STD-6`) resolved: removed pass-through re-export of `terminalCommandInputOf`, renamed `lang` to `info`, replaced bare `undefined` with `void 0`, exported `CommandRunner` from `markdown.tsx`, deduplicated `focusPanel`/`dispatchToPanel` in `useTerminal.tsx`, and extracted `tryAutoRestart` in `terminalPanel.web.tsx` bringing it to 255 lines (verified via `wc -l`, `bunx biome check`, and re-review).
- Specifications review (`SPEC-1`–`SPEC-3` resolved, `SPEC-4` partially resolved): gated `ConversationFeed` with `canRunCommands={canTakeTurns}` so Ritual top threads hide Run; guarded concurrent `CloseTerminal` restarts with `isRestartingRef`, cleared queued commands on error, checked `!isRunningRef.current` in `terminal.write`'s callback, and capped auto-restart at one attempt; added `EntryView` forwarding tests (`MessageBubble`, `ThreadRootView`, `ExchangeFrame`). Residual gap noted in `SPEC-4`: runtime `useTerminal` / `TerminalPanel` request-sequencing integration tests are not automated.
- Verification proof at `documentation/verification/2026-11-27-run-command-from-message.md`: C1–C3 proven and reproduced in a fresh context (`bunx biome check` 16 files clean, 7-workspace `bun run typecheck` exit 0, `CI=1 bun run test apps/app` 133 files / 1,099 passed / 6 skipped); C4 (live desktop, paired web, and native phone visual/interactive check) is awaiting human judgment (verified by fresh-context reproduction).

## Decisions

- **Fenced shell blocks only (Q1, owner 2026-11-27):** Only `bash`, `sh`, `zsh`, `shell`, `fish`, `console`, `powershell`, `pwsh`, `cmd`, and `bat` fenced blocks on completed messages get a Run button; untagged, non-shell, empty, and streaming draft blocks do not (`documentation/capabilities/conversation-terminal/specifications.md`).
- **Reuse the conversation `!` shell bubble (Q2, owner 2026-11-27):** Clicking Run opens or reveals the conversation's existing inline terminal bubble, restarts it at most once if the shell had exited, scrolls it into view, and writes `\r`-formatted input directly to the PTY (`apps/app/src/terminal/terminalScope.ts`, `apps/app/src/terminal/terminalPanel.web.tsx`, `apps/app/src/terminal/useTerminal.tsx`).
- **Placement and availability (Q3, owner 2026-11-27):** Play icon beside Copy in the code block's top-right corner in every terminal-capable conversation (quests, errands, Companion frames, realm/Borderlands channels, Chronicler), hidden on Ritual top threads without a composer, the native phone app, and paired web screens while **Allow terminals from paired devices** is off.

## Next

1. Review the live PR in a running desktop window (light and dark themes): check the play icon beside Copy on `bash` vs `ts`/untagged blocks, and click Run on single-line and multi-line commands across closed, hidden, running, and exited (`exit`) shell states.
2. Verify availability gating on a paired web browser (**Allow terminals from paired devices** on vs off) and confirm the button stays hidden on the native phone app.
3. Once accepted, merge the PR, record a Delivery entry in the next changelog file, and prune the entry from `documentation/work-in-progress.md`.

## Open questions

- Does the owner want automated runtime integration tests for `useTerminal` / `TerminalPanel` request sequencing (`SPEC-4` residual), or is the live desktop/browser check sufficient?

## Sources

- `documentation/capabilities/conversation-terminal/specifications.md`
- `documentation/verification/2026-11-27-run-command-from-message.md`
- `documentation/work-in-progress.md`
- Commit `64339a82` (`Add Run button on fenced shell code blocks in messages`) on `feat/run-command-from-message`
