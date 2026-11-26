# Handoff: a quest's pane opens on the tab the last quest showed

Supersedes: none
Workspace: Outlore repository, branch `main` (base `0695b71f`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

On the desktop, switching from one quest to another from the realm's Quests tab should keep the quest pane on the tab the owner was on (for example Errands), so the errands of each quest can be browsed without choosing the tab again. Done when the owner has seen it in the desktop window.

## State

- Built (CHG-0774, `0.2.10-Pre-Alpha`): `QuestTabMemory` ref in `apps/app/src/shell/appScreen.tsx`, passed through `paneHost.tsx` and `threadSlot.tsx` to quest panes only; `paneThread.tsx` starts on `initialQuestTabOf` (`apps/app/src/conversation/questTabMemory.ts`) and keeps the ref current. Verified now: new test `apps/app/test/conversation/questTabMemory.test.ts` failed before the module existed and passes; `bun run typecheck` clean; `bunx biome check` clean on the touched folders; `CI=1 bun run test apps/app` 127 files, 1,030 passed, 6 skipped.
- Cause of the old behavior (verified by reading): panes remount for each quest, and the quest pane's tab was local state starting on Missives; the channel pane already had `ChannelTabMemory`.
- Spec line in `documentation/capabilities/conversation-panes/specifications.md` amended; changelog entry CHG-0774.
- Not checked: the desktop window (the app has only static-render tests, so the remount-and-remember wiring has no test seam; only the pure rule is tested). Self-review of the diff found no standards or specification issues.

## Decisions

- The memory spans Missives, Quest, Errands and Companions, lasts the session, and is not saved across launches (builder's default).
- A list request from a notch or the sidebar still opens Errands; a quest opened from a Chronicle message lands on Missives; errand panes keep their own tabs.
- The phone (`Conversation`, `narrowAppScreen.tsx`) is unchanged; recorded in CHG-0774.

## Next

1. Open the desktop window: put quest A on Errands, pick quest B from the realm's Quests tab, and check B opens on Errands; also check Missives, Quest and Companions stick, and a Chronicle message still opens on Missives.
2. Ask the owner whether the phone needs the same.

## Open questions

Whether the tab should also be remembered across launches, and whether the phone needs it: the owner.

## Sources

- `documentation/changelog/0.2.10-Pre-Alpha.md` (CHG-0774)
- `documentation/capabilities/conversation-panes/specifications.md`
- `apps/app/src/conversation/questTabMemory.ts`, `apps/app/src/conversation/paneThread.tsx`, `apps/app/src/shell/appScreen.tsx`
