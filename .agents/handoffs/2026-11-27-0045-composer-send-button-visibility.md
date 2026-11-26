# Handoff: composer send and stop button visibility

Supersedes: none
Workspace: OUTLORE repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

In most themes the composer's send arrow and stop square were hard to see, because the button fill was too close to the field. Done when the send and stop buttons read clearly in every theme, light and dark.

## State

- Done in code: the composer's send and stop button (`sendButton` in `apps/app/src/foundation/messageStyles.ts`) fills with `colors.accent` and borders with `colors.accent`, instead of `colors.edge`. The icons (`SendArrow`, `StopSquare` in `apps/app/src/ui/composerIcons.tsx`) still use `colors.onAccent`. Verified: `file read` of the diff; `biome check` on the file exits 0; `tsc --noEmit` in `apps/app` exits 0 (both run at the time of writing).
- Not verified: the buttons have not been looked at in the running app, in any theme. Verified only by reading the code.
- Contrast figures were worked out by hand from the hex values in `apps/app/src/foundation/palettes.ts`, not measured: One dark about 5.9:1, Iskios dark about 3.5:1 (the lowest, above the 3:1 guideline for icons), the other themes 6:1 or more. Assumed until a screen check.
- Pushing: `origin/main` equalled local `main` before this commit (verified by `git rev-list --left-right --count`: 0 0), so no rebase was needed.
- Sandbox git quirk: `git` fails with "missing config value GIT_CONFIG_VALUE_0" because the environment sets `GIT_CONFIG_COUNT=5` without that value. Setting `GIT_CONFIG_VALUE_0=` on the git command (it is empty, most likely a dropped reset entry for the GitHub credential helper) fixes it. Verified: `git status`, `git fetch origin` ran after that.
- Not part of this work: the untracked file `documentation/research/provider-api-keys-2026-11-27.md` was not written by this session and is left out of the commit.

## Decisions

- The send and stop button fills with the accent, not the edge colour. `onAccent` is the text and icon colour on the accent in every palette (see `apps/app/src/foundation/palettes.ts`), and the primary buttons already pair `accent` with `onAccent` (`apps/app/src/ui/button.tsx`). The `edge` fill made the dark `onAccent` arrow in One dark almost invisible.
- The disabled state (`buttonDisabled`, 45% opacity) is unchanged.

## Next

1. Open the composer in each theme (One, Iskios, Black & white, Slate), light and dark, and check that the send arrow and the stop square read. The stop square appears while a thread runs with an empty box.
2. If the Iskios dark button still reads too faint, change only the button's fill to a lighter accent there, not the field or the icon colour.

## Open questions

- Whether the stop square should look different from the send arrow. The current change keeps them the same accent fill. The owner can decide after the screen check.

## Sources

- `apps/app/src/foundation/messageStyles.ts` (`sendButton`)
- `apps/app/src/ui/controls.tsx` (send and stop buttons, around lines 166 to 190)
- `apps/app/src/ui/composerIcons.tsx` (`StopSquare`, `SendArrow`)
- `apps/app/src/foundation/palettes.ts` (palette values for `accent`, `edge`, `onAccent`)
- `apps/app/src/foundation/onePalettes.ts`, `monoPalettes.ts`, `slatePalettes.ts` (the other themes' values)
- Commit: the commit that adds this handoff and the change (`git log --oneline -1`)
