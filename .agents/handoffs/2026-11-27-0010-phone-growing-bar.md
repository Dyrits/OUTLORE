# Handoff: the phone's growing floating bar, side menu, and landing in the chat

Supersedes: none (it replaces the shell of `2026-11-26-1445-phone-floating-pill.md`, which stays as the older record)
Workspace: OUTLORE repository, branch `main`, nothing committed

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Confirm the working tree with `git status` (note: in this sandbox git needs `GIT_CONFIG_COUNT=0 git ...`).

## Goal

Redesign the phone UI. The owner's requests, in order: improve it ("it looks awful"); Chronicle stays a tab, Chronicler is no longer a thing; the sidebar panel becomes a side menu; the other button is Realm, then Quests once a realm is chosen, then Errands once a quest is; a floating tab bar; Chronicle as a logo without text; a tab is held for half a second to change its choice; the Quests logo is two swords, one once a quest is chosen; the bar grows only as choices are made; the desktop pane header's actions at the top right; the side menu stays and holds the host selection; then "build it", landing in the chat on every choice with the composer above the bar, as in Claude Duet.
Done means the owner has tried it on a phone and accepted it.

## State

- Verified this session: `bun run typecheck` passes in all seven workspaces; `bunx biome check apps/app` is clean; `CI=1 bun run test apps/app` passes 126 files, 1,019 tests (6 skipped); `CI=1 bunx expo export --platform web` bundles 1,077 modules. Evidence: `documentation/verification/2026-11-26-phone-growing-bar.md`.
- Built, uncommitted (CHG-0773 in `documentation/changelog/0.2.10-Pre-Alpha.md`): `phoneBar.tsx` (growing capsule: `Slot` animates width, opacity and scale with `Animated`; `BarTab` fills a line over 500 ms while held and opens the sheet through `onLongPress`), `phoneChooser.tsx` and `phoneChoices.ts` (the floating sheet and its rows), `phoneSelection.ts` (the remembered realm, quest and errand, the tap and hold rules, the events a choice sends; pure and tested), `sideMenu.tsx` (hosts, Keep, Reserves, Settings), `narrowShell.tsx` (the frame; selection followed from the location while the render runs), `topBar.tsx` (`NarrowTopBar`), `headerScope.tsx` and `MobileHeader` (a conversation hands the top bar its title and actions through `PhoneHeaderSetter`, as the quest panel is handed to the frame), `phoneErrandStarter.tsx` (New errand on a phone), `foundation/barClearance.ts`.
- Removed: the pill, the Quests tab (the sidebar's narrow host), the Chronicler tab and cover, the Menu screen, the pill's scroll collapse, `isQuestsOpen`, `isNarrowChroniclerOpen`, the `quests` and `narrowChronicler` events, `viewing.ts`, the `chronicler` and `place` props of `Shell`.
- Nine HTML drafts are kept in `documentation/art-direction/2026-11-26-mobile-menu-*.html`; draft 9 is the design as built. They were served to the owner's phone with `python3 -m http.server 8765 --bind 0.0.0.0` on the home Wi-Fi (each start was approved by the owner); the server may still be running, and stops when the Mac sleeps.
- Not checked: any screen, real or emulated. The bar's growth, the hold, the sheet, the side menu, the composer above the bar with the keyboard open (the bar hides on the native keyboard event only), New errand, the quest panel, a Ritual quest, Android gesture bars, and a desktop window were not seen. The drafts are the reference for how it should look.
- The service tests that run `git` fail in this sandbox (`GIT_CONFIG_COUNT` set without `GIT_CONFIG_VALUE_0`); none touches this batch.

## Decisions

- Chronicler has no tab on the phone (my reading of "no longer a thing"; the desktop keeps it). So the phone has no way to talk to the app-wide assistant. The owner may want one back.
- The conversation's own tabs (Missives, Quests, Rituals, History, Realm, Companions) stay where the app draws them, rather than moving to the bar: the owner said "we'll still have access to the different tabs somehow" and left the how to me.
- Choosing a quest opens it as its own thread (`thread` event with a null id), so choosing or tapping the quest already on show keeps its conversation mounted; tapping the lit tab does nothing.
- Back goes up one level: errand, quest, the realm's channel, the Chronicle; a quest opened from the Chronicle returns there.
- A Ritual is not in the quest sheet; no vibration on a hold; New errand on an errand starts under the quest.

## Next

1. Run the app on a phone or emulator (or the web build at 390 by 844 against a service on isolated data, as `2026-11-26-1400-phone-floating-pill.md` describes) and compare it with draft 9.
2. Check the composer with the keyboard open, the bar's gap above the Android gesture bar, and the hold's feel (500 ms).
3. Decide whether Chronicler needs a way back on the phone.
4. Remove `Location.guildmasterRealm` and the `chroniclerRealm` event, which nothing sets now.
5. Commit when the owner accepts: nothing in this batch is committed.

## Open questions

- A vibration on a hold needs the `VIBRATE` permission in the Android manifest (config plugin); is it wanted?
- Should the realm tab also lead to a list of the realm's quests, as draft 8 did, or is the sheet enough?

## Sources

- `apps/app/src/shell/phoneBar.tsx`, `phoneChooser.tsx`, `phoneChoices.ts`, `phoneSelection.ts`, `phoneShell.ts`, `narrowShell.tsx`, `sideMenu.tsx`, `topBar.tsx`, `headerScope.tsx`, `phoneErrandStarter.tsx`, `location.ts`, `appScreen.tsx`
- `apps/app/src/conversation/mobileHeader.tsx`, `threadPaneHeader.tsx`, `chroniclerChat.tsx`, `conversation.tsx`
- `apps/app/test/shell/phoneShell.test.ts`, `phoneSelection.test.ts`, `phoneChoices.test.ts`, `phoneScreens.test.ts`, `location.test.ts`
- `documentation/art-direction/2026-11-26-mobile-menu-8-growing-bar.html`, `2026-11-26-mobile-menu-9-chat-landing.html`
- `documentation/changelog/0.2.10-Pre-Alpha.md` (CHG-0773), `documentation/capabilities/conversation-panes/specifications.md#the-phones-bar`
