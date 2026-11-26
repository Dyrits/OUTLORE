# Handoff: the phone's growing floating bar, side menu, and landing in the chat

Supersedes: `2026-11-27-0010-phone-growing-bar.md`
Workspace: OUTLORE repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Redesign the phone shell around a growing floating bottom tab bar (Chronicle icon-only, Realms, and growing Quests/Errands tabs with 0.5 s hold-to-change sheets), chat-first landing with the composer above the bar, desktop-aligned top-right actions, and a scrollable side menu holding hosts and secondary places (`CHG-0773`). Done means the owner has tried it on a real phone or emulator and accepted the layout, animations, and interactions.

## State

- Verified this session:
  - `bunx biome check apps/app` passes cleanly (583 files).
  - `bun run typecheck` passes across all 7 workspaces (`app`, `desktop`, `@outlore/controller`, `@outlore/channel`, `@outlore/relay`, `@outlore/service`, `@outlore/contracts`).
  - `CI=1 bun run test apps/app` passes 126/126 test files (1,027 passed, 6 skipped).
- Completed since `2026-11-27-0010-phone-growing-bar.md`:
  - All 9 Standards findings (`STD-01`–`STD-09`) refactored and verified: extracted narrow rendering into `apps/app/src/shell/narrowAppScreen.tsx` and header into `apps/app/src/conversation/chroniclerHeader.tsx`, removed disallowed casts / `undefined` assignments / internal query mocks, removed dead `Location.guildmasterRealm` and `chroniclerRealm`, and moved tab-tap and chooser-Back logic into plain `.ts`.
  - All 9 code-level Specifications findings (`SPEC-01`–`SPEC-09`) plus web hold ergonomics fixed test-first:
    - `SPEC-01`: `selectedThreadOf` in `apps/app/src/conversation/conversation.tsx` normalizes `topThreadId` to `null` when returning to a quest from an errand.
    - `SPEC-02`: `reconcileSelection` in `apps/app/src/shell/phoneSelection.ts` (wired in `narrowShell.tsx`) clears archived/deleted realms, quests, and errands from bar memory once no longer open.
    - `SPEC-03`: `isErrandStarterOpen` moved onto `Location` (`location.ts`, `windowView.ts`, `appScreen.tsx`, `App.tsx`, `narrowAppScreen.tsx`, `phoneShell.ts`) so New errand hides the bar, titles the top bar `"New errand"`, hides the stale Quest panel button, and closes cleanly on Back without leaving the quest.
    - `SPEC-04`: Quest panel sword omitted on errands in `narrowShell.tsx`, and Done ordered before Archive everywhere (`errandHeaderActions.tsx`, `threadPaneHeader.tsx`).
    - `SPEC-05`: `barSlotsOf` keeps Quests visible whenever `selection.quest !== null`.
    - `SPEC-06`: Opening `SideMenu` closes any open `PhoneChooser` sheet, and `phoneBackOf` prioritizes `isMenuOpen` before `isChooserOpen`.
    - `SPEC-07`: `SideMenu` body wrapped in a `ScrollView` (`sideMenu.tsx`).
    - `SPEC-08`: Settled by the owner (no code change; documented in `specifications.md`).
    - `SPEC-09`: Archived quests hide **New errand** (`conversation.tsx`), and Chronicle restores `"Chronicle, N unread"` via `chronicleLabelOf` (`phoneBar.tsx`).
    - Web hold ergonomics (`SPEC-10` partial): `userSelect: "none"` and `WebkitTouchCallout: "none"` added on holdable tabs in `phoneBar.tsx`.
- Not yet verified (`SPEC-10`): no real phone, Android emulator, or phone-width browser visual pass has been run yet (bar growth animation, 500 ms hold feel, chooser sheet, composer above bar with keyboard open, Android gesture bar clearance, New errand, scrollable side menu with multiple hosts, hardware Back, and desktop window sanity check).
- Sandbox note: in the agent sandbox, `git` requires `GIT_CONFIG_COUNT=0 git ...`.

## Decisions

- **Errand top-bar actions (`SPEC-04`, owner 2026-11-27):** Omit the Quest panel sword on errands (keep New errand, Done, Archive), and order Done before Archive everywhere.
- **Returning to a realm via the bar (`SPEC-08`, owner 2026-11-27):** Tapping **Realms** returns to whichever sub-tab was open in that realm; choosing a different realm opens on **Missives**. Recorded in `documentation/capabilities/conversation-panes/specifications.md#the-phones-bar`.
- **Chronicler on mobile:** Omitted from the phone bar; desktop keeps it. Revisit if the owner wants a mobile entry point back.
- **Conversation sub-tabs & gestures:** Sub-tabs (Missives, Quests, Rituals, History, Realm, Companions) stay under the header; Rituals stay on the Rituals tab rather than the quest sheet; no vibration on hold (avoids Android `VIBRATE` permission).

## Next

1. Install a build on a real Android phone (or run an emulator / phone-width browser at 390×844 against a service on isolated data) and visually verify `SPEC-10`: bar growth animation, 500 ms hold and sheet, composer with keyboard open, Android gesture-bar clearance, New errand starter + Back, scrollable side menu hosts, and desktop window layout.
2. Adjust spacing, hold timing, or animations based on real-device feedback.
3. Confirm whether Chronicler needs an entry point on mobile, and record final acceptance in `documentation/verification/2026-11-26-phone-growing-bar.md` and `documentation/work-in-progress.md`.

## Open questions

- Does the owner want a way back to Chronicler on the phone?
- Is haptic vibration on the 500 ms hold wanted (requires adding Android `VIBRATE` permission via config plugin)?

## Sources

- `apps/app/src/shell/phoneBar.tsx`, `phoneChooser.tsx`, `phoneChoices.ts`, `phoneSelection.ts`, `phoneShell.ts`, `narrowShell.tsx`, `narrowAppScreen.tsx`, `sideMenu.tsx`, `topBar.tsx`, `headerScope.tsx`, `phoneErrandStarter.tsx`, `location.ts`, `windowView.ts`, `appScreen.tsx`, `apps/app/App.tsx`
- `apps/app/src/conversation/conversation.tsx`, `errandHeaderActions.tsx`, `threadPaneHeader.tsx`, `mobileHeader.tsx`, `chroniclerChat.tsx`, `chroniclerHeader.tsx`
- `apps/app/test/shell/phoneShell.test.ts`, `phoneSelection.test.ts`, `phoneChoices.test.ts`, `phoneScreens.test.ts`, `location.test.ts`
- `documentation/art-direction/2026-11-26-mobile-menu-1-push-stack.html` through `2026-11-26-mobile-menu-9-chat-landing.html`
- `documentation/capabilities/conversation-panes/specifications.md#the-phones-bar`, `documentation/changelog/0.2.10-Pre-Alpha.md` (`CHG-0773`), `documentation/work-in-progress.md`, `documentation/verification/2026-11-26-phone-growing-bar.md`
