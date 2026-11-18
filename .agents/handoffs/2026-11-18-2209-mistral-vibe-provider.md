# Handoff: Mistral Vibe as a harness (CHG-0520)

Supersedes: none
Workspace: OUTLORE, branch `main`, committed and pushed to `origin/main` with this handoff

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Outlore runs threads on Mistral Vibe as a fourth harness beside Claude Code, Codex and OpenCode, through Vibe's own ACP server `vibe-acp`. Done means the owner has tried a real thread on a real `vibe-acp` and looked at the Providers card and pickers in a window and on a phone.

## State

- Verified now (command output, before the commit): Biome is clean, `bun run typecheck` passes on all 7 workspaces, and `bun run test packages/service/test/harness apps/app/test` passes (750 passed, 46 skipped). The full suite passed (267 files, 2,178 passed, 55 skipped) on the rebased tree just before the review refactor; it was not re-run after it.
- Verified now (code read): `HarnessName` includes `vibe` (`packages/contracts/src/harnesses.ts`); the turn adapter is `packages/service/src/harness/vibe.ts` (one process per thread, one ACP session per thread, one `session/prompt` per turn, `ask` mode, `session/cancel`, steering waits for the next turn); the short account probes (models, sign-in through `_identity/read` and `_account/read`, monthly plan limit) are in `vibeAccount.ts`; the catalog (`harnessCatalog.ts`) names each harness's installer (npm or uv), release registry (npm or PyPI) and update command as required facts, and `harnessInstallation.ts` and `harnessTools.ts` read them through tables.
- Verified now (tests): the adapter is checked against the stand-in `packages/service/test/fixtures/stand-in-vibe.mjs` (`test/harness/vibe.test.ts`); the uv install path and the Mistral model label have their own tests.
- Assumed: the wire shapes match a real `vibe-acp`. They were read from the `mistral-vibe` 3.1.3 and `agent-client-protocol` 0.11.0 wheels, and no real `vibe-acp` was available to probe.
- Assumed: the Mistral mark (colour `#FA520F`), the Providers card and the pickers look right in light and dark and on a phone. No window was opened.
- The work was first built on an older checkout, then moved onto `origin/main` (3e7972bd). Backups of the old state are the refs `refs/rebase-backup/main-wip` and `refs/rebase-backup/main-start` in the local repository; they are not pushed.

## Decisions

- Vibe runs with Unprotected containment: no host sandbox wrap, so every tool call it asks about asks the owner. Recorded in CHG-0520.
- Vibe's sign-in is `vibe-acp --setup`, an interactive screen, so `signInNeedsNoTerminal` is false and it opens a Terminal window, as OpenCode does.
- Install is `uv tool install --python 3.14 mistral-vibe`, update is `vibe update` (the `vibe` command, not `vibe-acp`), and the newest release is read from PyPI. Recorded in CHG-0520.
- Account folders use `VIBE_HOME`. The command path is `OUTLORE_VIBE_PATH`, default `vibe-acp`.
- The catalog's `installVia`, `releaseRegistry` and `updateCommand` are required on every harness (`updateCommand` is `null` for the npm ones), read through tables rather than branches.
- Vibe's changelog number is CHG-0520, renumbered from CHG-0515, which `origin/main` already uses.

## Next

1. Ask the owner to install Vibe (`uv tool install --python 3.14 mistral-vibe`), then run a short thread on it and check: the first turn, a tool call that asks, an interrupt, a second turn in the same session, and Sign in from the Providers card. Compare what happens with the shapes in the research note, and fix the adapter where they differ.
2. Run the opt-in live check in `packages/service/test/harness/liveHarnesses.test.ts` with `OUTLORE_VIBE_PATH` set, if the owner wants it.
3. Ask the owner to look at the Providers card, the pickers, the usage colours and the Mistral mark in a window and on a phone.

## Open questions

- `session/set_config_option` with `model` persists the model to the account's `config.toml` (a Vibe behaviour, mistralai/mistral-vibe#1556). Is that acceptable? Only the owner answers.
- Should Vibe get a host sandbox wrap like OpenCode's? Not specified; only the owner answers.
- Per-model thinking levels need a Vibe newer than 3.1.3 to be listed. A live probe on a newer build would show whether they appear.

## Sources

- The change: `packages/service/src/harness/{vibe.ts,vibeAccount.ts,harnessCatalog.ts,harnessInstallation.ts,harnessTools.ts,harnesses.ts,instructions.ts}`, `packages/service/src/main.ts`, `packages/contracts/src/harnesses.ts`, `apps/app/src/{foundation/formatting.ts,ui/providerMarks.tsx,shell/usageColors.ts,shell/usageChart.tsx,editors/accountModels.ts}`.
- The tests: `packages/service/test/harness/{vibe.test.ts,harnessInstallation.test.ts}`, `packages/service/test/fixtures/stand-in-vibe.mjs`, `apps/app/test/foundation/companionLabel.test.ts`.
- The changelog and working state: `documentation/changelog/0.1.10-Prototype.md` (CHG-0520), `documentation/work-in-progress.md`.
- The spec: `documentation/capabilities/provider-accounts/specifications.md`.
- The research note: `documentation/research/mistral-vibe-acp-2026-11-18.md`.
- The commit: the one on `main` that adds this file (`git log --oneline -3`).
