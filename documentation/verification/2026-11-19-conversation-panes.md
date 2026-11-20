# Verification: Conversation panes, batches 1 and 2

- **Work:** CHG-0560 (the overlay sidebar) and CHG-0561 (the pane chain), on branch `mission/delineate-specify-i-d-like-to-have-more-b606ee66`, based on `8fea7f53`.
- **Environment:** macOS, Expo web export of the worktree served on `127.0.0.1:8099`, a throwaway service on the fake harness with a fresh data folder under `/tmp` ([`scratch-serve.ts.txt`](2026-11-19-conversation-panes/scratch-serve.ts.txt): three realm quests, one with errands nested to three levels, one in no realm), shown in a bare Electron window with a debug port ([`electron-window.js.txt`](2026-11-19-conversation-panes/electron-window.js.txt), `--no-sandbox`, which the thread's sandbox needs) and driven with Playwright over that port. The window was 1500 px wide unless said; the owner's own data was never touched. Run outside the thread's sandbox, because Chromium cannot start inside it.
- **Verdict:** The behavior below was seen. The owner's look at the design, and the choices listed in CHG-0561, are open.

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


# Batch 3 and the fixes after the owner's look (CHG-0562 to CHG-0564)

- **Work:** the fixes and additions of CHG-0562 (the details icon, the pinned sidebar, equal widths), CHG-0563 (the Workshop over the panes) and CHG-0564 (the Chronicle as the first pane), on branch `mission/slack-like-conversation-panes-83921a40`.
- **Environment:** as above, with a new web export of the worktree on `127.0.0.1:8099` and the throwaway service on the fake harness ([`scratch-serve-chronicle.ts.txt`](2026-11-19-conversation-panes/scratch-serve-chronicle.ts.txt): the same quests, and a quest Chronicler proposed and the owner opened, so the Chronicle holds a reply line). The service was bundled with `bun build --target=node` and run with Electron as Node (`ELECTRON_RUN_AS_NODE=1`), because the service's SQLite module is built for Electron and fails under bun. Drivers: `b3-*.py.txt`, run outside the thread's sandbox (Chromium cannot start inside it). The window was 1500 px wide unless said.
- **A bug the window found:** the first build looped ("Maximum update depth exceeded", a blank window) when a quest opened: the frame's context for the Chronicle changed on every render, and a pane that hands the frame its panel makes the frame draw again, so the pane host drew its panes again, and so on. The Chronicle's context now changes only when it is folded or unfolded, and the conversation reaches its pane through a second context that only the pane's leaf reads. This is the loop the comment in `paneHost.tsx` warns of; it was not seen by tests.

## Recorded results

| Claim | Observation |
| --- | --- |
| The Chronicle is a pane beside Home, with the Chronicler's quest as a reply line | Pane at x = 1, 380 px; the reply line "Opened quest · Dark mode for settings · Resting · your turn" ([screenshot](2026-11-19-conversation-panes/b3-chronicle-home-light.png)) |
| The top bar has the Workshop's gear at the far right and no Chronicler button | Workshop icon 1, Chronicler button 0 |
| Pressing the reply line opens the quest in the next pane, marked Open; the quest has a close button | Two panes of 750 px; reply line text "Open"; "Close the quest" present ([screenshot](2026-11-19-conversation-panes/b3-quest-from-reply-line-light.png)); pressing it left "Pick a quest in the sidebar" |
| A quest with two errand levels, at 1500 px, folds the Chronicle first | Chronicle as a strip, three panes of about 485 px ([screenshot](2026-11-19-conversation-panes/b3-chronicle-strip-light.png)); a fifth level also leaves the Chronicle a strip; pressing the strip reopened the Chronicle and folded the earliest pane |
| The Chronicle's fold button | Present; folding left the strip "Open Chronicle" (seen in the chain runs) |
| CHG-0562, the details icon: pressing another pane's icon moves the panel to it at once | In a chain of three: quest icon [Hide, Show]; errand icon pressed once: [Show, Hide] after 30 ms and still after 1.2 s; the same pane's icon again: [Show, Show], panel shut |
| CHG-0562, equal widths | Edges at 567 and 1133 (1700 px, three panes of about 567); dragging +80 gave 647 and 1133; "Equal widths" gave 567 and 1133, and the stored shares were empty |
| CHG-0562, the sidebar button pins | Unpinned: Chronicle at x = 1; pinned: x = 289 and the label "Unpin the sidebar (⌘B)"; still pinned after the pointer left, Escape and a press outside; pinned after a reload; ⌘B unpinned it ([screenshot](2026-11-19-conversation-panes/b2-pinned-sidebar-light.png)). A pinned sidebar on the right pushes the panes from the right (a first build did not fill the window's height; fixed, not looked at again) |
| CHG-0563, the Workshop over the panes and back with the chain as left | At 1800 px with a quest, an errand, a dragged share, the details panel open on the errand, a pinned sidebar and a draft in the errand's composer: in the Workshop the Chronicle and panes were not visible and the gear read "Close the Workshop"; back, the resizer edges [680, 1060], the Chronicle's 391 px, the tabs [Quest, Companions], the pin and the draft were identical ([screenshot](2026-11-19-conversation-panes/b3-workshop-light.png)). The sidebar had no Workshop row |

## Not seen

- A quest the owner started directly in the Chronicle (it has no entry there yet, see CHG-0564), a Chronicler quest that was archived or failed, and a real harness.
- The pinned sidebar on the right after the height fix; a drag of a quest onto a pinned sidebar; touch; the dark and black and white looks of the Chronicle and the pinned sidebar.
- A window under 820 px (the narrow Chronicler screen and the menu with the Workshop row were typechecked, not looked at); the Workshop icon's selected look beyond the screenshot.
- The visuals are for the owner to judge: the Chronicle's weight beside a quest, the strip's label, the Workshop icon at the far right.


# Batch 4: initial anchor persistence checks (2026-11-20)

These checks ran before the three-pane desktop implementation below.

- `TMPDIR=<worktree>/.tmp-test CI=1 bun run test`: 315 files passed, 6 skipped; 2,584 tests passed, 62 skipped. This run preceded the added restart test.
- The focused reply test (14 tests) passed after adding the restart case: a new service on the same SQLite store reads the agent reply, its triggering message, the child anchor, the unchanged tree parent and the child brief. Named invalid triggers leave the tree unchanged; separate calls create separate anchors. The steering and harness tests pass with helpers adjusted for the additional agent messages.
- `bun run typecheck` passes. Biome checked the touched source files; `bun run check` also picked up temporary test fixture files in `.tmp-test` and failed on their formatting.
- The revised agent-reply UI and the three-level layout were not seen in a window. An earlier session drove the prior system-card implementation in an Electron fake-harness window; that does not validate this revision.


# Three-pane desktop revision (2026-11-20)

- Workspace typecheck, Biome on staged files and the full suite passed. The suite reported 2,588 passing tests and 62 skips. Reproduce with `TMPDIR="$PWD/.tmp-test" CI=1 bun run test`. The fake-harness cases in `packages/service/test/work/replies.test.ts` exercise distinct folderless realm and Borderlands chats, realm lore scoping, quest placement, stable anchor identity after moving a quest, opening messages for empty quests, Chronicle realm and quest links, agent-attributed follow-ups, and SQLite restart. `apps/app/test/shell/paneChain.test.ts` verifies that a legacy descendant takes the third slot and retains a route to its actual parent. Legacy fixture tests cover deletion, archive, own-copy access and message reach at the preserved depth.
- The Expo web export succeeded and the isolated fake service started. Electron exited with SIGABRT and the Chromium fallback failed to register its macOS Mach port. Aside could not authenticate to its local browser process because the keychain was unavailable. The revised desktop interaction and appearance remain unverified in a window, including sidebar chevrons, switching quest tabs, and the Workshop round trip.
- Chronicle currently shows recent stored activity and one reminder per waiting conversation. The later unread badge, attention filters, message and request links, and separate History tab require a subsequent implementation.
