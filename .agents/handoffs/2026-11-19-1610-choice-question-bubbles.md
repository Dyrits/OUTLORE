# Handoff: Choice questions as chat bubbles with the answers attached

Supersedes: none
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS, branch `main` (built in an errand's own copy on `mission/diff-view-for-modified-files-c8b345f5`, rebased onto `origin/main` at `d31a63a`, then pushed to `main` on the owner's word)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner saw a choice question (Claude Code's AskUserQuestion, CHG-0299) as two muted lines in a turn's folded steps, with the question cut off and the answer not visible. They asked for it in the chat: one agent bubble per question asked, with the owner's answer attached. Done is: built, tested, recorded, merged, and the owner's look at it in a window and on a phone.

## State

- Built, committed and pushed to `main` (CHG-0535 in the 0.1.12-Prototype changelog; the commit is the one named CHG-0535 in `git log`; the changelog conflict with CHG-0531 and CHG-0534 was resolved by keeping both entries):
  - `apps/app/src/conversation/choiceBubbles.ts` (pure view of each choice: options with `isChosen`, own words apart from the options, outcome Answered/Skipped/Withdrawn), `choiceBubbleViews.tsx` (the bubbles, `ChoiceBubbles`).
  - `entries.ts`: `isFoldedAction` no longer folds a question with choices, so a settled choice question is a `Question` entry, not a step. `conversationEntries.tsx`: the `Question` branch draws a settled choice question as `ChoiceBubbles`; an open one is still `QuestionCard`.
  - `packages/service/src/work/activities.ts`: `AskUserQuestion` is left out of `callDescriptionOf`, and `listThreadActivities` hides rows of it stored earlier (no migration).
  - Specification: `action-approval/specifications.md`, Choice questions, "In the conversation, as bubbles".
- Verified 2026-11-19, before the rebase onto `d31a63a`: Biome clean on the touched files; `bun run typecheck` passes on all workspaces; `apps/app` tests: 79 files, 568 passed, 6 skipped; `packages/service` `test/harness/claude.test.ts` and `test/work/activities.test.ts` pass (the other `test/work` failures are the 20 known sandbox `git init` ones: approvalsFolders, folderPicker, ownCopies, workspaceEntries).
- Not verified: the look in a window or on a phone (an attempt to render the component through react-native-web outside the app's own build failed on an unrelated syntax error, so nothing was drawn); the full suite; light, dark and the other looks (the bubbles use the same card, chip and text styles as the agent's replies and the open dialog, so they follow the theme).
- Overlap with the other errand ("Diff of modified files in steps", still on its own branch, not merged): `apps/app/src/conversation/entries.ts` (the `isFoldedAction` condition only, one added line, comment edited) and `conversationEntries.tsx` (the `Question` branch of `EntryView` and one import). `stepsGroup.tsx` and `stepLabels.ts` are untouched. That errand rebases onto `main` and may conflict there.

## Decisions

All mine, none confirmed by the owner:
- The answer sits inside the bubble: chosen options filled, unchosen faded (label only), the chosen options' descriptions below, own words as a filled chip, a foot line "Answered · 03:55 PM · Mac Mini".
- Multiple choice fills every option chosen; Skipped and Withdrawn show every option faded with the foot line saying which.
- The bubble's name is the harness's (a question records no model).
- A waiting question keeps its card; it turns into bubbles when settled.
- Old "Use AskUserQuestion" rows are hidden, not deleted.

## Next

The owner's look in a window and on a phone. If the open dialog should also be a bubble, `ChoiceCard` in `apps/app/src/ui/questions.tsx` is shared with the dashboard's open-questions list, so a bubble frame would go around it only inside the conversation (`EntryView`).

## Open questions

- Whether the answer should be a bubble of the owner's own on the right instead of inside the agent's bubble.
- Whether unchosen options should be hidden once answered.
None beyond the two above.

## Sources

- `apps/app/src/conversation/choiceBubbles.ts`, `choiceBubbleViews.tsx`, `entries.ts`, `conversationEntries.tsx`
- `packages/service/src/work/activities.ts`
- [Changelog 0.1.12-Prototype](../../documentation/changelog/0.1.12-Prototype.md), CHG-0535
- [Specification](../../documentation/capabilities/action-approval/specifications.md#choice-questions)
