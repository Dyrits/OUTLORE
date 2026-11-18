# Handoff: The sidebar's creation rows removed, their icons back on the section labels

Supersedes: `2026-11-18-1621-creation-rows.md`
Workspace: OUTLORE, main checkout, branch `main` (edited in place, not in a worktree)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked to drop the full-width **Visit a new realm** and **Start a new quest** rows from the sidebar and keep only the creation icon at the right end of the **Realms** and **Borderlands** labels, shown on hover "as it was before" (CHG-0507). Done means the owner has looked at the icons in a window and on a phone.

## State

- Verified now: CHG-0507 is in the working tree and committed with this handoff (see Sources for the commit). `SectionTitle` in `apps/app/src/shell/sidebar.tsx` takes an `action` (icon, label, press) and shows it at the label row's end through `useRowActions`: on hover or keyboard focus, always on a device that cannot hover. The icons are `NewRealmIcon` (a plain plus) and `NewQuestIcon` (sword and plus), in `colors.textMuted`, with the old names as accessibility labels.
- Verified now: `Row` (`apps/app/src/shell/railRows.tsx`) lost `isButton` and `accessory`, and `railStyles.ts` lost `buttonRest`, since only the two rows used them. The empty notes of CHG-0505 stay under their labels.
- Verified now: Chronicler's guide (`packages/service/src/work/appGuideTopics.ts`), the mission-tracking specification and the `0.1.10-Prototype` changelog (CHG-0507) say the icons sit on the labels.
- Verified now: Biome clean (911 files), `bun run typecheck` passed on all workspaces, and `bun run test apps/app` passed (74 files, 534 passed, 6 skipped). Plain `bun test` in `apps/app` shows 6 failures with or without these changes; the repo's script is `bun run test` (Electron-run vitest).
- Verified now: `apps/app/src/shell/shell.tsx` carried an uncommitted change before this errand (the narrow menu screen as a row, `menuScreen` style). It is not part of CHG-0507 and was left out of its commit; its owner and intent are unknown to this thread.
- Verified now (by reading): the packaged-app launch check still waits for the text **Start a new quest** and **Realms**; **Start a new quest** now comes only from the home screen button, since the icon's name is an accessibility label.
- Assumed: the icons look right and sit well at the 284 px minimum width, in light and dark, and are visible on a phone. An Electron window cannot open in this thread's sandbox, so nothing visual is verified.
- Unresolved from the earlier handoff: the owner's "I mean the button." after CHG-0506 is moot for the sidebar rows (removed), but the home screen button still reads **Start a new quest**.

## Decisions

- The icons are muted (`colors.textMuted`), like a realm's own new-quest button, not the highlight color the old rows used. Chosen to match "as it was before" and the realm rows; recorded in CHG-0507 only as "like a realm's buttons".
- The two buttons keep their full names as accessibility labels so the home screen, realm window title and guide stay consistent (CHG-0507).
- CHG-0503 to CHG-0506 stay in the changelog as history; CHG-0507 supersedes the rows they built, and the specification says so.

## Next

1. Ask the owner to look at the section labels in a window (light and dark: icon hidden at rest, shown on hover and on keyboard focus, no layout shift, press opens the realm window or a new quest) and on a phone (icons always shown).
2. Ask whether the unrelated `apps/app/src/shell/shell.tsx` change in the working tree is theirs to commit or discard; do not commit it blindly.
3. Run the packaged-app launch check when next packaging.
4. Optional: two historical records still say **Start a quest** (`documentation/verification/2026-11-18-dictation/drive.ts`, which finds the button by that text, and `documentation/verification/2026-11-18-sidebar-creation.md`); the script cannot find a button under that name any more.

## Open questions

- Does the muted icon read well enough as the only way to create a realm or a quest from the sidebar? Only the owner's look answers it.
- Should the home screen button keep **Start a new quest**? The owner has not said.

## Sources

- The change: `apps/app/src/shell/sidebar.tsx` (`SectionTitle`), `apps/app/src/shell/railRows.tsx`, `apps/app/src/shell/railStyles.ts`, `apps/app/src/shell/railActions.tsx` (`useRowActions`, the icons), `packages/service/src/work/appGuideTopics.ts`.
- The changelog: `documentation/changelog/0.1.10-Prototype.md`, CHG-0507.
- The living spec: `documentation/capabilities/mission-tracking/specifications.md#simplified-left-navigation`.
- The working state: `documentation/work-in-progress.md`.
- The previous handoff: `.agents/handoffs/2026-11-18-1621-creation-rows.md`.
- The commit: the one on `main` that adds this file (`git log --oneline -3`).
