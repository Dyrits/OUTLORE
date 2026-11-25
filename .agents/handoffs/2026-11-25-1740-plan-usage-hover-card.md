# Handoff: Plan usage hover card with progress bars

Supersedes: none
Workspace: repository OUTLORE, branch main

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The rail's plan usage shows each provider's logo with one status dot and no rings (CHG-0723), and hovering or focusing a provider opens a card with a progress bar per limit, as the older rings version did. Done means the card shows each window's share left as a bar, its reset time, or "not started", and the owner has seen it in the running app.

## State

- Verified: `apps/app/src/editors/planUsageDots.tsx` restores the card's `WindowBar` and `UsageCard` (flat list of windows, bar in the status colour, "not started" for windows with no reset time). The logo and dot rail is unchanged. Read the file.
- Verified: `bun run typecheck` in `apps/app` exits 0 (run this session, 2026-11-25).
- Verified: `bun test test/editors/planUsage.test.ts` in `apps/app` passes 13 of 13 (run this session).
- Verified: `biome check` on the file is clean (run this session).
- Assumed: the card looks right in a window or on a phone. Not seen in the running app.
- Not included: the card's model-group table (CHG-0723) is removed from the card; `planUsageOf` still supplies the dot's level, and its table data stays in `planUsage.ts`.
- Not in this change: the working tree held other uncommitted edits from other work (`apps/app/src/conversation/entries.ts`, `packages/service/src/work/missionDetail.ts`, `packages/service/test/work/replies.test.ts`, and the untracked `documentation/art-direction/2026-11-25-suggestion-card.html`). They were not staged and are not part of this change.
- No changelog entry was written for this change.

## Decisions

- The card returns to the bars layout the owner preferred. The rail keeps the new logo with its dot, without the rings, as the owner asked.
- Card windows are passed through `currentWindowsOf`, so a window whose reset passed reads as unused.
- The status colours come from the existing `dotColors` map (green, orange, red).

## Next

1. Open the app and hover a provider in the rail; check the bars, the "left" percentage, and the reset text, in a window and on a narrow width.
2. If it looks right, add a changelog entry under the newest version file (`documentation/changelog/0.2.7-Pre-Alpha.md`), citing this change and the CHG-0723 entry it reverts in part.
3. Decide whether the model-group table should come back for limits that have groups (Antigravity), since the flat card lists them as "Gemini Models · Weekly" in full.

## Open questions

- Whether the owner wants the model-group table kept for Antigravity or the flat bars everywhere. Answer: the owner.
- Whether the card width fits long labels such as "Claude and GPT models · 5-hour". Answer: check in the running app.

## Sources

- `apps/app/src/editors/planUsageDots.tsx` (the current card and rail)
- `apps/app/src/editors/planUsage.ts` (`currentWindowsOf`, `leftPercentOf`, `resetsInTextOf`, `planUsageOf`)
- Commit `f4d70d55` (CHG-0723, rings replaced by dots and a table; the previous card is in `f4d70d55^:apps/app/src/editors/planLimitRings.tsx`)
- Commit `0ae6d21c` (CHG-0467, the earlier rings card with bars)
- `documentation/changelog/0.2.7-Pre-Alpha.md` (CHG-0723)
