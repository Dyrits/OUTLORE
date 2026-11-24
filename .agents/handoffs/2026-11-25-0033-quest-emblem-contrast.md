# Handoff: quest emblem contrast on card corner buttons

Supersedes: none
Workspace: OUTLORE repository (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Make the quest emblem (a sword) visible on the small corner button of conversation cards, such as the Missives cards, in every theme. Done when the owner sees the sword in the running app's dark looks.

## State

- Cause: `QuestButton` in `apps/app/src/conversation/conversationEntries.tsx` draws the sword in `colors.highlight` on `colors.cornerButton` (style `cardCornerButton` in `apps/app/src/foundation/styles.ts`). In the dark looks of all four themes, both colors were the same or nearly the same pale grey (contrast 1.0 to 1.37). Verified by reading the palettes and by the new test failing on exactly those four looks.
- Fix, commit `a603f72b` (CHG-0715): the dark `cornerButton` is now each theme's `controlActive` value. iskios is `#2b3d55` (`palettes.ts`), mono `#333333`, one `#454a56`, and slate `#2e3340`. Light looks are unchanged. Verified: pre-commit hook passed (Biome, workspace typecheck, 99 affected tests).
- Guard: `apps/app/test/foundation/palettes.test.ts` requires `highlight` on `cornerButton` at least 3:1 in every theme and look, iskios included. Verified passing.
- Not verified: how it looks in the running app. Nobody has looked at it on screen.
- Left alone: `apps/app/src/shell/paneNotches.ts` and `apps/app/src/shell/paneStrip.tsx` were modified in the working tree by another session before this work began. `documentation/research/illustrate-p2p-direct-path.html` is untracked. Neither is part of this change.

## Decisions

- Change the button fill, not `highlight`. `highlight` also colors headings and other icons, and no single existing token contrasts with a pale button in dark looks and a pale button in light looks at once. Recorded in CHG-0715 (`documentation/changelog/0.2.6-Pre-Alpha.md`).
- The Iskios dark look changed too, although the palette test keeps Iskios's original colors exempt from the newer text thresholds. It was the theme in the owner's screenshot, so the fix had to reach it.

## Next

1. Ask the owner to open a quest's Missives cards in a dark look and confirm the sword shows and the button reads as a button against the card.
2. If the button is too faint against the owner's message bubble (iskios `bubbleUser` `#24384f` is close to `#2b3d55`), choose a stronger fill, such as `borderStrong`. Keep the palette test green.

## Open questions

- Is the darker button acceptable to the owner, or did they want the pale button kept with a dark sword? Only the owner can answer.

## Sources

- Commit `a603f72b`, CHG-0715 in `documentation/changelog/0.2.6-Pre-Alpha.md`
- `apps/app/src/foundation/palettes.ts`, `monoPalettes.ts`, `onePalettes.ts`, `slatePalettes.ts`
- `apps/app/test/foundation/palettes.test.ts`
- `apps/app/src/conversation/conversationEntries.tsx` (`QuestButton`)
