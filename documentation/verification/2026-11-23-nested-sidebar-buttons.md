# Nested sidebar buttons · 2026-11-23

CHG-0671 starts at `ac011194` on `worktree/sidebar-directions`.

## Cause

`react-native-web` 0.21.4 draws `accessibilityRole="button"` as a `<button>`.
The sidebar's rows (the Realms and Borderlands headings, realm rows, quest, errand, and Ritual rows) were each a button holding the fold mark and the action buttons, which are buttons too.
`git log -S` shows the nesting in the sidebar's first build (`2a75c4e1`, 2026-11-11); `react` 19.3.0 and `react-native-web` ^0.21.4 date from `649e2320` (2026-11-05), so no upgrade changed it.
React reports it in development, once per page load and only while the sidebar mounts, and Expo forwards it to the terminal.
A reload of the dev window (which `scripts/dev.ts` does on each service, contracts, or desktop change) shows it again.

## Checks run

- `bunx vitest run test/remote/frames.test.ts` in `packages/service`: 4 passed, including the new test of the logged cause and the unchanged answer.
- `bunx biome check` on `apps/app/src`, `packages/service/src/remote`, and `packages/service/test/remote`: passed.
- `bun run typecheck`: the app and service typechecks exited 0 (run in the background).

## Window check

A throwaway desktop instance (`OUTLORE_DATA_DIR` in a temporary folder, `OUTLORE_HARNESS=fake`, Expo on port 8131, DevTools on port 9333) was driven over the DevTools protocol.

1. After a reload the console held only Electron's own security notice: no `<button> cannot be a descendant of <button>` warning. `document.querySelectorAll("button button")` returned 0.
2. The same count was 0 with the sidebar showing a realm with a quest, with the quest's conversation open, and on the Workshop, Hosts, and Chronicle screens.
3. Realms heading: the creation button is hidden until hover, the row shades on hover (screenshot 01), clicking the title folds and unfolds the section, and the creation button opens the realm dialog.
4. Realm row: the creation, overview, and Ritual buttons show on hover, the row stays shaded while the pointer is on the fold chevron, and the chevron folds and expands the quests.
5. Quest row: hover shows the delete mark (screenshot 02), and clicking the row selects it with the selected shade.
6. Borderlands heading: hover shows the new-quest button (screenshot 03), and the chevron folds the section.
7. Tabbing from the Realms title to the creation button shows the button.

Not checked: a touch device (the rows without hover), the Islands theme, the dark look, the Android build, dragging a quest row, a Ritual row, and an errand row beneath a quest with errands.
The service log line was checked by the unit test only, not by making a live request fail.
