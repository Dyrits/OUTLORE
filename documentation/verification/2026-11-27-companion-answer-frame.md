# Proof: Companion answers framed under their tagged message

- **Verdict:** proven for logic, contract, search, Chronicle targeting, and service flagging; awaiting human judgment for desktop and phone visual layout
- **Work:** branch `mission/companion-answer-grouped-under-its-messa-c2182b35` from `29741c18`
- **Agreement:** owner's request in quest "Companion answer grouped under its message" (2026-11-27): group a tagged Companion's answer under the message it was tagged on, inside a frame; [thread-messaging specifications](../capabilities/thread-messaging/specifications.md#mentioning-a-companion-with-)
- **Environment:** macOS (Darwin), Bun, Biome, TypeScript, and Vitest from the repository; no desktop window or phone was driven.
- **Date:** 2026-11-27

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | The host flags only Companion answers with optional `isCompanionAnswer` on `Message` | contract, specifications | proven by service test |
| C2 | `entriesOf` attaches Companion answers under their tagged message in chronological order, carrying anchored reply lines, and leaves non-Companion `replyToMessageId` messages standalone | specifications | proven by unit tests |
| C3 | When the tagged message is not drawn (such as a pinned root), the answer stands alone right after that message's time with Companion tokens stripped from `replyToText` | specifications | proven by unit tests |
| C4 | Conversation search and Chronicle targeting find answers inside a frame at their carrying entry | specifications | proven by unit tests |
| C5 | `EntryView` draws the tagged message and its answers inside a softly rounded, bordered frame (`exchangeFrame`) without the redundant "Replying to" line on answers, readable in light and dark themes | request, specifications | awaiting human judgment |
| C6 | No workspace typecheck, lint, or conversation/companion regression | repository checks | proven |

## Evidence

### C1: Host flag `isCompanionAnswer`

- **Check:** `CI=1 bun run test packages/service/test/work/companions.test.ts` (11 tests passed), asserting `reply?.isCompanionAnswer` is `true` and only the single Companion answer in the thread carries `isCompanionAnswer === true`.
- **Result:** pass.

### C2, C3, C4: Grouping, fallback, search, and Chronicle targeting

- **Check:** `CI=1 bun run test apps/app/test/conversation` (22 files, 139 tests passed), including 8 new tests in `apps/app/test/conversation/companionAnswers.test.ts` covering ordering across intervening messages, multiple answers on one message, pinned-root fallback with stripped `@companion:` tokens, unknown tagged message fallback, non-Companion anchored replies, anchored reply lines carried on answers, `matchingMessages`, and `targetIndexOf`.
- **Result:** pass.

### C5: Frame appearance

- **Check:** reviewed `apps/app/src/conversation/conversationEntries.tsx` and `apps/app/src/foundation/messageStyles.ts` (`exchangeFrame` using `colors.border`, `radii.xl`, `borderWidth: 1`, `paddingHorizontal: 10`, `paddingVertical: 4`, `marginVertical: 8`).
- **Result:** code review only; visual check in a real desktop window and on a phone (light and dark themes) is pending.

## Regressions

| Check | Command | Result |
| --- | --- | --- |
| Lint and format | `bunx biome check` on the 10 touched code/test files | pass (10 files clean) |
| Workspace typecheck | `bun run typecheck` (all 7 workspaces) | pass |
| Focused tests | `CI=1 bun run test apps/app/test/conversation packages/service/test/work/companions.test.ts` | pass (23 files, 150 tests) |

## Not proven

- Desktop window and phone rendering of `exchangeFrame` in light and dark themes, with one and multiple `@` mentions, and with anchored replies hung from an answer.
- End-to-end live harness turn showing the frame in a running app.

## Reproduce

```sh
bunx biome check apps/app/src/conversation/chronicleTarget.ts apps/app/src/conversation/companionAnswers.ts apps/app/src/conversation/conversationEntries.tsx apps/app/src/conversation/conversationSearch.ts apps/app/src/conversation/entries.ts apps/app/src/foundation/messageStyles.ts apps/app/test/conversation/companionAnswers.test.ts packages/contracts/src/threadRecords.ts packages/service/src/work/missionDetail.ts packages/service/test/work/companions.test.ts
bun run typecheck
CI=1 bun run test apps/app/test/conversation packages/service/test/work/companions.test.ts
```

## New files

- `apps/app/src/conversation/companionAnswers.ts`
- `apps/app/test/conversation/companionAnswers.test.ts`
- `documentation/verification/2026-11-27-companion-answer-frame.md`
