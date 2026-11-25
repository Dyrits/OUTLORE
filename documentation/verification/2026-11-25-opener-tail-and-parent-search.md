# Proof: Opener tail and on-demand parent message search (CHG-0748, CHG-0749)

- **Verdict:** not proven (6 proven, 1 unproven, 1 awaiting human judgment)
- **Work:** working tree on `210891d5` (`main`)
- **Agreement:** CHG-0748 and CHG-0749 in `documentation/changelog/0.2.8-Pre-Alpha.md`, `documentation/capabilities/thread-tree/specifications.md` (Opening a thread), and the owner's direction in quest "Reply opens the child thread" (2026-11-25)
- **Environment:** macOS 27.2.1 (Build 26B131), Bun 1.4.4, Node v26.13.1, Electron 45.4.1 (`ELECTRON_RUN_AS_NODE=1`), Vitest 5.1.1, Biome 2.6.8; tests run in-process against the service SQLite store (`@effect/sql-sqlite-node`) and fake harness inside Electron's Node runtime (confirming FTS5 is available in Electron 45.4.1)
- **Date:** 2026-11-25

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | An errand the owner opens with a message of its own receives its opener's last 5 messages, each clipped to 500 characters, on its first turn only; later turns carry only the opener's-conversation line | CHG-0749, thread-tree spec | proven |
| C2 | An errand an agent opens gets no tail (`threads.opener_tail` is null) | CHG-0749, thread-tree spec | proven |
| C3 | An errand opened via Reply gets no tail (`threads.opener_tail` is null) | CHG-0749, thread-tree spec | proven |
| C4 | `read_parent_messages` reads the direct parent's messages newest first, pages back with `before`, searches with FTS5 BM25 ranking (porter stemming and prefixes), and refuses a quest's top thread | CHG-0748, thread-tree spec | proven |
| C5 | When the FTS5 index (`messages_fts`) is missing, `read_parent_messages` falls back to ranking messages by matching query words in code | CHG-0748, `parentMessages.ts` | proven |
| C6 | `readStartingContext` counts the opener's-conversation line and clipped tail in `parts.openerMessages` rather than a 40-message snapshot | CHG-0748, CHG-0749, `startingContext.ts` | proven |
| C7 | An aside gets no tail (`threads.opener_tail` is null) and is refused `read_parent_messages` | CHG-0748, CHG-0749, `tree.ts`, `parentMessages.ts` | unproven |
| C8 | The 5-message tail and `read_parent_messages` behave as intended in a live desktop window with a real Companion | CHG-0748, CHG-0749, owner request | awaiting human judgment |

## Evidence

### C1: Owner-opened errand gets last 5 clipped messages on its first turn only

- **Check:** `bun run test packages/service/test/work/journal.test.ts -t "last five messages"`
- **Shown able to fail:** Two mutations in a separate worktree (`.worktrees/verify-opener-tail`):
  1. Removed the first-turn gate in `startingContext.ts` (`openerTail: row.turnCount <= 1 ? row.openerTail : null` → `openerTail: row.openerTail`); failed with `AssertionError: expected '\nWhen you were opened, your opener h…' not to contain 'Its latest messages when you were ope…'`.
  2. Raised the cap and clip in `journal.ts` (`openerTailCount = 5` → `10`, `openerTailLength = 500` → `5000`); failed with `AssertionError: expected '\nWhen you were opened, your opener h…' not to contain 'Owner:\nMessage 1'`.
- **Result:** Exit code 0; passed as part of `journal.test.ts` (20/20 tests) and the 59-test focused run.
- **Reproduced:** Fresh errand "Reproduce opener tail proof" (`bf0fb1b3-0293-4073-8e5d-6e25f7d78400`) from a clean shell; matched (exit 0, 1 passed).

### C2: Agent-opened errand gets no tail

- **Check:** `bun run test packages/service/test/work/journal.test.ts -t "an agent opens no tail"`
- **Shown able to fail:** Mutation in `.worktrees/verify-opener-tail/packages/service/src/work/tree.ts` removing `opening.isOpenedByAgent` from the `openerTail` guard; failed with `AssertionError: expected 'Owner:\nMessage 0\n\nOpener:\nEcho: M…' to be null`.
- **Result:** Exit code 0; passed as part of `journal.test.ts` (20/20 tests).
- **Reproduced:** Fresh errand "Reproduce opener tail proof" (`bf0fb1b3-0293-4073-8e5d-6e25f7d78400`) from a clean shell; matched (exit 0, 1 passed).

### C3: Reply-opened errand gets no tail

- **Check:** `bun run test packages/service/test/work/replies.test.ts -t "opens an empty errand from a message of the quest"`
- **Shown able to fail:** Mutation in `.worktrees/verify-opener-tail/packages/service/src/work/tree.ts` removing `opening.anchorMessageId != null` from the `openerTail` guard; failed with `AssertionError: expected 'Owner:\nPlan the trip\n\nOpener:\nEch…' to be null`.
- **Result:** Exit code 0; passed as part of `replies.test.ts` (25/25 tests).
- **Reproduced:** Fresh errand "Reproduce opener tail proof" (`bf0fb1b3-0293-4073-8e5d-6e25f7d78400`) from a clean shell; matched (exit 0, 1 passed).

### C4: `read_parent_messages` reads newest first, pages with `before`, searches with FTS5 BM25 ranking, and refuses a top thread

- **Check:** `bun run test packages/service/test/work/journal.test.ts -t "messages on demand"`
- **Shown able to fail:** Mutation in `.worktrees/verify-opener-tail/packages/service/src/work/parentMessages.ts` replacing `ORDER BY bm25(messages_fts) LIMIT` with `ORDER BY m.sequence DESC LIMIT`; failed with `AssertionError: expected 121 to be less than 33`.
- **Result:** Exit code 0; passed as part of `journal.test.ts` (20/20 tests).
- **Reproduced:** Fresh errand "Reproduce opener tail proof" (`bf0fb1b3-0293-4073-8e5d-6e25f7d78400`) from a clean shell; matched (exit 0, 1 passed).

### C5: Fallback word search when `messages_fts` is missing

- **Check:** `bun run test packages/service/test/work/journal.test.ts -t "where the full-text index is missing"`
- **Shown able to fail:** Mutation in `.worktrees/verify-opener-tail/packages/service/src/work/parentMessages.ts` changing `.filter((match) => match.score > 0)` to `.filter(() => false)`; failed with `AssertionError: expected 'No such messages.' to contain 'Owner: Pricing needs a discount code'`.
- **Result:** Exit code 0; passed as part of `journal.test.ts` (20/20 tests).
- **Reproduced:** Fresh errand "Reproduce opener tail proof" (`bf0fb1b3-0293-4073-8e5d-6e25f7d78400`) from a clean shell; matched (exit 0, 1 passed).

### C6: Starting-context preview counts opener line and clipped tail

- **Check:** `bun run test packages/service/test/work/startingContext.test.ts -t "counts the request, the journal"`
- **Shown able to fail:** Mutation in `.worktrees/verify-opener-tail/packages/service/src/work/startingContext.ts` setting `openerMessages = null` and `openerTail = null` in `readStartingContext`; failed with `AssertionError: expected 0 to be greater than 0`.
- **Result:** Exit code 0; passed as part of `startingContext.test.ts` (14/14 tests).
- **Reproduced:** Fresh errand "Reproduce opener tail proof" (`bf0fb1b3-0293-4073-8e5d-6e25f7d78400`) from a clean shell; matched (exit 0, 1 passed).

### C7: Aside gets no tail and is refused `read_parent_messages`

- **Check:** `bun run test packages/service/test/work/offTopic.test.ts -t "keeps it as an aside"`
- **Shown able to fail:** Not run (added after the mutation pass).
- **Result:** Exit code 0; passed as part of `offTopic.test.ts` (16/16 tests), confirming the aside's context omits `# Your opener's conversation` and `Owner:\nWrite the report`, `threads.opener_tail` is null, and `read_parent_messages` returns the aside refusal.
- **Reproduced:** Not run.

### C8: Live desktop window and real Companion behavior

- **Check:** Not run in this environment.
- **Shown able to fail:** Not applicable (human judgment).
- **Result:** Awaiting human judgment.
- **Reproduced:** Not run.

## Regressions

| Check | Command | Starting commit (`210891d5`) | End state |
| --- | --- | --- | --- |
| Lint | `bun run check` | not run | pass (0 errors, 3 pre-existing warnings in untouched files) |
| Typecheck | `bun run typecheck` | not run | pass (all 7 workspaces) |
| Focused tests | `bun run test packages/service/test/work/journal.test.ts packages/service/test/work/replies.test.ts packages/service/test/work/startingContext.test.ts` | not run | pass (3 files, 59/59 tests) |
| Full test suite | `bun run test` | `acpLaunchHygiene.test.ts` fails identically (1/9) | 398 passed, 4 skipped, 1 failed (`acpLaunchHygiene.test.ts`, pre-existing); 3,381 passed, 30 skipped, 1 failed |

The single failure in the full suite (`packages/service/test/harness/acpLaunchHygiene.test.ts > leaves providers without hasIsolatedTempDir on the inherited temp dir`) happens because the test runner itself inherits `TMPDIR=.../outlore-acp-tmp-*` from the Outlore ACP session that launched this agent.
Running `acpLaunchHygiene.test.ts` against the clean starting commit `210891d5` in `.worktrees/verify-opener-tail` reproduced the exact same failure (`expected '.../outlore-acp-tmp-...' not to contain 'outlore-acp-tmp-'`).

## Not proven

- **C7 (unproven):** Now covered by `packages/service/test/work/offTopic.test.ts` (16/16 passed), but added after the worktree mutation pass and fresh-thread reproduction, so it was not mutation-checked.
- **C8 (awaiting human judgment):** Live desktop window verification with a real Companion (opening an errand with a short request like "fix this", checking first-turn context, and seeing the Companion call `read_parent_messages` when it needs older parent messages) was not run and needs the owner's look.

## Reproduce

```sh
bun run check
bun run typecheck
bun run test packages/service/test/work/journal.test.ts packages/service/test/work/replies.test.ts packages/service/test/work/startingContext.test.ts
```

## New files

- `documentation/verification/2026-11-25-opener-tail-and-parent-search.md`
