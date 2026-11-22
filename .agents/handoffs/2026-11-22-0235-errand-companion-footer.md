# Handoff: Errand draft Companions footer

Supersedes: none
Workspace: OUTLORE, targeting `origin/main` from `worktree/errand-footer-landing`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Verify in the desktop window that a new errand shows its model and effort at the foot of both the Missives and Companions tabs.

## State

- Verified by range-diff: the CHG-0631 picker fix and CHG-0632 Vault test fixture fix retain their code changes after rebasing. The rebase preserves the upstream changelog and work-in-progress entries.
- The desktop window check is pending. See the work-in-progress entry for the earlier automated results.

## Decisions

The Companions footer and the full picker read the same draft settings. The composer stays mounted across tab changes so typed text survives. The compact picker labels Default effort explicitly.

## Next

1. Open a new errand in the desktop app. Type a draft message and select a model and High effort on Companions. Check the selected compact picker at the foot of the pane.
2. Press the compact picker to return to Missives. Check that the draft text and chosen model and effort are still there. Repeat with Default effort and check that the compact picker shows Default in both tabs.
3. Record the desktop result in the work-in-progress entry.

## Open questions

Does the desktop layout show the selected footer correctly at the window sizes used by the owner?

## Sources

- [Work in progress](../../documentation/work-in-progress.md)
- [Release changelog](../../documentation/changelog/0.2.2-Pre-Alpha.md)
- [Draft layout regression test](../../apps/app/test/conversation/openThreadForm.test.ts)
- [Effort label regression test](../../apps/app/test/editors/companionPicker.test.ts)
