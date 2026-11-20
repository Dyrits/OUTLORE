# Handoff: Release review follow-through

Supersedes: `2026-11-20-1950-review-since-0-1-12.md`
Workspace: Outlore, `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Complete the review since `0.1.12-Prototype` by verifying the delivered fixes in the desktop app and resolving the remaining review findings.

## State

- Verified in Git: the review starts from `9ebc92e3..f5aa6455`, and `4c24ac91` contains the initial reply-anchor and Fulfilled errand notch fixes.
- Verified in Git: `main` was fast-forwarded through both follow-through commits, `896d3aa0` and `5cbf39b7`.
- Recorded checks: 690 tests passed with eight skipped on `896d3aa0`; the second batch passed the workspace typecheck, Biome and focused pane and harness checks.
- Recorded scope: CHG-0608 covers Chronicle unread tracking, filters, grouping and review fixes; CHG-0609 covers pane and Companions layout extraction, specification updates and deterministic wake tests.
- Verified by matching file hashes: the local edits to `styles.ts` and `questions.tsx` stayed in the checkout, and the overlapping `chronicleActivity.tsx` edit is preserved in local stash `b66ff59fa` (“Chronicle local edit before review follow-through”).

## Decisions

- CHG-0605 limits title selectors to the current realm or quest.
- A Fulfilled errand remains readable when open and leaves no edge notch when folded.
- The Chronicle entry currently opens its conversation; focusing the specific message or request remains open.

## Next

1. In a desktop window, open a Fulfilled errand from the Errands tab, fold it and confirm it can still be reopened from the tab.
2. Check the Chronicle badge, filters and grouped rows, and the shared Companions layout in the desktop window.
3. Use the recorded Chronicle targets to finish opening the relevant message or request, and verify reminder timing and reappearance against the specification.
4. Review the remaining oversized-file splits and STD-B-01, and have the original review errands recheck the applicable fixes.

## Open questions

- The owner still needs to decide whether a realm channel keeps its Realm tab and whether Chronicler's own channel conversations belong in the Chronicle unread feed.
- The desktop appearance and interaction checks remain pending.

## Sources

- [Release changelog](../../documentation/changelog/0.1.13-Prototype.md), CHG-0607 through CHG-0609.
- [First-batch verification](../../documentation/verification/2026-11-20-review-follow-through.md) and [follow-through recheck](../../documentation/verification/2026-11-20-review-follow-through-recheck.md).
- [Conversation pane specifications](../../documentation/capabilities/conversation-panes/specifications.md).
- The seven review reports are in the quest conversation titled “Review and refactor since 0.1.12” and were copied to `/tmp/claude-501/review-refactor/reports/`.
