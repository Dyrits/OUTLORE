# Handoff: keep the realm's channel pane open when a quest opens

Supersedes: none
Workspace: OUTLORE repository (/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS), branch `main`, based on `2abdd0a0`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked (2026-11-24): "When opening an existing or a new quest while the panel real is already open should not close it." Done means the desktop window no longer folds a realm's channel pane that was already open when a quest, existing or new, opens.

## State

- CHG-0678 is committed on `main` and pushed to `origin/main` (no rebase was needed: `origin/main` had not moved from `2abdd0a0`). Verified by `git status` and `git log HEAD..origin/main` before the commit.
- Code: `openedQuestMemory(channel, weights, isChannelOpen = false)` in `apps/app/src/shell/paneChain.ts` leaves the channel unfolded when told it was open. `AppScreenContent` in `apps/app/src/shell/appScreen.tsx` keeps a ref of whether the channel is open: true on the Channel screen with no quest, false on another place with no quest, unchanged under the Workshop, and updated by `PaneHost` through `onChannelOpen`, which `usePaneChain` calls whenever the channel's fold changes. The next `PaneHost` (remounted per quest by its key) starts from that ref.
- Verified now in the session: 185 tests in `apps/app/test/shell` pass (two new ones in `paneChain.test.ts`), Biome is clean on `apps/app/src/shell` and `apps/app/test/shell`, and the seven workspace typechecks pass.
- Documentation: CHG-0678 in `documentation/changelog/0.2.4-Pre-Alpha.md`; one sentence added to the first bullet about sidebar-opened quests in `documentation/capabilities/conversation-panes/specifications.md`.
- Assumed, not checked: the behavior in the running desktop app, and the full suite.
- The ref is updated in an effect and read during the next `PaneHost`'s first render; that ordering was reasoned through, not exercised in a window.

## Decisions

- "Panel real" was read as the realm's channel pane (the owner's wording was unclear). It is the pane CHG-0613 folded on every quest open. This reading was stated to the owner and not yet confirmed.
- A channel that was folded, or a quest opened from a place other than the Channel screen (Archive, a realm's quest list, Home), still opens folded, as CHG-0613 agreed on 2026-11-21.
- The channel is not marked "shown", so a narrow window still squeezes it before the quest.

## Next

1. Ask the owner to check, in a desktop window: open a realm's channel, open a quest from its Quests tab and from the sidebar, start a new quest there, and press the channel's notch beside one quest then open another quest. The channel should stay open each time.
2. If the owner meant the right-hand details column instead, that is a separate change: `documentation/capabilities/thread-panel/specifications.md` (section "Panel ownership across navigation", agreed 2026-11-13) closes it on every navigation through `panelAt` in `apps/app/src/foundation/panelState.ts`.

## Open questions

- Did the owner mean the realm's channel pane or the right-hand details column? The owner can answer.
- Should a channel opened from the Chronicle or a realm list also stay open? Unspecified; the current rule keeps only the cases above.

## Sources

- `apps/app/src/shell/paneChain.ts`, `usePaneChain.ts`, `paneHost.tsx`, `appScreen.tsx`
- `apps/app/test/shell/paneChain.test.ts`
- `documentation/changelog/0.2.4-Pre-Alpha.md` (CHG-0678)
- `documentation/capabilities/conversation-panes/specifications.md`
- Earlier agreement: commit `849774e7` (CHG-0613)
