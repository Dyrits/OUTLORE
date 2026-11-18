# Handoff: The summons and the owner's turn get corner marks; the teal dot goes

Supersedes: `2026-11-18-2105-summons-your-turn-errand-archive.md`
Workspace: OUTLORE, branch `main`, the main checkout; committed as CHG-0524 (the commit that adds this file), not pushed

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner found the teal "your turn" dot confusing and asked for the summons' treatment instead: a mark on the row, in its color, and the dot kept grey. Done means the owner has looked at the sidebar in a window and on a phone and accepted or redirected the marks.

## State

Built and committed as CHG-0524 (see [0.1.11-Prototype](../../documentation/changelog/0.1.11-Prototype.md)); the changes are in `apps/app/src/shell/` and `apps/app/src/foundation/`:

- Teal is gone: `yourTurnColor` and the teal key in the four palettes (`palettes.ts`, `onePalettes.ts`) are removed. Verified: `grep` finds no `teal` or `yourTurnColor` in `apps/app`.
- Every quest and errand dot is its state's color, including a quest or errand whose turn ended (the grey of Resting). Verified by reading `railRows.tsx` and `questListRows.tsx`.
- A quest or errand waiting for the owner (`isYourTurn`, the service field from CHG-0513) gets a grey mark in its lower-left corner: a bottom and left border, 50% of the row's width and height, rounded at the corner (`turnMark` in `railStyles.ts`, drawn by `Row` in `railRows.tsx`, colored by `turnOf` in `railQuests.tsx`). Sidebar rows only; the quest list has none.
- A summons (`Attention`) gets its amber mark in the same corner: bottom edge for 75% of the width, left edge for 75% of the height, rounded (`ring` in `railStyles.ts`). It replaces the full 1 px ring of CHG-0512.
- Sidebar rows (`rowQuest`) have a 1 px bottom margin, so a mark does not touch the row below. This also adds 1 px under the sidebar's Settings row, which uses the same `Row`.
- The quest list (`questListRows.tsx`) keeps a grey dot and no mark; its lines have no border changes.
- Checks run this session, after the last edit: Biome clean on the changed shell and foundation files; `tsc -p apps/app --noEmit` exits 0; `CI=1 vitest run apps/app/test` passes (75 files, 550 tests passed, 6 skipped). Verified by command output.
- Not seen in a window or on a phone. The overlays are absolute views drawn over the row, so the hover and selected backgrounds and the archive button at the row's end have not been looked at with a mark showing.
- The commit adds this file, the changelog entry, the `AGENTS.md` pointer, and the work-in-progress entry. The push is not done: `main` is protected by `.githooks/pre-push`, which refuses it; see Open questions.

The `isYourTurn` field stays in `packages/contracts` and the service. The app reads it only for the your-turn mark; the quest list no longer reads it.

## Decisions

- Teal is removed, not kept unused. Reason: the owner's request; the palette keys had no other use. Recorded in CHG-0524.
- The summons mark and the your-turn mark share the lower-left corner, so a row shows one of them at a time. Both states are exclusive in the data: `isYourTurn` requires a rested state, and a summons is `Attention`.
- The your-turn mark is 50% and the summons mark 75%, as the owner asked. The your-turn mark moved to the bottom-left corner and the top-right corner was dropped, on the agent's reading of "My turn bottom left, as well as summons"; the owner did not confirm dropping it. Recorded in the owner's chat, not in a file.
- The overlays are views, not borders, because React Native cannot draw a border over part of a side. Reason: the owner asked for partial sides. The corner radius is `radii.md`, which sits 1 px inside the row's transparent outline.
- The 1 px bottom margin is on every sidebar row, not only the marked ones, so spacing does not change when a mark appears. Reason: the owner's request for a gap between quests.

## Next

1. Ask the owner to decide the push (see Open questions). Do not bypass the pre-push guard without that answer.
2. Ask the owner to look at the sidebar in a window and on a phone: the summons mark, the grey your-turn mark, the 1 px gap, a row with an archive button under the pointer, and a selected row.
3. If the owner redirects the mark, change `railStyles.ts` (`ring`, `turnMark`) and `railRows.tsx`, then record the change in a new changelog entry (CHG-0525 or the next free number).
4. The terminal snapshot the owner keeps pasting shows a `SectionTitle` error at `apps/app/src/shell/sidebar.tsx:271` with its first lines cut off. Ask for the top lines before assuming it is or is not related; this work does not touch `sidebar.tsx`.

## Open questions

- Push: `main` is refused by the pre-push guard (`.githooks/pre-push`, `PROTECTED_BRANCHES="main master"`). Only the owner can approve a bypass, with `git push --no-verify`; an agent must get that approval first. Options: push to `main` with `--no-verify`, or push a branch for review and merge later. Answer from the owner.
- Whether the marks look right in a window and on a phone. Answer from the owner.
- Whether the quest list's lines should carry the your-turn mark too. Answer from the owner.
- What the `SectionTitle` error in the owner's terminal snapshot says (see Next, item 4). Answer from the owner, from the top lines of the error.

## Sources

- `documentation/changelog/0.1.11-Prototype.md`, CHG-0524 (this work); CHG-0512 and CHG-0513 in `documentation/changelog/0.1.10-Prototype.md` (the summons ring and the teal dot it replaces)
- `apps/app/src/shell/railRows.tsx`, `apps/app/src/shell/railQuests.tsx`, `apps/app/src/shell/railStyles.ts`, `apps/app/src/shell/questListRows.tsx`
- `apps/app/src/foundation/theme.ts`, `apps/app/src/foundation/palettes.ts`, `apps/app/src/foundation/onePalettes.ts`
- `.githooks/pre-push` (protected branches)
- `.agents/handoffs/2026-11-18-2105-summons-your-turn-errand-archive.md` (superseded)
