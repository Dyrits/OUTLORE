# Handoff: History tab in the realm's channel

Supersedes: none
Workspace: OUTLORE repository, branch `mission/history-tab-in-realm-panel-b2bacecf`, rebased onto `origin/main` at `26d99ec7`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked (2026-11-24) that the realm's quest-list page not exist any more and be a "History" tab of the realm panel, and that the eye icon go since the realm name opens the channel. Done means the History tab works in the running desktop app and on the phone, and the change is on `origin/main`.

## State

- The page (`QuestListScreen`), the eye button (`OverviewButton`), the `RealmQuests` place, the `realm` navigation event, `openRealm` and `onOpenRealmQuests` are removed. Assumed from the commit diff; the rebase conflict in `paneHost.tsx` was resolved by hand.
- `apps/app/src/shell/channelHistory.tsx` (renamed from `questListPage.tsx`) renders the History tab in `channelPane.tsx`: the recency-grouped, foldable quest and errand tree. Desktop and Borderlands rows too; the phone row puts it before Realm.
- Archive realm stays in the Realm tab (`questPanel.tsx`).
- Archiving a quest returns to the realm channel on Missives, not History. Decision not made; see Open questions.
- Changelog entry is CHG-0686 in `documentation/changelog/0.2.5-Pre-Alpha.md` (renumbered from CHG-0681 during the rebase; 0.2.4 is released).
- Before the rebase: `bun run test apps/app/test/shell` passed 184 tests, Biome had no errors, and the workspace typecheck passed. Recorded by the earlier thread, not re-run after the rebase except by the pre-commit hook, which accepted the rebased commit.
- No test draws the History tab; the running app and the phone were not checked.

## Decisions

- "Realm panel" is the realm's tabbed channel pane, and "sidebar" is the quest-list page (owner's request, confirmed by the code).
- The page's side column (RealmPanel) is not kept; it is reachable through the Realm tab.
- The History tab's quest tree nests errands as the sidebar does (assumption the owner may overrule; recorded in the mission-tracking specification).

## Next

1. Run the desktop app and the phone and check the History tab: grouping, folding, opening a quest and an errand, archiving a quest.
2. Decide whether archiving a quest should land on History (needs one more `listRequest` variant).
3. Add a test that draws the History tab if the owner wants one.

## Open questions

- Should archiving a quest return to the History tab? The owner decides.

## Sources

- `apps/app/src/shell/channelHistory.tsx`, `apps/app/src/shell/channelPane.tsx`, `apps/app/src/shell/paneHost.tsx`
- `documentation/changelog/0.2.5-Pre-Alpha.md` (CHG-0686)
- `documentation/capabilities/conversation-panes/specifications.md`, `documentation/capabilities/mission-tracking/specifications.md`
- Backup of the pre-rebase tip: ref `refs/rebase-backup/history-tab` (788a7f9a)
