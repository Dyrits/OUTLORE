# Handoff: The phone's floating pill shell

Supersedes: 2026-11-26-1400-phone-floating-pill.md
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner chose direction E of the phone shell page: a floating pill of three tabs (Chronicle, Quests, Chronicler) over full-screen tabs, a Menu button in the top bar for the other places, the conversation's composer in place of the pill in a quest, and a pill that shrinks to a circle while scrolling down.
Done means the owner has used it on a phone and accepted it.

## State

- **Merged on `main` (verified: `git show --stat 431e71f4`):** merge commit `431e71f4` landed the ten-direction mockup page (CHG-0760) and the phone floating pill implementation (CHG-0761) onto `main`, with the pre-commit Biome, workspace typecheck, and related tests passing during the merge commit.
- **Worktrees cleaned (verified: `git worktree list`):** the two quest worktrees (`mobile-ui-redesign-options-b71b7362` and `mobile-ui-redesign-options-dbb76422`) and six other clean, merged worktrees under `.worktrees/` were removed; three older worktrees with uncommitted changes (`explore-sidebar-designs-872c1f3c`, `queued-message-designs-d9f2e935`, `steered-interrupt`) were left for the owner to confirm before force-removal.
- **Window check (assumed from superseded handoff):** web export of `apps/app` against the real service on isolated data in headless Chrome at 390 by 844 across five theme and look pairs, with wide windows unchanged.
- **Not checked:** a real phone, Android gesture and three-button bars (the pill's gap is a fixed 24 on a phone), blur on a phone (none outside browsers), Safari, a long Chronicler thread with the keyboard open, and the Ritual form on a phone.
- **Push to `origin/main`:** requested for owner approval immediately after committing this handoff (`git push --no-verify origin main`, as the pre-push hook guards `main`).

## Decisions

- **No Rituals or Realms tile in the Menu:** a Ritual is not a place (CHG-0616) and the Quests tab already holds realms and their Rituals.
- **The pill stays on the Chronicler tab** with the chat's own composer above it; the pill is absent only in a quest or errand, under the quest panel, and under the Ritual form.
- **Conversation Back stays in its header;** no Back button was added to the composer.
- **No new dependency:** no blur (browsers get `backdrop-filter`), no `Animated`, no safe-area package; the width change is the browser's CSS transition and snaps on a phone.
- **Screens that scroll under the pill** (Chronicle, Quests tab, Menu, Archive, Lore, Reserves) keep room at their foot and report their scroll through `usePillScroll`; the others (a realm's channel, Settings, Chronicler) are kept clear of the pill by padding.

## Next

1. The owner tries the floating pill on a real phone and answers the open questions below.
2. If the snap on a phone is not wanted, add an animation (core `Animated` or reanimated) to `apps/app/src/shell/phonePill.tsx` only after deciding to use it.
3. Chronicler's own header still reads "Chronicle" under the top bar's "Chronicler"; rename or hide it if it confuses.

## Open questions

- Does the composer need a Back button as the mockup drew it?
- Do Rituals need a place on the phone?
- Is a safe-area package (`react-native-safe-area-context`) wanted for the gap above the system bar?

## Sources

- Merge commit `431e71f4` on `main`
- `documentation/art-direction/2026-11-26-mobile-shell.html` (frame E)
- `documentation/changelog/0.2.10-Pre-Alpha.md` (CHG-0760, CHG-0761)
- `apps/app/src/shell/narrowShell.tsx`, `apps/app/src/shell/phoneShell.ts`, `apps/app/src/shell/phonePill.tsx`, `apps/app/test/shell/phoneShell.test.ts`
