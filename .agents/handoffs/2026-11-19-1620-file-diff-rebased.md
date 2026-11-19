# Handoff: File diffs in steps

Supersedes: `2026-11-19-1615-file-diff-in-steps.md`
Workspace: OUTLORE, branch `mission/diff-view-for-modified-files-9978e8a0`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Publish the file diff work on main and follow up on the remaining visual and harness checks.

## State

Verified: commit `0bf4c2a` rebased the diff work onto `7aa2d2a`; migration 0061 preserves main's 0060 and the activity query retains the choice-question filter. Typecheck and 52 focused tests passed after conflict resolution. Earlier verification is recorded in the verification note.

## Decisions

The diff is stored locally, capped at 64 KB, read on demand, and deleted with the thread. See the specification and changelog for the agreed behavior.

## Next

1. Check the branch and remote main, complete publication if still pending, and inform the parent quest.
2. Check the diff in a window and on a phone with the owner, and test a live Claude Code Write.

## Open questions

Allowed actions lack diffs; failed edits can show them. NotebookEdit, Codex, OpenCode and Vibe remain unsupported. The size caps and a race-free Write source remain open. Dark and other looks have not been seen.

## Sources

- `documentation/verification/2026-11-19-file-diff.md`
- `documentation/capabilities/action-approval/specifications.md`
- `documentation/changelog/0.1.12-Prototype.md`
- `.agents/handoffs/2026-11-19-1615-file-diff-in-steps.md`
