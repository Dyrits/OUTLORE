# Handoff: phone Back button goes to the previous screen

Supersedes: none
Workspace: OUTLORE repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

On the Android phone (the app's narrow layout), the hardware Back button goes to the previous screen instead of leaving the app, and leaves it only from the Chronicle.
Done means the behavior is checked on a real phone or emulator.

## State

- Built and committed on `main` with CHG-0772 in `documentation/changelog/0.2.10-Pre-Alpha.md`. Verified this session: `bunx vitest run apps/app/test/shell/phoneShell.test.ts` passes 23 tests (five new, for Back); `bun run typecheck` passes in all workspaces; Biome is clean on `apps/app/src/shell` and `apps/app/test/shell`.
- `phoneBackOf(location, showsDetails)` in `apps/app/src/shell/phoneShell.ts` returns the navigation event for the topmost layer, `{ type: "closeDetails" }` for the quest panel, or null (Back leaves the app). `NarrowShell` in `apps/app/src/shell/narrowShell.tsx` registers `BackHandler` `hardwareBackPress` and reads the latest location from a ref.
- Assumed, not checked: the behavior on a real Android phone or emulator, and the Back gesture on Android 14+ (predictive back). `BackHandler` is a no-op on web.
- The wide layout is untouched; Back there is not handled.
- The changelog file was found truncated to one entry in the working tree midway through the session (another session's write); it was restored from `HEAD` before this entry was appended.

## Decisions

- Back from a quest or errand leaves the whole quest, as the on-screen Back arrow does; it does not step up from an errand to its quest. Reason: consistency with `backFromQuest`. Not recorded elsewhere.
- Back from a quest goes to the Quests tab, then to the place beneath (`close`), never back into the quest, which stays mounted under the tab.

## Next

1. Try Back on an Android emulator or the phone: quest, errand, Quests tab, Menu, Chronicler, budget page, a Menu place, a realm channel, a form.
2. Decide whether Back from an errand should go to its parent quest first.
3. Decide whether the wide layout needs Back handling for Android tablets.

## Open questions

- Errand Back (owner).
- Whether predictive back on Android 14+ needs `android:enableOnBackInvokedCallback` configuration (a real-device check against the Expo SDK docs).

## Sources

- `apps/app/src/shell/phoneShell.ts`, `apps/app/src/shell/narrowShell.tsx`, `apps/app/src/shell/location.ts`
- `apps/app/test/shell/phoneShell.test.ts`
- `documentation/changelog/0.2.10-Pre-Alpha.md` (CHG-0772)
