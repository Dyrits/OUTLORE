# Verification: Conversation panes, batches 1 and 2

- **Work:** CHG-0557 (the overlay sidebar) and CHG-0558 (the pane chain), on branch `mission/delineate-specify-i-d-like-to-have-more-b606ee66`, based on `8fea7f53`.
- **Environment:** macOS, Expo web export of the worktree served on `127.0.0.1:8099`, a throwaway service on the fake harness with a fresh data folder under `/tmp` ([`scratch-serve.ts.txt`](2026-11-19-conversation-panes/scratch-serve.ts.txt): three realm quests, one with errands nested to three levels, one in no realm), shown in a bare Electron window with a debug port ([`electron-window.js.txt`](2026-11-19-conversation-panes/electron-window.js.txt), `--no-sandbox`, which the thread's sandbox needs) and driven with Playwright over that port. The window was 1500 px wide unless said; the owner's own data was never touched. Run outside the thread's sandbox, because Chromium cannot start inside it.
- **Verdict:** The behavior below was seen. The owner's look at the design, and the choices listed in CHG-0558, are open.

## Recorded results (the drivers beside this file print them)

| Claim | Observation |
| --- | --- |
| The sidebar rests off the window and opens at the edge after a delay | Panel at x = -304 at rest; with the pointer at x = 2, still -304 after 120 ms and 0 after 620 ms |
| It stays shut away from the edge | Pointer at x = 40: still -304 |
| It closes when the pointer leaves the panel | Pointer to x = 900: -304 after 600 ms |
| The top bar button opens it and a hand-opened panel stays while the pointer never visited it | Button: 0; pointer at x = 1000 for 600 ms: still 0 |
| A press outside closes it; ⌘B opens it; Escape closes it | -304, then 0, then -304 |
| Choosing a quest closes it | -304 after the quest opened |
| The right edge works | Panel at x = 1212 (1500 - 288) with the pointer at the right edge; 1516 after leaving |
| Docked keeps today's frame | Panel at x = 0 in the frame, "Hide sidebar (⌘B)" handle present |
| The Look card changes mode and side at once | Docked then Overlay then Right: the frame changed with no reload; `outlore:sidebar-mode` = overlay and `outlore:sidebar-side` = right stored |
| A quest with errands shows reply lines | "Design the layout" and "Build the component" as cards with state and age |
| Pressing a reply line opens the errand in the next pane, to three levels | Quest, Build the component, Unit tests, Integrate and review: four panes of 475 px at 1900 px |
| Four panes at 1500 px do not fit | The quest folded to a strip (375 px would be under the 380 px least) |
| Fold, unfold, close, reopen | Folding the quest left one strip; pressing a strip reopened it; ✕ on the deepest pane left two close buttons for a chain of three then two; pressing its reply line again reopened it |
| Dragging the edge resizes | Resizer at x = 900 went to 920, 960, 1000 with the pointer; weights stored as `[999,800]` |
| Choosing a nested errand in the sidebar opens its whole chain | "Integrate and review" in the sidebar: quest, Build the component, Unit tests, Integrate and review; three close buttons |
| The details panel follows the pane pressed | Pressing the second pane's panel button showed "Errand / Build the component" in the column |
| A narrow window shows fewer panes | 1100 px: two panes and two strips |
| Phone width is unchanged | 390 px: the same top bar and empty screen as before |

## Not seen, or not proven

- A real drag of a quest or realm while the panel is open (the rule is tested as data, the browser drag was not driven).
- A touch device; the dark look of the overlay (the dark panes were seen once, no overlay); the black and white theme.
- A quest with long conversations or many errands in one message; a real harness; a quest archived or failed in a pane.
- The visuals are for the owner to judge: the weight of the reply line, the strip, the focus mark (a pane has none beyond the panel's button), and the grey of an open reply line.
- Keyboard focus moving between panes.

## Checks run

`bun run check` and `bun run typecheck` clean; `apps/app` tests 83 files, 633 passed, 6 skipped (new: `sidebarMode`, `sidebarPreferenceRules`, `paneChain`, and the storage of the shares); the full suite 307 files passed, 7 failed (29 tests in `packages/service`, all at `git init` copying templates into a folder the sandbox cannot write).
