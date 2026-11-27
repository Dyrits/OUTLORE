# Proof: a thread's first message draws the skills the owner named as chips

- **Verdict:** not proven (C1 and C5 proven; C2 and C3 unproven; C4 awaits a human eye)
- **Work:** working tree on `29741c18` (uncommitted when verified)
- **Agreement:** the owner's report in the quest "Syntaxe $skill" (2026-11-27): the `$debug` chip shows in the message box but not in the sent message at the top of the thread; [thread-messaging specifications](../capabilities/thread-messaging/specifications.md) ("a chosen skill is written `$name`, shows as a chip").
- **Environment:** macOS (Darwin 27.2), Bun 1.4.4 and Vitest from the repository, `react-native-web` rendering to static markup, sandboxed shell; no window or phone was available to drive.
- **Date:** 2026-11-27

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | The owner's root message, with `$debug` in it, no longer shows `$debug` as plain words: it draws the skill as a chip | request, specifications | proven |
| C2 | A dollar amount such as `$5.50` in the root stays plain text | specifications ("`$5` is plain text") | unproven |
| C3 | A root written by another sender is still drawn by `Markdown` | diff | unproven |
| C4 | The chip looks right in the root, in the window and on the phone | request | awaiting human judgment |
| C5 | Nothing else regressed | repository checks | proven |

## Evidence

### C1: the skill is a chip

- **Check:** `cd apps/app && bun run vitest run test/conversation/threadRootChips.test.ts` (draws `EntryView` with a `Root` entry whose text is `It should display properly. $debug .` and a `debug` skill, and asserts the markup holds no `$debug`).
- **Shown able to fail:** before and after. In a worktree of `29741c18` with only the test file copied in, the test failed: `AssertionError: expected '<div class="css-view-…' not to contain '$debug'` (the markup held `It should display properly. $debug .` as one text). On the end state it passes. The worktree and its branch were removed afterwards.
- **Result:** `Tests 2 passed (2)` on the end state.
- **Reproduced:** by the same agent from a clean shell, the end-state run matched. The before run was not rerun.

### C2: a dollar amount stays plain

- **Check:** the second test in the same file renders `It costs $5.50` and asserts the markup holds `$5.50`.
- **Shown able to fail:** no. It passes before and after the change, and no mutation (a root that drew every `$word` as a chip) was run.
- **Result:** passes.
- **Reproduced:** as C1.

### C3: other senders' roots

- **Check:** read `conversationEntries.tsx`: `root.sender === "user"` selects `ChipText`, else `Markdown`. No test renders an agent root.
- **Shown able to fail:** no.

### C4: how it looks

- **Check:** needs the window or a phone. The static markup shows the text node, not the chip's icon (the test replaces `react-native-svg`).

### C5: regressions

See the table below.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| App tests | `cd apps/app && bun run vitest run` | not run | pass (129 files, 1,050 passed, 6 skipped) |
| Typecheck | `bun run typecheck` | not run | pass for the service, desktop, channel, contracts, relay and controller; the app failed first on 6 missing `expo-*` modules (declared in `apps/app/package.json` but not installed in the checkout) and on a type error in the new test (`key` and `at` missing on the entry), both fixed (`bun install --frozen-lockfile`; the test); app typecheck then clean |
| Lint | `bunx biome check .` | not run | pass, with 4 existing warnings in `documentation/architecture-audit/*.html` |
| Build | not run | not run | not run |

## Not proven

- C2: the check was not shown able to fail; a mutation that draws every `$word` as a chip would prove it.
- C3: no test draws an agent root; a render test with `sender: "agent"` would prove it.
- C4: appearance; look at a thread whose first message names a skill, in the window and on the phone.

## Reproduce

```sh
bun install --frozen-lockfile
cd apps/app && bun run vitest run test/conversation/threadRootChips.test.ts
bun run vitest run
bun run typecheck
cd ../.. && bunx biome check .
# before the change: git worktree add .worktrees/proof -b worktree/proof 29741c18, then sh .agents/worktree-setup.sh there,
# copy apps/app/test/conversation/threadRootChips.test.ts in and run the first command: the first test fails.
```

## New files

`apps/app/test/conversation/threadRootChips.test.ts`.
