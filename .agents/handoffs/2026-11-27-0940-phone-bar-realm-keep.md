# Handoff: the phone bar's remarks, with the realm's keep on the Realms tab

Supersedes: `2026-11-27-0907-phone-bar-remarks.md`
Workspace: Outlore repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The phone's bottom bar and its sheets follow the owner's remarks: crossed swords with a dot on the Quests tab, a hold of a quarter of a second, a creation row in each sheet, and top icons in the desktop's order. Done means the owner has looked at it on a phone and accepted it.

## State

- Built in CHG-0782 (`documentation/changelog/0.2.12-Pre-Alpha.md`): `apps/app/src/shell/phoneBar.tsx` (icon `swords`, `dot` when a quest is chosen, `holdMilliseconds = 250`), `phoneChoices.ts` (`creationOf`), `phoneChooser.tsx` (creation row, failure line), `narrowShell.tsx` (New realm opens `NewRealmModal`, New quest uses `useStartQuest`, New errand dispatches the quest's thread then `errandStarter`), `conversation/threadPaneHeader.tsx` (phone actions: done, archive, New quest, New errand; shared `startQuest`). Specifications updated.
- Verified now: Biome clean on `apps/app/src` and `apps/app/test`, `bunx tsc --noEmit -p .` clean, `bunx vitest run` in `apps/app`: 128 files, 1,048 passed, 6 skipped. Two new tests were shown able to fail by mutation. Record: `documentation/verification/2026-11-27-phone-quest-tab-and-sheets.md` (verdict: not proven).
- Not checked: the dot and its colour (`colors.warningText`) on a phone in each theme, the 250 ms hold, pressing each creation row, the top bar on a quest and an errand. Review ran without subagents (none available), so Standards and Specifications were read by one reader; one finding (a copy of `useStartQuest`) was refactored; a stale failure message can show when the quest sheet is reopened after a failed start (accepted, small).
- Assumed: the owner meant the dot to show once a quest is chosen (they sent a picture of crossed swords with a dot and no words).
- CHG-0783 (after the superseded handoff): the Realms tab draws the keep from `chipIcons.realm` in `apps/app/src/shell/phoneIcons.tsx`, as the desktop does; verified with Biome, the app typecheck and `bunx vitest run` in `apps/app` (1,048 passed). Not seen on a phone.
- The work is committed and pushed to `origin/main` with the owner's approval; check with `git log origin/main..main` (assumed until you check).

## Decisions

- Top icons follow the desktop pane header's set and order (the owner chose "same set and order as desktop"); recorded in CHG-0782 and the conversation-panes specifications.
- The Realms sheet also gets a creation row, New realm (the owner wrote "each menu").

## Next

1. Look at the phone: the Realms tab's keep, the dot, the hold, each creation row, the top bar on a quest and an errand; fix what shows.
2. Add a test for the phone header's order and for the bar's dot if a render seam is cheap (neither has one now).
3. Decide whether the dot should keep the warning colour in every theme.

## Open questions

- Whether the dot should mean "a quest is chosen" or something else: the owner can say after seeing it.

## Sources

- `documentation/changelog/0.2.12-Pre-Alpha.md` (CHG-0782, CHG-0783) and `documentation/verification/2026-11-27-phone-quest-tab-and-sheets.md`.
- `documentation/capabilities/conversation-panes/specifications.md` (phone bar bullets).
- `.agents/handoffs/2026-11-27-0907-phone-bar-remarks.md` and, before it, `2026-11-27-0810-companion-mention-pushed.md`.
