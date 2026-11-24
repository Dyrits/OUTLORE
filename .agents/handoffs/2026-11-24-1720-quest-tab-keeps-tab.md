# Handoff: the realm pane keeps its tab when another quest opens

Supersedes: none (forked from `2026-11-24-0729-keep-channel-open.md`)
Workspace: OUTLORE repository, branch `main`, based on `673af434`

To resume: read this whole file first.
Treat every claim in State not marked verified as unverified, and check it against the Sources.
Read the superseded handoff only when something here cannot be resolved from this file and its Sources.
Confirm what was in flight and what you will do next with the user before starting.
Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked (2026-11-24) to switch quest from the realm pane's Quests tab without the pane going back to Missives, as the Errands tab of a quest panel already stays.
Done means the channel pane opened beside the next quest starts on the tab it last showed, for the same realm.

## State

- Cause: `PaneHost` is keyed by quest and its open count in `apps/app/src/shell/appScreen.tsx`, so every quest switch remounts the channel pane, and its tab state started again on Missives.
  The Errands tab survives because a quest's own threads do not change that key.
- Fix (CHG-0700): `AppScreenContent` keeps a `ChannelTabMemory` ref and passes it as `tabMemory` to `PaneHost`, `StandaloneChannel`, and the narrow `ChannelPane`.
  `ChannelBody` in `apps/app/src/shell/channelPane.tsx` starts on the remembered tab when the remembered channel id is the same, and writes the tab back on every change.
  A `listRequest` still forces Quests; a different realm opens on Missives.
- Verified now: Biome and workspace typecheck pass via the pre-commit hook on `673af434`.
- Assumed, not checked: the behavior in a running desktop window, and the full test suite.
  No test covers `ChannelBody`.

## Decisions

- The memory is a ref held by the screen, not module state: it follows the window and is replaced with it.
  It is the same mechanism as the open-channel ref of CHG-0678 (see the superseded handoff).
- A remembered tab applies only to the same channel id, so a quest in another realm opens on Missives, as `ChannelBody`'s comment already agreed.

## Next

1. Ask the owner to check in a desktop window: open a realm's Quests tab, open a quest from it, then another quest from the same tab.
   The channel pane should stay on Quests.
   Then open a quest of another realm: it should open on Missives.
2. If it holds, nothing else is planned.

## Open questions

- Should History, Realm, and Companions be remembered too?
  They are, because the whole tab is remembered.
  The owner can say if only Quests should be.

## Sources

- `apps/app/src/shell/appScreen.tsx`, `paneHost.tsx`, `channelPane.tsx`
- `documentation/changelog/0.2.5-Pre-Alpha.md` (CHG-0700)
- `.agents/handoffs/2026-11-24-0729-keep-channel-open.md`
