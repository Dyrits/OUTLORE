# Handoff: desktop conversation panes after the blank-panel fix

Supersedes: `2026-11-20-0130-conversation-panes.md`
Workspace: Outlore, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review the desktop conversation layout for Pre-Alpha and resume the agreed Chronicle follow-up when the owner is ready. This handoff adds the fix for the owner's blank conversation panel in the development window.

## State

- Everything in the superseded handoff still holds (the panes are in `4d175911`, merged by `00d2be21`).
- The owner saw a blank panel instead of a quest's conversation in the development window. Cause, verified in a copy of the development store (`~/Library/Application Support/Outlore Dev/outlore.sqlite`): migration 65 was recorded, but `messages.is_conversation_only` and `suggestions.proposal_message_id` did not exist, because `4d175911` added those columns to 0065 and 0064 after that store had recorded them. `ReadMission` failed with `no such column: m.is_conversation_only`, and `PaneHost` draws nothing, with no error, until its own read answers.
- Fix (CHG-0570): migration `0066_repair_pane_columns` in `packages/service/src/core/recentStoreMigrations.ts` adds each column only where it is missing. Verified: `packages/service/test/core/store.test.ts` has a test that drops both columns after 0065 and migrates (red before 0066, green after), plus one for a store migrated in one run; the real migrations run on the copy of the development store made its quest-read query answer; Biome and the service typecheck pass; the service core and work tests give 704 passed, 20 failed, all in four files (`approvalsFolders`, `folderPicker`, `ownCopies`, `workspaceEntries`) that stop at `git init` inside a thread's sandbox.
- A freshly started quest renders correctly (channel pane plus quest pane) when the real `PaneHost` is bundled for the browser and run in Electron against a fake client, so the layout code was not the cause. That harness was throwaway and is deleted.
- Not verified: the owner's window after restarting the development app. The released app's store is at migration 62, so it was never affected (assumed from one read of its `effect_sql_migrations`).
- Not fixed: `PaneHost` still shows nothing, and no message, when its own `ReadMission` read fails.

## Decisions

- A migration the development store may have applied is never edited; a new guarded migration is added instead (workspace lore, CHG-0570).
- The decisions of the superseded handoff stand: expandable realm groups in the sidebar, the realm name opens its chat, new follow-up work from an errand starts as an attributed message in the quest, one Chronicle sidebar item (CHG-0569).

## Next

1. Restart the development app (`bun run dev`), open a quest, and check its conversation shows. Tell the owner if it does not.
2. Check the sidebar, both quest tabs, Reply, legacy errand return, and the Workshop round trip in a desktop window.
3. Optionally show an error in `PaneHost` when its read fails, so a future read failure is not a blank panel.
4. Resume the Chronicle attention feed when the owner asks to continue.

## Open questions

- Desktop interaction and appearance await the window check.
- Missives as a tab label and a realm-level Quests tab are proposals.
- Whether to surface `PaneHost` read errors (Next, step 3): the owner decides.

## Sources

- [Changelog](../../documentation/changelog/0.1.13-Prototype.md), CHG-0570
- `packages/service/src/core/recentStoreMigrations.ts` (migrations 0064 to 0066) and `packages/service/test/core/store.test.ts`
- `apps/app/src/shell/paneHost.tsx` (draws nothing until its read answers)
- [Specification](../../documentation/capabilities/conversation-panes/specifications.md) and [verification](../../documentation/verification/2026-11-19-conversation-panes.md)
