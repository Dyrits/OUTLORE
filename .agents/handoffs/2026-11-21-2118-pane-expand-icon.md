# Handoff: Pane expand icon

Supersedes: none
Workspace: The Outlore repository at /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS, branch `main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Make the pane fullscreen control visually distinct from the quest completion checkbox by using outward and inward symbols. Commit and push the finished change to `main`.

## State

- Verified by reading the diff: `apps/app/src/shell/paneHost.tsx` uses `⛶` to expand and `⤡` to restore the pane layout.
- Verified by `git diff --check`: no whitespace errors.
- The checkbox was restored to its original shape; only `paneHost.tsx` is modified for the code change.
- Commit and push remain to be completed; push approval is required.

## Decisions

- Keep the outward fullscreen glyph and use a diagonal inward-arrow symbol for restore; the checkbox itself stays unchanged.

## Next

1. Obtain approval to push to the shared `main` branch.
2. Commit the icon change and this handoff with the repository's required provider/model signature.
3. Push the commit to `origin/main` after approval.

## Open questions

- Whether the glyph pairing looks right in the running desktop app remains for the owner's visual review.

## Sources

- `apps/app/src/shell/paneHost.tsx`
- `apps/app/src/ui/questHeaderButtons.tsx`
