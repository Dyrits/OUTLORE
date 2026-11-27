# Proof: In-frame Companion follow-ups, opt-in context, and side-chat jump menu

- **Verdict:** proven for migration, contracts, service follow-up and opt-in context behavior, client grouping, and side-chat jump list; awaiting human judgment for desktop and phone UI
- **Work:** branch `mission/companion-answer-grouped-under-its-messa-c2182b35` (CHG-0787 on top of CHG-0786)
- **Agreement:** owner's `$iterate` answers ("Yes to all", 2026-11-27): inline follow-up inside the frame addressing its Companions by default (allowing `@` to pull in more), private by default with opt-in **Add to context** / **Update context** (passive, never waking the main Companion), and a conditional jump menu in the conversation bar; [thread-messaging specifications](../capabilities/thread-messaging/specifications.md#mentioning-a-companion-with-)
- **Environment:** macOS (Darwin), Bun, Biome, TypeScript, and Vitest from the repository; no desktop window or phone was driven.
- **Date:** 2026-11-27

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | Framed exchanges stay out of the main Companion's context until `ShareCompanionFrame` is called, and sharing never wakes the main Companion | Q2, Q3, specifications | proven by service test |
| C2 | Follow-ups via `SendMessage.frameMessageId` address existing frame Companions without re-typing `@`, allow `@` to add another Companion, attach `companionFrameId`, and mark a shared frame `"Outdated"` until shared again | Q1, Q2, specifications | proven by service test |
| C3 | Client `entriesOf` groups follow-up owner messages and their answers inside the opening message's frame in order, and `sideChatsOf` lists framed side conversations newest-first with stripped previews, counts, and context states | Q1, Q4, specifications | proven by unit tests |
| C4 | `ExchangeFrame` inline follow-up box, context controls, and `SideChatsMenu` popover render and behave cleanly in light and dark themes | Q1–Q4 | awaiting human judgment |
| C5 | No lint, workspace typecheck, or conversation/companion regression | repository checks | proven |

## Evidence

- `bunx biome check` on all 18 touched files: pass.
- `bun run typecheck` across all 7 workspaces: pass.
- `CI=1 bun run test apps/app/test/conversation packages/service/test/work/companions.test.ts packages/service/test/work/companionQuests.test.ts`: 24 files passed, 162 tests passed.

## Not proven

- Desktop window and phone rendering and interaction of the inline **Follow up** input, **Add to context** / **Update context** buttons, and **N side chat(s)** jump popover in light and dark themes.

## Reproduce

```sh
bun run typecheck
CI=1 bun run test apps/app/test/conversation packages/service/test/work/companions.test.ts packages/service/test/work/companionQuests.test.ts
```

## New files

- `apps/app/src/conversation/exchangeFrame.tsx`
- `apps/app/src/conversation/sideChats.ts`
- `apps/app/src/conversation/sideChatsMenu.tsx`
- `documentation/verification/2026-11-27-companion-frame-follow-ups.md`
