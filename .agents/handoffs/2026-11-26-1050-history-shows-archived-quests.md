# Handoff: The History tab shows archived quests

Supersedes: none
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The History tab of a realm's channel lets the owner show or hide the realm's archived quests.
Done means the owner has seen the switch work in the desktop window and on the phone.

## State

- **Built (verified: read the diff of `46e0166d`):** `ChannelHistory` (`apps/app/src/shell/channelHistory.tsx`) has a "Show archived quests" `ToggleRow`, off by default, held in component state; `historyQuestsOf` (`questRecency.ts`) picks the active quests plus, when shown, the archived ones of the realm (or the Borderlands); `archivedMissions` (`apps/app/src/foundation/queries.ts`) is the shared archived `ListMissions` query; `QuestTreeLines` and `QuestLine` (`questListRows.tsx`) take `isArchived`, which prefixes the meta text with "Archived · " and hides the archive button.
- **Checks (verified: run this session):** `CI=1 bun run test apps/app/test/shell/questTree.test.ts` passed 26 tests (two new for `historyQuestsOf`); Biome clean; `bun run typecheck` in `apps/app` passed; the pre-commit hook passed all seven workspace typechecks and 75 related tests.
- **Recorded as CHG-0756** in `documentation/changelog/0.2.10-Pre-Alpha.md` (a new file, since `0.2.9-Pre-Alpha` is tagged).
- **Assumed:** the switch and the Archived lines in a running desktop window and on the phone; the History tab has no drawing test.
- **Pushed:** see `git log origin/main` for whether `46e0166d` and the handoff commit reached origin.

## Decisions

- **The switch is local to the tab, not an owner setting:** the owner asked only that the tab allow showing or hiding archived quests (2026-11-26); a persisted setting would be a small follow-up (CHG-0756).
- **Archived quests are fetched always and merged on demand:** `useServiceQuery` has no way to skip a query, and the archived list is small.

## Next

1. Open the desktop window, open a realm's History tab, switch "Show archived quests" on and off, and press an archived quest to check it opens.
2. Decide whether the switch should persist as an owner setting like `shouldShowFinishedQuests`; if so, add it to `packages/contracts/src/settings.ts` and the settings screen.
3. Add the outcome to `documentation/work-in-progress.md` once the owner accepts.

## Open questions

- Should an archived quest's line offer Reopen (`ReopenMission` exists)? The owner has not asked for it.

## Sources

- `documentation/changelog/0.2.10-Pre-Alpha.md` (CHG-0756)
- `documentation/changelog/0.2.5-Pre-Alpha.md` (CHG-0686, the History tab)
- `apps/app/src/shell/channelHistory.tsx`, `questRecency.ts`, `questListRows.tsx`
- `apps/app/src/shell/archivePage.tsx` (the Archived view)
