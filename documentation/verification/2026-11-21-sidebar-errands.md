# Sidebar errands verification

CHG-0620 starts at `578aeefb` on `worktree/sidebar-errands`.

The navigation regression cases in `apps/app/test/shell/location.test.ts` cover opening the realm and Borderlands Quests tabs, issuing a fresh request on every press, and opening a quest on Errands from a selected errand. The existing sidebar outline tests cover nesting, folding, and keeping selected and running quests visible.

`CI=1 bun run test apps/app/test/shell` passed all 167 tests. `bun run check`, `bun run typecheck`, and `bun run --filter desktop build` passed.

## Window check

The running interface remains unchecked. Aside could not authenticate from the sandbox because the macOS keychain was unavailable, and the connected browser inventory was empty.

1. In a desktop window, expand a quest with nested errands. Open a nested errand from its row. Choose **Show N errands** and check that the quest opens with **Errands** selected.
2. In a realm with more than five quests, choose **Show all N quests** and check that the realm opens with **Quests** selected. Switch to **Missives**, then choose the sidebar link again. Repeat for the Borderlands.
3. Repeat the sidebar navigation in overlay mode and check that the overlay closes. At phone width, check that the links lead to the realm's full list or the quest with its errand list expanded.
