# Sidebar overflow limits verification

CHG-0636 starts at `04cc66ee` on `worktree/sidebar-overflow`.

Each realm's list and the Borderlands show at most four quests (five before): the selected quest first, then running quests, then the list's own order, with the visible rows keeping their placement order. A quest's expanded tree previews at most two unfolded errand rows. **Show N errands** appears only when more than two rows would show, counts the unfolded rows before the limit, and still opens the quest's **Errands** tab. A quest with one errand shows its row and no link (the link used to read "Show 1 errand").

The outline tests were written first and reproduced the old behavior: five quests with running ones kept beyond the cap, and the link shown at a single errand.

Checks run on 2026-11-22 in `.worktrees/sidebar-overflow`:

- `CI=1 bun run test apps/app/test/shell/railOutline.test.ts apps/app/test/shell/railStyles.test.ts` — 10 passed. The outline cases cover the four-quest cap with a running quest kept inside it, the selected quest kept within a lower limit, running quests fitted after the selected quest, no overflow link at one and two rows, two rows plus **Show 3 errands** at three rows, and no link once the parent is folded.
- `bun run check` and `bun run typecheck` (all seven workspaces) passed.
- `CI=1 bun run test` — 2,694 passed, 68 skipped, 7 failed. The failures are the Vault denial-stamp and live-probe tests (`packages/service/test/work/vaultHandlers.test.ts`, `packages/service/test/vault/denialStamp.test.ts`); the same seven fail identically at the base revision `04cc66ee` in this environment (checked in `.worktrees/quest-fold`), so they pre-date the change and touch no code this batch edits.

## Window check

No browser surface was available: Aside's local service did not answer, this environment denies Chromium's Mach service registration (recorded for CHG-0612), and this session's model cannot read screenshots. The running interface is unchecked.

1. In a realm or the Borderlands with more than four quests: four rows show, the open quest and running quests are among them, and **Show all** appears only while quests are hidden.
2. A quest with one or two unfolded errands shows its rows with no **Show N errands** link. With three or more: two rows show, the link reads **Show 3 errands** (the count is of unfolded rows, not hidden ones), and it opens the quest's **Errands** tab.
3. Folding the quest removes the link; the narrow sidebar still expands the Borderlands in place.
