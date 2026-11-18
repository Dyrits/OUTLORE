# Handoff: Provider sign-in without a Terminal window (CHG-0510)

Supersedes: none
Workspace: OUTLORE, branch `mission/provider-sign-in-without-terminal-96984638` (a worktree), fast-forwarded onto `origin/main` with this handoff

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner complained that signing in to a provider in Settings opens a Terminal window that stays open after "Login successful". Done means no lingering window: hidden, closed by itself, or inside the app, with the least new machinery, and checked with a real sign-in by the owner.

## State

- Verified (git, 2026-11-18): the delivery is commit `191a494` (CHG-0510), based on `origin/main` at `36abda1` with 0 commits behind, so no rebase was needed.
- Verified (read in the diff): Claude Code (`claude auth login`) and Codex (`codex login`) run from the service with no terminal. Each tool opens the browser itself and ends when the browser's answer reaches its local port. `SignInAccount` waits up to 5 minutes and answers with the refreshed harness list (the contract result changed from `Null` to `NullOr(HarnessList)`); a failure shows the command's last 3 lines. The row says "Finish signing in in your browser."
- Verified (read in the diff): OpenCode (`opencode auth login`) keeps its Terminal window because it is an interactive screen. The script closes the window by its tty through `osascript` only when the command exits 0, and stays open with "Sign-in did not finish" on failure. `SignInAccount` answers null there, and the row says the window closes itself and to press Refresh.
- Verified by the errand (typecheck clean in all workspaces, Biome clean, commit hook passed, new tests in `packages/service/test/harness/harnessTools.test.ts`); not re-run in this session.
- Not in this codebase: Mistral Vibe has no sign-in code here (an earlier remark in the quest named it by mistake).
- Assumed, not verified (the sandbox blocks `open` and `osascript`; a real sign-in needs the owner): (1) each CLI opens the browser when started by the service with no terminal; (2) Claude Code's flow completes through its local port with no code pasted (its printed URL is the manual one that needs a pasted code); (3) Terminal closes its own window from the script without an Automation permission prompt; (4) how the new row text looks in the app window.
- The main checkout holds other sessions' uncommitted changes; they are not part of this work.

## Decisions

- Headless sign-in where the tool needs no terminal (Claude Code, Codex); Terminal with auto-close on success where it does (OpenCode). Reason: the least machinery; an in-app terminal would need a pseudo-terminal and a view. Recorded in CHG-0510 and the provider-accounts specification.
- The per-harness switch is the `signInNeedsNoTerminal` fact in `harnessCatalog.ts`. If Claude Code asks for a pasted code, set it to `false` for Claude Code: it returns to the Terminal path, which then closes itself on success.
- Off macOS the message with the command to run is unchanged.

## Next

1. Ask the owner to sign in once per harness in the app and report: does the browser open, does Claude Code finish without a code, does Terminal close for OpenCode with no permission prompt, how does the row read.
2. If Claude Code needs a code or the browser does not open, set `signInNeedsNoTerminal: false` for it in `packages/service/src/harness/harnessCatalog.ts`, and add a changelog entry with the next free CHG number in `documentation/changelog/0.1.10-Prototype.md`.
3. If the Automation prompt appears for OpenCode, look for a way to close the window without scripting Terminal, or accept the prompt once.

## Open questions

- Does the owner prefer an in-app window if the headless path fails for Claude Code? The owner answers after the real sign-in check.

## Sources

- `documentation/changelog/0.1.10-Prototype.md` (CHG-0510) and `documentation/capabilities/provider-accounts/specifications.md` (Sign in).
- Commit `191a494`; `packages/service/src/harness/harnessTools.ts` (`openSignIn`, `terminalSignInScript`), `packages/service/src/harness/harnessCatalog.ts`, `packages/service/src/work/accounts.ts`, `packages/service/src/work/accountsHandlers.ts`, `packages/contracts/src/requests.ts`, `apps/app/src/settings/providers.tsx`.
- The quest journal entries 1 to 3 of the quest "Provider sign-in without terminal".
