# Handoff: Connectors merged with main

Supersedes: `2026-11-19-1915-connector-security-review.md`
Workspace: Outlore, branch `mission/connectors-composio-and-apple-apps-2aaf91f7`, merged with `origin/main` (0f2a55c1) to go to `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Connectors (Composio over HTTP, Apple apps through the pinned `mcp-icloud` 2.1.4, the Vault, the gateway, the Charter screens) are on `main`, and the owner's live checks, which no sandbox can do, are run.

## State

- The connector branch holds the Vault and its read-denial probes, the gateway and catalog, the Vault's owner requests and Claude Code denial stamp, the HTTP backend with Composio's seven tools, the stdio backend with the 41 classified Apple tools and `RequestApplePermission`, the Charter and thread-panel screens, and the fixes of three reviews and one refactor (changelog entries CHG-0536 to CHG-0548).
- `origin/main` had moved 11 commits (a modified file's diff in steps, choice questions as bubbles, the architecture-audit fixes, a shared command runner). Merging it needed these decisions, all made while merging:
  - The branch's changelog entries were renumbered from 0531-0543 to 0536-0548, because `main` took 0531, 0534 and 0535. CHG-0530 (corner marks) is `main`'s.
  - The connectors migration is `0062_connectors`; `main` took `0060_turn_model` and `0061_thread_activity_diffs`.
  - `main` moved `FollowUps` to `work/followUps.ts` and builds the command runner inside `work/threads.ts`. The branch's `shouldStopConnectorCalls` follow-up and its `stopConnectorCalls` dependency now live there; `threads.ts` reads `Connectors` with `Effect.serviceOption` and hands the runner `stopRevokedCalls`. The branch's `commandsLayer` is gone.
  - `ToggleRow` moved to `apps/app/src/ui/toggleRow.tsx`; it gained the branch's `isDisabled`. `connectorsCard.tsx` imports it from there.
  - `harness/lineProcess.ts` had moved to `core/` on the branch; `main`'s new `acpPrompt.ts` and `acpSession.ts` now import it from `core/index.ts`.
- Verified now, in the merge worktree, outside the thread sandbox (2026-11-19, about 20:05): Biome clean; `bun run typecheck` passes on all workspaces; `TMPDIR=<repo>/.tmp-test CI=1 bun run test` gives 2,537 passed, 22 skipped, 1 failed. The failure is `apps/desktop/test/updates/swap.test.ts` ("copies a sealed app out of the image"), `hdiutil attach` refused with Permission denied; it needs the owner's terminal and is unrelated to connectors.
- Assumed, not checked: that no test of `main`'s own new work broke in a way the suite hides; the suite passed, so none did in the tests that exist.
- Never checked live: real Composio (and whether it answers `tools/list` without `initialize`), the macOS Automation prompt and which program macOS names under a login service, a live Claude Code denial probe and Grep/Glob traversal, a real Keychain, a live Codex or OpenCode turn under the folder denial, the packaged app launching with the vendored server, a TLS-downgrade redirect, Windows and Linux, the Charter and thread panel in a window and on a phone.

## Decisions

- The stricter Vault rule stays: a secret is stored only while the folder's read denial is verified for every installed harness, because the Keychain is readable from the three sandboxes (ADR 0022 amended). The owner has not yet confirmed it.
- After every service restart Apple apps need a host-side permission recheck; no safe automatic recheck was found (`documentation/research/apple-automation-restart-2026-11-19.md`).
- A thread tool never reaches the Vault; protection reads probe the harnesses afresh each time.

## Next

1. The owner runs the live Claude check, which the Vault needs before it stores anything: `OUTLORE_LIVE_CLAUDE_PROBE=1 bun run test packages/service/test/vault/readDenialLive`.
2. The owner runs `OUTLORE_LIVE_APPLE_SERVER=1 TMPDIR="$PWD/.tmp-test" CI=1 bun run test packages/service/test/connectors/appleCatalog.test.ts` and requests the Apple permission from the Charter on the Mac.
3. The owner tries a real Composio key (consumer key from the dashboard's AI Clients page, stored through the Charter's Vault section). If the listing fails without `initialize`, add one `initialize` per backend open.
4. A look at the Charter's connector and Vault sections, the placement panels and the thread panel's tools line, on a desktop window and a phone.
5. Delete the old per-errand branches and worktrees (`mission/connectors-composio-and-apple-apps-*`) once `main` carries the merge.
6. Files this branch grew past 256 lines (`contracts/records.ts` is at 504 of 512; the next change to it must shrink it) and the Apple permission ledger inside `make` in `connectors/connectors.ts` are reported, not refactored.

## Open questions

- Whether the owner confirms the stricter Vault rule.
- Whether Apple apps may need no recheck after a restart: answerable only by a packaged-app test of the real sender.

## Sources

- `documentation/capabilities/connectors/specifications.md`, `blueprint.md`
- `documentation/changelog/0.1.12-Prototype.md`, CHG-0536 to CHG-0548
- `documentation/verification/` notes dated 2026-11-19 for the vault read denial, connector gateway, vault-gateway join, HTTP MCP and Composio, stdio Apple backend, connectors merge, connector review fixes, Apple permission readiness and connector security review
- `documentation/research/apple-automation-restart-2026-11-19.md`, `composio-mcp-2026-11-19.md`
- `documentation/architecture-decision-record/0022-the-vault-encrypts-secrets-and-hides-its-folder-from-sandboxes.md`
- `.agents/handoffs/2026-11-19-1915-connector-security-review.md`
