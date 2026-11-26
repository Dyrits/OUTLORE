# Handoff: pane titles lead to the parent tab, and the pane headers line up

Supersedes: none (forked from `2026-11-27-0010-phone-growing-bar.md`)
Workspace: OUTLORE repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

In the pane layout, clicking a quest's title opens the realm's Quests tab and clicking an errand's title opens its quest's Errands tab, instead of opening a select of siblings; and a quest pane's header and tab row sit at the same height and padding as the channel pane's. Done means the owner has reloaded the app and accepted both.

## State

- Built (CHG not assigned): `conversation/threadTitle.tsx` takes an optional `onShowParent`; with it a quest's or errand's title is a button (label "<title>, show Quests" or "show Errands") instead of the `Menu`. It travels `paneHost.tsx` (`onOpenList={openList}`) → `threadSlot.tsx` (parent is `channelId` for a quest pane, `questId` for an errand pane) → `paneThread.tsx` → `threadPane.tsx` → `threadPaneHeader.tsx` → `ThreadTitle`. `openList` is the call the notches beside the panes make.
- Alignment: `ChatterNotices` (`threadActions.tsx`) returns null when it has nothing, which removed an empty box that added about 12 px between header and tabs; thread panes use the channel pane's padding (16 sides, 12 top, 14 bottom) and 8 px gap (`paneThread.tsx`, `threadPane.tsx`); the title icon sits in a 26 by 26 box with a 12 px gap (`threadTitle.tsx`).
- `documentation/capabilities/conversation-panes/specifications.md` describes the pane title and the narrow header's switchers separately (owner, 2026-11-27). No changelog entry was written.
- Verified this session, after the last edit: `bun run typecheck` in `apps/app` passes; `bunx biome check` is clean on the changed files; `CI=1 bun run test apps/app` passes 126 files, 1,027 tests (6 skipped).
- Not checked: any screen. The owner's screenshot still showed the old `⌄` on a quest title, probably from a build before the change; neither the click targets nor the alignment were seen after it.
- The commit made with this handoff also holds the whole phone growing-bar batch of `2026-11-27-0010-phone-growing-bar.md`, which was uncommitted and mixed into the same files; the owner asked for everything to be committed and pushed. That batch is still not accepted on a phone.

## Decisions

- A Ritual's pane title keeps its select, since its parent tab is Rituals, not Quests (my reading; not asked).
- The narrow header (the phone's full-screen quest and errand, which pass no `onShowParent`) keeps the select. Its destinations there are navigation events (`channel` with `shouldShowQuests`, `quest` with `shouldShowErrands`), not pane lists.
- If an errand's quest pane is not open, or the channel pane is not in the chain, the title press does nothing visible, as the notches would. It does not reveal a folded pane (my choice, to mirror the notches).

## Next

1. Reload the app and look at a quest pane beside a channel pane: titles, tab rows, and both title clicks (quest to the realm's Quests tab, errand to its quest's Errands tab).
2. Decide with the owner whether the phone's full-screen titles should lead to the Quests and Errands views too, and whether a Ritual title should lead to the Rituals tab.
3. Continue the phone work from `2026-11-27-0010-phone-growing-bar.md`, Next.

## Open questions

- Phone titles and Ritual titles: see Next 2; the owner answers.
- Whether the title needs a visible cue that it is pressable (it is plain text now); the owner answers.

## Sources

- `apps/app/src/conversation/threadTitle.tsx`, `threadPaneHeader.tsx`, `threadPane.tsx`, `paneThread.tsx`, `threadActions.tsx`
- `apps/app/src/shell/threadSlot.tsx`, `paneHost.tsx`, `paneNotches.ts`, `paneSession.ts` (the `list` action)
- `documentation/capabilities/conversation-panes/specifications.md`
- `.agents/handoffs/2026-11-27-0010-phone-growing-bar.md`
