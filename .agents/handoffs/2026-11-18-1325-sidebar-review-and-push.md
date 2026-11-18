# Handoff: Simpler sidebar, reviewed and ready to push

Supersedes: [2026-11-18-0940-sidebar-batch-4.md](2026-11-18-0940-sidebar-batch-4.md)
Workspace: OUTLORE, main checkout, branch `main` (the work was built in `.worktrees/sidebar` and `.worktrees/sidebar-creation`, both merged)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Ship the simpler sidebar (CHG-0449 and the owner's follow-ups up to CHG-0498): all of it is on local `main`; done means the owner has looked at it in a window and on a phone and `main` is pushed.

## State

- Verified now (run in this session): `bun run check`, `bun run typecheck` on all seven workspaces and `CI=1 bun run test` (2,061 passed, 54 skipped) pass on the tree that carries the review and refactor.
- Local `main` is 55 commits ahead of `origin/main` (`ffb370e`) before this commit (verified with `git log origin/main..main`). Whether it is pushed depends on the push step below; check `git status -sb`.
- The last commit adds the review and refactor (CHG-0498): the phone header moved to `apps/app/src/conversation/mobileHeader.tsx`; in `apps/app/src/shell/sidebar.tsx` `Spending` became `SidebarFoot`, a `Section` type names the two folding sections, `realmRow` takes the outline's shape; stale comments and the mission-tracking specification were corrected and now record the touch rules of CHG-0497. No behavior change intended.
- Not checked by anyone: the sidebar and phone header in a window or on a phone (light and dark, narrow widths), touch behavior (always-visible realm actions, 40 px rows, usage-ring tap), a real drag of a realm to reorder, the packaged-app check, the unfinished "Reserves" section layout inside the Workshop page.
- The owner asked why the quest panel's icon seems missing on a phone: it shows only while a quest is open in a narrow window, as before CHG-0496; unresolved if it is missing with a quest open (needs a screenshot).
- Another worktree, `bang-worktree` (`worktree/bang-worktree`, built on `worktree/own-copy`), also used CHG-0455 in `0.1.7-Prototype.md`; whichever merges second renumbers.

## Decisions

- Sections: **Realms** and **Borderlands** are folding labels, each with its action row directly under it (**Visit a realm**, **Start a quest**), the rest below; one list of realms, folder icon only marks folder-backed ones (CHG-0472 to CHG-0480).
- The foot of the sidebar is: separator, usage rings, separator, one **Workshop** row (gear). Reserves and the former Charter (Remote access) are sections of the Workshop. Rituals, Lore and Archive have no sidebar entry for now (the owner wants no menu).
- Phone: the sidebar is a full screen; a quest header has a back chevron, centered title with state dot, and the plain archive icon (no bubbles; CHG-0491 to CHG-0495). Chronicler is only the ✦ mark at the far right of the top bar (CHG-0496).
- Touch: no hover on a device that cannot hover, so hover-only marks always show; a quest moves by the quest panel's **Realm** row (CHG-0497, CHG-0458, the Realm row is my choice and unconfirmed).
- Realm order is saved (`ReorderRealms`), dragging needs the web build.
- Recorded in `documentation/capabilities/mission-tracking/specifications.md#simplified-left-navigation` and the changelog `0.1.8-Prototype.md`.

## Next

1. Confirm the push of `main` with the owner if it has not happened (the pre-push hook refuses protected-branch pushes; an agent needs the owner's approval before bypassing it).
2. Ask the owner to look at the sidebar and the phone header, in a window and on a phone, and to answer the open questions.
3. Decide where Rituals, Lore and Archive (restore) get an entry again.
4. Optionally remove unused leftovers: the service's `ReadGuildHallRecap` and `VisitGuildHall`; the app's `chroniclerRealm` and `guildmasterRealm`; identifiers named `borderlands`; split `requests.ts` (718 lines, over the 512 hard limit) and other files over 256 lines.

## Open questions

- Whether the quest panel's icon is missing on a phone with a quest open (owner's screenshot needed).
- Realm reordering is impossible on a phone: acceptable, or needs a touch gesture?
- Whether the fold state should be remembered across restarts (it is not).

## Sources

- `documentation/changelog/0.1.8-Prototype.md`, CHG-0449 to CHG-0498.
- `documentation/capabilities/mission-tracking/specifications.md#simplified-left-navigation`.
- `documentation/work-in-progress.md`, Simpler app.
- `apps/app/src/shell/sidebar.tsx`, `apps/app/src/conversation/mobileHeader.tsx`.
