# Handoff: the phone's sidebar showed a realm's folder and no name

Supersedes: none
Workspace: repository `OUTLORE` (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

On the phone app, each realm's row in the sidebar shows its name beside the folder mark. Done when the owner sees the names on a phone built from this change.

## State

- **Report:** the owner's screenshot of the phone's sidebar (Android, host "Mac Mini") showed four realm rows with a folder mark, a chevron, the quest count, the overview eye and the new-quest button, and no name between the folder and the chevron.
- **Cause (read from the code and Yoga's rule, not seen in a build):** `RealmHeader` in `apps/app/src/shell/railQuests.tsx` drew the name with `[local.rowText, local.realmText]`. `rowText` carries `flex: 1`; `realmText` laid `flexBasis: "auto"` and `flexGrow: 0` over it. Yoga (the phone's layout engine) treats `flexBasis: "auto"` as unset, so `flex: 1` still gave a basis of 0 and the name got no width. The web build follows CSS and showed the name, which is why only the phone lost it. Quest rows have no such override and were fine in the screenshot.
- **Fix (committed with this handoff):** `realmText` in `apps/app/src/shell/railStyles.ts` is now a style of its own (colour, font family, size, weight 600, `flexShrink: 1`, no `flex`, `flexBasis` or `flexGrow`); the row uses `style={local.realmText}` alone. A guard, `apps/app/test/shell/railStyles.test.ts`, reads both sources through `import.meta.glob` (the styles import react-native, which the test runner cannot load) and fails if `realmText` gains a `flex` property or is layered on `rowText` again.
- **Verified now (this session):** `CI=1 bunx vitest run apps/app` passed, 77 files, 554 tests, 6 skipped; `bunx biome check apps/app` clean; `bun run typecheck` in `apps/app` clean after the guard stopped using `node:fs`.
- **Not verified:** nothing was run on a phone or in an emulator, and no APK was built; that the name appears is assumed from the code. An empty realm name from the host would draw the same screenshot, but the layout cause fits the evidence and the data path (`WorkspaceChoice.name`) reads fine.
- **Changelog:** CHG-0528 is in `documentation/changelog/0.1.12-Prototype.md`. Another thread's commit `e2b6461` (CHG-0527) created that file in git and carried my entry with it, one commit before this fix's code; the entry is true once this commit lands.

## Decisions

- Give the realm name its own style rather than keep `flexBasis: "auto"` over `rowText`: it is the simplest form that cannot inherit `flex`. Reason: Yoga's reading of `"auto"` above.
- The guard reads source text, since the style module cannot load in the test runner; it is a check on the style's shape, not on the layout.

## Next

1. Build a phone APK that includes this commit and check that the four realm rows show their names, also with a long name (it should end in an ellipsis before the count) and a realm tied to no folder (no folder mark).
2. Look for the same pattern elsewhere in `apps/app`: a style layered over one with `flex` that sets `flexBasis: "auto"`. A search for `flexBasis: "auto"` is the start; none was checked beyond this row.

## Open questions

- Does the owner see the name on a phone after the change? Only a build can answer.

## Sources

- The owner's screenshot in the quest "On mobile, I don't see the name of the realm, just the folder beside it".
- `apps/app/src/shell/railQuests.tsx` (`RealmHeader`), `apps/app/src/shell/railStyles.ts` (`realmText`, `rowText`), `apps/app/test/shell/railStyles.test.ts`.
- `documentation/changelog/0.1.12-Prototype.md` (CHG-0528).
