# Handoff: The phone's floating pill shell

Supersedes: 2026-11-26-1130-mobile-shell-options.md
Workspace: outlore (repository root, branch `mission/mobile-ui-redesign-options-dbb76422`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner chose direction E of the phone shell page: a floating pill of three tabs (Chronicle, Quests, Chronicler) over full-screen tabs, a Menu button in the top bar for the other places, the conversation's composer in place of the pill in a quest, and a pill that shrinks to a circle while scrolling down.
Done means the owner has used it on a phone and accepted it.

## State

- **Built (verified: typecheck, Biome, `apps/app/test/shell`):** `narrowShell.tsx` (the phone frame), `phoneShell.ts` (pure rules: cover, bottom, lit tab, title, Back, scroll collapse), `phonePill.tsx`, `phoneIcons.tsx`, `menuScreen.tsx`, `pillScroll.ts` (context a scrolling screen reads to clear the pill and report its scroll), `topBar.tsx` (`NarrowTopBar` rewritten), `sidebar.tsx` (narrow = the Quests tab: no Chronicle row, no foot), `location.ts` (`isQuestsOpen` is the old `isMenuOpen`; a new `isMenuOpen` is the Menu; `quests` event; `QuestOrigin` gains `chronicler`), `appScreen.tsx` (Home is the Chronicle on a phone; Lore and Settings go back to the Menu).
- **Window check (verified: run this session, not committed):** web export of `apps/app`, the real service from `packages/service` on isolated data with the fake harness (bun-built, run on Electron's Node; the port was patched in a temporary copy of `main.ts`), `window.outlore` shimmed, headless Chrome driven over CDP at 390 by 844. Screens seen: the three tabs, the Menu, Archive, Reserves, Settings, Lore, a quest with no pill, Back to the Quests tab; the pill measured 366, 56, 366 points over a scroll down and up; five theme and look pairs; wide window unchanged. The temporary files were deleted.
- **Not checked:** a real phone, Android gesture and three-button bars (the pill's gap is a fixed 24 on a phone), blur on a phone (none outside browsers), Safari, a long Chronicler thread with the keyboard open, the Ritual form on a phone.
- **Pushed:** nothing.

## Decisions

- **No Rituals or Realms tile in the Menu:** a Ritual is not a place (CHG-0616) and the Quests tab already holds realms and their Rituals.
- **The pill stays on the Chronicler tab** with the chat's own composer above it; the pill is absent only in a quest or errand, under the quest panel, and under the Ritual form.
- **Conversation Back stays in its header;** no Back button was added to the composer.
- **No new dependency:** no blur (browsers get `backdrop-filter`), no `Animated`, no safe-area package; the width change is the browser's CSS transition and snaps on a phone.
- **Screens that scroll under the pill** (Chronicle, Quests tab, Menu, Archive, Lore, Reserves) keep room at their foot and report their scroll through `usePillScroll`; the others (a realm's channel, Settings, Chronicler) are kept clear of the pill by padding.

## Next

1. The owner tries it on a phone and answers the three questions in work in progress.
2. If the snap on a phone is not wanted, add an animation (core `Animated` or reanimated) to `phonePill.tsx` only after deciding to use it.
3. Chronicler's own header still reads "Chronicle" under the top bar's "Chronicler"; rename or hide it if it confuses.

## Open questions

- Does the composer need a Back button as the mockup drew it?
- Do Rituals need a place on the phone?
- Is a safe-area package (`react-native-safe-area-context`) wanted for the gap above the system bar?

## Sources

- `documentation/art-direction/2026-11-26-mobile-shell.html` (frame E)
- `documentation/changelog/0.2.10-Pre-Alpha.md` (CHG-0760)
- `apps/app/src/shell/narrowShell.tsx`, `phoneShell.ts`, `phonePill.tsx`, `apps/app/test/shell/phoneShell.test.ts`
