# Handoff: Missives, reply-line samples, the realm's Quests tab, the Chronicle's Activity layout

Supersedes: `2026-11-20-0847-conversation-panes-blank-panel-fix.md` for the desktop pane UI (its blank-panel fix, CHG-0570, stands and is committed as `0f549858`).
Workspace: Outlore, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Confirm with the owner what they saw in the window before changing the look. Never edit this file: a later state goes into a new handoff.

## Goal

The owner's next batch on the desktop panes (CHG-0571): rename the quest's Messages tab to Missives; quote the last exchange in each reply line as a block, in the Slack-thread manner; give a realm's channel a Quests tab in its own pane; lay out the Chronicle as Slack's Activity tab with a rule under its title.

## State

- Built and checked here, not seen in a window: the Missives tab label (`conversation/paneThread.tsx`, shared `conversation/paneTabs.tsx`); the sample blocks (`conversation/replyLine.tsx`: `ReplyCard` with a `sample`, `ReplyLine`, `QuestCard`, `QuestReplyLine`); the service's `lastExchange` on `ThreadSummary` and `MissionSummary` (`packages/service/src/work/exchangeSamples.ts`, `missionDetail.ts`, `missions.ts`; contracts `exchanges.ts`); the channel's tabs (`shell/channelPane.tsx` `ChannelBody`, `conversation/guildmaster.tsx` takes `tabs` and `alternateBody`) and the Quests list (`shell/channelQuests.tsx`); the Chronicle rows (`shell/chronicleActivity.tsx`).
- Contracts: the context gauge's schemas moved to `packages/contracts/src/contextGauge.ts` because the two summary fields would have taken `records.ts` (510 lines at HEAD) past the 512 hard limit; it is 492 now.
- Checks: `bun run typecheck` passes; Biome clean on the touched files; `packages/service/test/work/exchangeSamples.test.ts` passes (3); `apps/app/test` 83 files, 651 passed; full suite 2,530 passed, 28 failed, all sandbox `git init` in folder, worktree and own-copy tests.
- Not verified: how the blocks, the Quests list and the Chronicle rows look; the phone and the narrow pane; a live harness turn.
- The CHG-0570 repair was committed as `0f549858` while this batch was in progress (not by this session). This batch's edits to `AGENTS.md`, the 0.1.13 changelog and `work-in-progress.md` are unstaged on top of it, and nothing here is committed.

## Decisions

- "Missives" is the tab's name; the service and contracts keep "message" (glossary term Missive, CHG-0571).
- A realm's Quests tab is part of the channel pane, not a pane of its own (the owner's words).
- The sample is the owner's latest message ("You") and the companion's latest reply ("Companion"), each 160 characters, read per thread in the summary, not by a further read.
- The Quests list sorts by the quest's last activity, latest first, and shows every quest of the realm (or the Borderlands) the mission list holds.

## Next

1. The owner's window check: the Missives label, the blocks in a quest's Missives and a channel's conversation, the Quests tab, the Chronicle rows and the rule under its title; in dark and light, at a wide and a narrow width.
2. Adjust density and the speaker names from the owner's words ("You", "Companion").
3. Commit when the owner asks (the staged CHG-0570 work and this batch's files are separate changes; the commit is the owner's to direct).
4. Chronicle attention feed filters and History (CHG-0569) are still not in the Activity layout's data: unread state is not in `ChronicleItem`.

## Open questions

- Whether "Companion" or the harness name should label the reply's speaker.
- Whether the Quests list should group by state as the Errands tab lists them.
- Whether the sample should show the owner's message when the last message from the owner was a queued steer.

## Sources

- [Changelog](../../documentation/changelog/0.1.13-Prototype.md), CHG-0571
- [Verification](../../documentation/verification/2026-11-20-missives-samples-quests-tab.md)
- [Specification](../../documentation/capabilities/conversation-panes/specifications.md) (the three levels, reply line blocks, the Chronicle)
- `apps/app/src/conversation/replyLine.tsx`, `apps/app/src/shell/channelPane.tsx`, `apps/app/src/shell/channelQuests.tsx`, `apps/app/src/shell/chronicleActivity.tsx`, `packages/service/src/work/exchangeSamples.ts`
