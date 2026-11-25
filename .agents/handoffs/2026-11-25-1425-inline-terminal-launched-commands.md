# Handoff: Inline terminal for launched commands

Supersedes: none
Workspace: Outlore repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Run Outlore-launched interactive commands (starting with provider account sign-in via `SignInAccount`) inside Outlore's inline host-side PTY terminal instead of spawning an external macOS `Terminal.app` window, sharing one unified resizable `InlineTerminal` component with conversation shells.
Done means CHG-0730 is committed and pushed to `origin/main` and the owner has visually accepted interactive sign-in and live drag-resizing in both the Workshop Providers tab and conversations.

## State

- **Contracts (`packages/contracts/src/frames.ts`, `terminalRequests.ts`, `accountRequests.ts`, `results.ts`):** added optional `exitCode` to `TerminalExit` and `TerminalSession`, and changed `SignInAccount` to return `SignInResult` (`Finished` with `HarnessList` or `Terminal` with `{ terminalId, title }`). Verified: `@outlore/contracts` typecheck and service/app suites pass.
- **Host-side PTY service (`packages/service/src/work/terminals.ts`):** added `ConversationTerminals.openCommand()`, `openCommandTerminal()`, `exitCode` tracking/broadcasting, and an optional `spawn` seam on `TerminalHost` for sandboxed tests. Verified: `packages/service/test/work/terminals.test.ts` (16 tests, including real `node-pty` `openCommand`, overlaid env, interactive stdin/stdout, exit codes, session replacement, `SignInAccount` -> `OpenTerminal`, and paired-device gating) passes.
- **Provider sign-in (`packages/service/src/harness/harnessTools.ts`, `packages/service/src/work/accounts.ts`, `accountsHandlers.ts`, `service.ts`):** removed macOS `.command` script generation, `osascript`, and `Terminal.app` launching; `HarnessTools.openSignIn` now returns `{ _tag: "Finished" }` or `{ _tag: "Terminal", command, env, label }` cross-platform, and `signInAccount` starts the session via `openCommandTerminal`. Verified: `packages/service/test/harness/harnessTools.test.ts` (10 tests) and `packages/service/test/harness/harnesses.test.ts` (24 tests) pass.
- **Unified inline terminal UI (`apps/app/src/terminal/inlineTerminal.tsx`, `terminalScope.ts`, `terminalPanel.web.tsx`, `terminalPanelTypes.ts`, `useTerminal.tsx`, `apps/app/src/settings/providers.tsx`):** extracted one atomic `InlineTerminal` molecule (`mode="shell" | "command"`) over the `TerminalPanel` atom and pure helpers in `terminalScope.ts` (`clampTerminalHeight`, `commandTerminalStatusOf`), with a live bottom `PanResponder` drag handle (`140px–720px`) and full width (`100%`) in conversations. In Providers settings, interactive sign-in opens inline beneath the account row, refreshes harnesses on exit, closes automatically on exit code `0`, and stays open on non-zero exit. Verified: `apps/app/test/terminal/` (13 tests), `bun run check`, and `app` + `@outlore/service` typechecks pass.
- **Live visual verification in the running desktop/web app:** not yet performed (assumed working from unit/PTY tests; needs owner check).

## Decisions

- **Reuse the existing host-side PTY service (ADR 0020):** interactive commands run through `ConversationTerminals.openCommand` and stream over the existing `TerminalData`/`TerminalExit` frames rather than adding a parallel terminal transport.
- **Inline under the account row with manual vertical resize:** owner chose Option 2 (inline under the account row) with a manual drag handle (`140px–720px`) instead of a side panel, bottom drawer, or modal.
- **One unified `InlineTerminal` component:** owner asked for clean architecture and atomic design with a single component shared by both conversation shells (`useTerminal.tsx`) and launched commands (`providers.tsx`), avoiding duplicate header/close/resize implementations.
- **Auto-refresh and conditional auto-close on sign-in exit:** `providers.tsx` always refreshes harnesses when the sign-in process exits, closes the inline terminal automatically on exit code `0`, and keeps it open on non-zero exit so errors stay readable.

## Next

1. Visually test interactive sign-in in the Workshop's **Providers** tab (e.g. OpenCode, Vibe, or Antigravity) to verify TUI rendering, browser/device-code output, live bottom-handle resizing, automatic status refresh, and auto-close on exit `0`.
2. Visually test the conversation terminal (`!`) to verify full-width layout, Hide/Show collapse, and live drag-resizing in a real quest.
3. If any other interactive commands are added later (such as interactive updates, installs, or diagnostics), reuse `openCommandTerminal` on the service and `<InlineTerminal mode="command" ... />` on the app.

## Open questions

- None.

## Sources

- `documentation/changelog/0.2.7-Pre-Alpha.md` (CHG-0730)
- `documentation/architecture-decision-record/0020-terminals-run-in-the-host.md`
- `documentation/backlog.md`
- `packages/contracts/src/accountRequests.ts`
- `packages/contracts/src/frames.ts`
- `packages/contracts/src/terminalRequests.ts`
- `packages/service/src/work/terminals.ts`
- `packages/service/src/harness/harnessTools.ts`
- `packages/service/src/work/accounts.ts`
- `apps/app/src/terminal/inlineTerminal.tsx`
- `apps/app/src/terminal/terminalScope.ts`
- `apps/app/src/terminal/useTerminal.tsx`
- `apps/app/src/settings/providers.tsx`
