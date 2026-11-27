# Proof: Companion usage-limit refusal by model group, and the review-refactor round

- **Verdict:** proven for the refusal rule, the frame guards, and the saved-before reads; awaiting human judgment for the `@` picker in the inline Follow up box
- **Work:** branch `mission/companion-answer-grouped-under-its-messa-c2182b35`: `81ec4c1d` (CHG-0786), `c33e7e3e` (CHG-0787), `84ba5a70` (CHG-0788), and the review-refactor layer (STD-1 to STD-16, SPEC-1 to SPEC-5) above them
- **Agreement:** the owner's `$debug` report in the quest "Companion answer grouped under its message" (2026-11-27: a Gemini Companion was refused while only the "Others" window was used up), the review findings of 2026-11-27, and [thread-messaging specifications](../capabilities/thread-messaging/specifications.md#mentioning-a-companion-with-)
- **Environment:** macOS (Darwin), Bun 1.4.4, Vitest 5.1.1 through Electron, Biome; the fake harness stands in for Antigravity; no live `agy` turn, desktop window, or phone was driven
- **Date:** 2026-11-27

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | A Gemini Antigravity Companion is not refused while only the "Others · Weekly" window is used up | owner's `$debug`, specifications | proven |
| C2 | A Claude or GPT model is refused by that window, with its reset time | specifications | proven |
| C3 | A used-up "Gemini · Weekly" window refuses a Gemini model | specifications | proven |
| C4 | Several used-up windows that cover the model report the latest reset | specifications | proven |
| C5 | An ungrouped window still covers every model of its harness, as before | specifications | proven |
| C6 | A follow-up merges the frame's Companions with new `@` mentions, deduplicating and capping the combined targets at five | CHG-0787 agreement | proven |
| C7 | A `SendMessage` with an unknown `frameMessageId` is rejected even when the text holds `@` tokens, and so is `ShareCompanionFrame` | review SPEC-2 | proven |
| C8 | A row saved before migration 0083 (null `frame_message_id`, already delivered to a turn) reads as Shared, and a follow-up on it still finds its Companion | review SPEC-3, conventions (saved before) | proven |
| C9 | The inline Follow up box opens the `@` mention picker and inserts Companion chips | review SPEC-1 | awaiting human judgment |
| C10 | The review refactors preserve the framed-answer and follow-up behavior, and the repository checks pass on the end state | review round | proven |

## Evidence

### C1 to C5: the refusal rule

- **Check:** `CI=1 bun run test packages/service/test/work/companionRefusals.test.ts packages/service/test/harness/antigravityPlanLimits.test.ts` (9 and 6 tests), covering the owner's three-window reading (Gemini weekly partly used, Gemini 5-hour partly used, "Others" weekly at 100%), the non-Gemini refusal on "Others", the Gemini refusal on a used-up Gemini window, the latest reset of several used-up windows, and the ungrouped Codex window.
- **Shown able to fail:** the errand's recorded run on the starting commit `743f7690`: "does not refuse a Gemini model for the used-up limit of the other model group" received "Cannot answer: its usage limit is reached (resets at 12:08 PM)", and "tells the latest reset when several of its limits are used up" expected "Dec 2"; both pass after the fix.
- **Result:** pass on the end state (within the 179 tests below).

### C6: dedupe and the five cap

- **Check:** "deduplicates existing Companions and caps combined follow-up targets at five" in `packages/service/test/work/companionFrames.test.ts`.
- **Shown able to fail:** in a throwaway worktree at the pre-refactor tip `84ba5a70`, raising the cap (`combined.length >= 5` to `>= 6` in `companionAsking.ts`) fails the test ("expected [ ... ] to have a length of +0 but got 1").
- **Result:** pass on the end state.

### C7: an unknown frame is rejected

- **Check:** "rejects an unknown frameMessageId on SendMessage even with @ mentions, and on ShareCompanionFrame" in `companionFrames.test.ts`.
- **Shown able to fail:** at `84ba5a70` the test fails on every retry, because the guard sat after merging the mentions, so a mention bypassed it; on the end state the guard sits before the merge.
- **Result:** pass on the end state.

### C8: rows saved before 0083

- **Check:** "reads pre-0083 rows with null frame_message_id and already-delivered context as Shared" in `companionFrames.test.ts`, which rewrites an answered exchange to the pre-migration shape (`frame_message_id = NULL`, `is_context_shared = 0`, `context_turn_id` set) and follows up on it.
- **Shown able to fail:** at `84ba5a70` the test fails ("expected 'None' to be 'Shared'"); the end state backfills already-delivered rows in migration 0083 (`UPDATE companion_exchanges SET is_context_shared = 1 WHERE context_turn_id IS NOT NULL`) and reads them as shared.
- **Result:** pass on the end state.

### C9: the `@` picker in the follow-up box

- **Check:** `ExchangeFrame` renders the shared `Composer` with `mentions` (`apps/app/src/conversation/exchangeFrame.tsx`), so typing `@` in the box should offer the Companions list as in the conversation composer.
- **Result:** code review only; typing `@` in the box has not been driven in a real window or on a phone.

### C10: the refactor round

- **Check:** the focused suites below on the end state, including the split files (`companions.test.ts` 105 lines, `companionFrames.test.ts` 203, `companionRefusals.test.ts` 172) and the extracted `threadMessages.ts` (97 lines; `missionDetail.ts` now 194), plus the CHG-0788 commit's related-test gate (197 files, 1,646 passed, 14 skipped), which ran against the same working tree.
- **Result:** pass.

## Regressions

| Check | Command | Starting state | End state |
| --- | --- | --- | --- |
| Format and lint | `bunx biome check` on the 30 touched files | not run | pass, 0 warnings (after removing a stray `import type { readCards }` the extraction left in `threadMessages.ts`) |
| Workspace typecheck | `bun run typecheck` (7 workspaces) | pass (recorded by the errands on their branches) | pass, exit 0 |
| Focused tests | `CI=1 bun run test` on the five companion suites and `apps/app/test/conversation` | pass (recorded, 24 files / 162 tests by the errand) | pass, 28 files / 179 tests |

## Not proven

- A live Antigravity turn: send one Gemini turn and one Claude or GPT turn on the account whose "Others" window is used up.
- The `@` picker in the inline Follow up box in a real window, and (carried from the two earlier records) the frame's look on the desktop and the phone in light and dark themes.

## Reproduce

```sh
CI=1 bun run test packages/service/test/work/companions.test.ts packages/service/test/work/companionFrames.test.ts packages/service/test/work/companionRefusals.test.ts packages/service/test/harness/antigravityPlanLimits.test.ts packages/service/test/work/companionQuests.test.ts apps/app/test/conversation
bun run typecheck
bunx biome check apps/app/src/conversation apps/app/src/foundation/messageStyles.ts apps/app/test/conversation packages/contracts/src packages/service/src/core/latestStoreMigrations.ts packages/service/src/harness packages/service/src/work/companionAsking.ts packages/service/src/work/companionExchanges.ts packages/service/src/work/companionRefusals.ts packages/service/src/work/messagesHandlers.ts packages/service/src/work/missionDetail.ts packages/service/src/work/threadMessages.ts packages/service/test/fixtures packages/service/test/harness packages/service/test/work
```

## New files

- `documentation/verification/2026-11-27-companion-usage-limit-by-model-group.md` (this record)
