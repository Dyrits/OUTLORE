# Handoff: sidebar quest rows

Supersedes: `2026-11-19-1050-quest-fold.md`
Workspace: `.worktrees/quest-fold`, branch `worktree/quest-fold`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep the fold control visible on quests with errands and limit how many rows the sidebar previews. Verify both changes in the desktop window.

## State

Verified by Git inspection and the combined diff: CHG-0635 and CHG-0636 are integrated on `worktree/quest-fold`. Before rebasing onto `409b002f`, Biome, the workspace typecheck, and all 170 app shell tests passed on the combined code. The desktop window check is pending. The overflow record contains the earlier full-suite result, including seven Vault failures reproduced at the original base.

## Decisions

The selected quest gets first priority for the four available rows, followed by running quests. Visible quests keep their placement order. The errand limit counts unfolded rows, including nested errands. Sidebar filters belong to a later batch.

## Next

1. In the desktop window, move the pointer away from a collapsed quest with errands and confirm the chevron stays visible. Toggle it and check that a quest without errands has an empty slot.
2. Check a realm and the Borderlands with more than four quests. Verify the row limit, selection priority, and **Show all**.
3. Expand a quest with three unfolded errands. Verify two preview rows and confirm that **Show 3 errands** opens the Errands tab. Fold the quest and confirm the link disappears. Check that one or two rows appear on their own.

## Open questions

None.

## Sources

- [Combined work in progress](../../documentation/work-in-progress.md)
- [Release changelog](../../documentation/changelog/0.2.2-Pre-Alpha.md) (CHG-0635 and CHG-0636)
- [Overflow verification](../../documentation/verification/2026-11-22-sidebar-overflow.md)
- Original commits `8b3cec11` and `d44c11cd`
