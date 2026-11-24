# Handoff: icons of the Quests and Errands list controls

Supersedes: none
Workspace: OUTLORE repository (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Give the two "list" controls on the edge of a pane icons that say what they list and match the "New quest" and "New errand" controls above them. Done when the owner sees both in the running app and accepts them.

## State

- The list control is a `NotchPart` of kind `"list"`, built in `childPartsOf` (`apps/app/src/shell/paneNotches.ts`) and drawn in `PaneNotches` (`apps/app/src/shell/paneStrip.tsx`). It lists the quests of a realm ("Quests") or the errands of a quest ("Errands"). It used one plain list icon for both.
- Change, commit `6fda4b14` (CHG-0716, `documentation/changelog/0.2.6-Pre-Alpha.md`): `NotchPart` has a new optional field `listOf: "quest" | "errand"`, set by `childPartsOf`. `QuestsMark` draws two crossed swords (24 grid, stroke 1.7, the quest sword's squared tip, the second sword passing behind the first). `ErrandsMark` draws a vertical line with three branches curving up to the right (20 grid, stroke 1.6). The old `ListMark` and an earlier list-in-the-corner variant are gone.
- Verified: pre-commit hook on that commit passed (Biome, workspace typecheck, 22 affected tests); the notch and Ritual tests (201) passed; about a dozen variants and the final pair were rendered in Electron at notch size and next to their "New" neighbours with the status dot, and nothing overlapped (renders were in `/tmp/claude-501/icons/`, not kept).
- Not verified: how it looks in the running app. Nobody has looked at it on screen. At 16px the errand icon may read as a letter "E".
- Left alone: `documentation/research/illustrate-p2p-direct-path.html` is untracked and not part of this work.

## Decisions

- The quest icon is crossed swords, not the quest sword with a list in its corner. The "New quest" icon (`NewQuestIcon`, `apps/app/src/shell/railActions.tsx`) has its plus drawn inside the sword's opening, so there is no corner to swap. The owner proposed crossed swords. Recorded in CHG-0716.
- The errand icon is a line with three branches and no plus, as the owner proposed. Recorded in CHG-0716.
- The second sword is a hand-drawn partial path, not a mirror of the first: mirroring it whole made the two tips run together into a "W" at 16px.

## Next

1. Ask the owner to look at a realm's Quests control and a quest's Errands control in the running app, in a light and a dark look, and say whether both read clearly.
2. If the errand icon reads as an "E", try a tree with branches on both sides (variant E8 in the comparison); the drawing is the one `d` string in `ErrandsMark`. Keep `paneNotches.test.ts` green.
3. If the swords look crowded, enlarge the notch glyph size only for this icon or simplify to two plain crossed blades.

## Open questions

- Does the owner accept the three-branch errand icon, or does it look too much like an "E"? Only the owner can answer.

## Sources

- Commit `6fda4b14`, CHG-0716 in `documentation/changelog/0.2.6-Pre-Alpha.md`
- `apps/app/src/shell/paneStrip.tsx` (`QuestsMark`, `ErrandsMark`), `apps/app/src/shell/paneNotches.ts` (`childPartsOf`)
- `apps/app/src/foundation/emblems.tsx` (the sword's paths), `apps/app/src/shell/railActions.tsx` (`NewQuestIcon`)
- `apps/app/test/shell/paneNotches.test.ts`
