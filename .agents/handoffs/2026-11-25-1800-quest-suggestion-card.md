# Handoff: quest suggestion card as a destination list (CHG-0739)

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/OUTLORE, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner found the quest suggestion card ugly and wanted only the first options up front, not the whole Realm and Companion setup.
Done is a card that shows existing quests only when one matches, a one-press new-quest row, setup behind a "Change" link, and old finished or archived quests no longer offered.

## State

- Verified (file read): `documentation/art-direction/2026-11-25-suggestion-card.html` holds three mockups (A one line of setup, B destination list, C split button); the owner chose B.
- Verified (file read): `apps/app/src/conversation/suggestions.tsx` now draws both the Chronicler proposal card and the off-topic card as one bordered list of rows: "Continue" rows for matching quests, the new-quest row (naming realm and Companion, with a Change link that opens the chips and pickers), and for an off-topic message a "Keep here as an aside" row.
- Verified (file read): `packages/service/src/work/matching.ts` skips a Fulfilled or Archived quest whose finish time (`done_at`, else `last_activity_at`) is older than the new setting `endedQuestMatchDays` days; quests named by Chronicler are not filtered.
- Verified (file read): the setting `endedQuestMatchDays` (default 14, positive integer, authority `Ritual`) is in `packages/contracts/src/records.ts`, `packages/service/src/core/settings.ts`, `packages/service/src/core/settingAuthority.ts`, and shown as a number row under Quest upkeep in `apps/app/src/settings/settings.tsx`.
- Verified (commands run 2026-11-25): Biome, `bun run typecheck` in `apps/app` and in `packages/service`, and the tests `offTopic.test.ts` (16, including the new 14-day and setting test), `settings.test.ts`, `changeSettings.test.ts`, `claudeSettings.test.ts`, `claudeWorktrees.test.ts`, `suggestionChoices.test.ts` pass.
- Assumed: the card looks right in the desktop window; nobody has opened it. The sandbox cannot open the app.
- The working tree also held uncommitted changes from other threads (reply line, `entries.ts`, `missionDetail.ts`, `exchangeSamples.ts`, `replies.test.ts`, the 0.2.7 changelog); they are not part of this work.

## Decisions

- Option B, with the list shown only when a quest matches; with no match the card is just the new-quest row (owner, 2026-11-25). The existing setting that opens off-topic quests without any card is unchanged.
- Ended quests older than the limit are ignored for both Fulfilled and Archived, using 14 days as the default and a Settings number so the owner can change it (owner, 2026-11-25). Recorded in CHG-0739 and `documentation/capabilities/thread-tree/specifications.md` (Off-topic requests).
- Archived quests have no stored archive time, so their last activity stands in for it.

## Next

1. Open the desktop app, trigger an off-topic message and a Chronicler proposal, and check the card in each theme, with and without a matching quest, and with Change open; adjust spacing or colors if needed.
2. Confirm with the owner whether finished quests should instead be ignored at once (set the setting to 1), or whether the default should change.
3. Record the owner's acceptance in CHG-0739 (its Validation line says the window check is pending).

## Open questions

- Does the owner want the same destination-list treatment for other cards, such as the Ritual proposal? The owner can answer.

## Sources

- `documentation/art-direction/2026-11-25-suggestion-card.html`
- `documentation/changelog/0.2.8-Pre-Alpha.md` (CHG-0739)
- `documentation/capabilities/thread-tree/specifications.md` (Off-topic requests)
- `apps/app/src/conversation/suggestions.tsx`, `apps/app/src/settings/settings.tsx`
- `packages/service/src/work/matching.ts`, `packages/service/test/work/offTopic.test.ts`
