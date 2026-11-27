# Proof: the phone's Quests tab dot, the quarter-second hold, the sheets' creation rows and the top bar's order

- **Verdict:** not proven (two claims proven only in part by tests; the rest need a phone or a window)
- **Work:** working tree on `f14085c7` (uncommitted when verified)
- **Agreement:** the owner's requests in the quest "Mobile quest tab icon" (2026-11-27): crossed swords with a dot on the Quests tab, a hold of 0.25 s, "New quest/errand" in each menu, top icons as on the desktop (answered: same set and order); [conversation-panes specifications](../capabilities/conversation-panes/specifications.md)
- **Environment:** macOS 25.6 (Darwin), Bun and Vitest from the repository, sandboxed shell; no phone, simulator or window was available to drive.
- **Date:** 2026-11-27

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | The Quests tab draws crossed swords, with a gold dot once a quest is chosen | request, specifications | awaiting human judgment |
| C2 | Holding a tab for 0.25 s opens its sheet | request | unproven |
| C3 | Each sheet starts with its creation row: New realm, New quest, New errand, with their names and where they make it | request | proven for the row's content and presence; unproven for what pressing it does |
| C4 | On a quest the phone's top bar runs Mark as done, Archive, New quest, New errand, then the sword | request, owner's answer | unproven |
| C5 | Nothing else regressed | repository checks | proven for the app workspace |

## Evidence

### C1: crossed swords with a dot

- **Check:** read `apps/app/src/shell/phoneBar.tsx` (`icon="swords"`, `dot={selection.quest !== null}`). No automated test draws the bar.
- **Shown able to fail:** no.
- **Result:** appearance; a screenshot or a look at the phone is needed.
- **Reproduced:** no.

### C2: the hold

- **Check:** `holdMilliseconds = 250` in `phoneBar.tsx`; the constant is not exported and no test drives a press.
- **Shown able to fail:** no.
- **Result:** read only.
- **Reproduced:** no.

### C3: creation rows

- **Check:** `bunx vitest run test/shell/phoneChoices.test.ts test/shell/phoneScreens.test.ts` in `apps/app`: `creationOf` names the row and where (`New realm`, `New quest` in `One`, `New errand` in `Alpha`), and the sheet renders `New realm`.
- **Shown able to fail:** mutation in a worktree of the end state: (a) the quest row's note replaced by `"x"` made `names what it makes and where` fail; (b) the sheet's row name emptied made `lists what can be chosen under its title` fail. Both returned to passing when restored.
- **Result:** 243 shell tests pass on the end state.
- **Reproduced:** rerun from a clean shell in the main checkout (see Reproduce); match. Pressing a row (starting a quest, opening the errand starter, the realm dialog) has no test and was not driven.

### C4: top bar order

- **Check:** read `apps/app/src/conversation/threadPaneHeader.tsx`; no test renders the header.
- **Shown able to fail:** no.
- **Result:** read only.
- **Reproduced:** no.

### C5: regressions

See the table.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Lint and format | `bunx biome check apps/app/src apps/app/test` | not run | pass |
| Typecheck | `cd apps/app && bunx tsc --noEmit -p .` | not run | pass |
| App tests | `cd apps/app && bunx vitest run` | not run | pass (128 files, 1,048 passed, 6 skipped) |
| Other workspaces, build | not run | not run | not run (the pre-commit hook runs the workspace typecheck and related tests) |

## Not proven

- C1 and C4: appearance and layout on a phone; open the app on a phone or a narrow window and look at the bar and the top bar.
- C2: press a tab for 0.2 s and for 0.3 s on a phone.
- C3: press each row on a phone: the realm dialog opens, a new quest opens, the errand starter opens over the quest.
- No subagent was available, so the proof was reproduced by rerunning the commands myself.

## Reproduce

```sh
cd apps/app
GIT_CONFIG_VALUE_0= bunx biome check src test
bunx tsc --noEmit -p .
bunx vitest run
```

## New files

None (tests added to `test/shell/phoneChoices.test.ts` and `test/shell/phoneScreens.test.ts`, uncommitted).
