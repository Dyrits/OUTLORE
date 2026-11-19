# Handoff: Nested corner marks in the sidebar and the errand guide's alignment

Supersedes: `2026-11-19-0038-sidebar-corner-marks.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The sidebar's quest and errand rows tell the owner what a row waits for through corner marks at the lower-left corner, sized by urgency, and the errand guide lines read as the rows' left border. Done is: the look implemented, verified, recorded, and pushed on `main`.

## State

- Implemented and committed on `main` (see the changelog entry [CHG-0530](../../documentation/changelog/0.1.12-Prototype.md), 0.1.12-Prototype, after this handoff's release): quest and errand rows nest lower-left corner marks sized 25% (the owner's turn, the row's state color, which reads grey), 50% (a summons, `stateTones.Attention`, amber) and 75% (a failed state, `stateTones.Failed`, red). One shared `corner` style in `shell/railStyles.ts`; the size is set where each mark is drawn; the largest mark is drawn first, in `shell/railRows.tsx` (`corners` prop, `RowCorner`); `cornersOf` in `shell/railQuests.tsx` builds the list. The `ring` and `turnMark` styles and the `ringColor`/`turnColor` props are gone. `shell/railStyles.ts` keeps the 1 px bottom row margin from CHG-0524. The quest-list row (`shell/questListRows.tsx`) is back to its committed look except its grey your-turn dot, which CHG-0524 carried.
- The errand guide's first level runs along the quest row's left border (`left: 1 - chevronWidth`), and the levels beneath run along the errand's border line (`left: 1`): verified by reading `shell/railQuests.tsx`.
- Verified just before the commit, 2026-11-19: `bunx biome check` clean on the three files; `bun run typecheck` exits 0; `TMPDIR=<repo>/.tmp-test CI=1 bun run test apps/app` gives 78 files, 556 passed, 6 skipped.
- Git: committed on `main` and pushed; the working tree is clean. The commit hash is in `git log` under the CHG-0530 message.
- Not verified: the look in a window or on a phone.

## Decisions

- Corner shares, the owner's words 2026-11-19: 25% for my turn (grey), 50% for a summons (amber), 75% for error (red). "Error" was read as the `Failed` state; the owner has not confirmed the reading.
- Marks live at the lower-left corner only; the earlier top-right your-turn corner was removed on the owner's words ("My turn bottom left, as well as summons").
- One `corner` style sized per mark replaces the `ring` (75/75) and `turnMark` (50/50) styles of CHG-0524, which also supersede that handoff's sizes.
- Errand indent stays in padding, so every guide level lands on the same vertical line and nested branch lines stack on one line. The owner asked for the guide to match the left border and has not answered whether the stacked lines are acceptable; the alternative (stepping lines) means moving the indent into position, a bigger change.

## Next

None in flight. If the owner wants the errand branch lines to step right again, move the errand indent from padding into horizontal position so the deeper guides sit further right.

## Open questions

- The look in a window and on a phone; the owner has not seen the nested marks or the guide alignment rendered.
- Whether "error" meant the `Failed` state, and whether the stacked branch lines are acceptable, both from the owner.

## Sources

- `apps/app/src/shell/railQuests.tsx`, `shell/railRows.tsx`, `shell/railStyles.ts` (the change)
- [Changelog 0.1.12-Prototype](../../documentation/changelog/0.1.12-Prototype.md), CHG-0530
- Superseded handoff: `.agents/handoffs/2026-11-19-0038-sidebar-corner-marks.md` (the 50/75 look, released in 0.1.11-Prototype as CHG-0524)
