# Companion preset management verification

Starting revision `ad4740b9` on `worktree/companion-presets`.
The owner's request covers adding custom presets, renaming and deleting presets, and saving a Companion stack from a quest, errand, or realm.
See the [specification](../capabilities/companion-presets/specifications.md).

## Automated checks

The service request tests cover persistence of the primary and ordered backups, duplicate names, a legacy settings save, and clearing a renamed tier on deletion.
The app picker tests cover applying a whole stack and rendering Save as a preset with an empty library.

The commit gate passed workspace typecheck and related tests with 1,941 passing and 56 skipped.
The first full run had one lore timing failure and three settings assertions that the follow-up corrected.

## Live check pending

In **Workshop → Companions → Presets**, add a preset with a primary and two backups, rename it, then choose it in a quest.
Check that both backups appear in order and that a later preset edit or deletion leaves the quest's stack intact.
Rename an assigned built-in preset, check that its label changes in the chooser, then delete it and check that the tier reads as unset.
Open **Companions** in a quest, an errand, and a realm conversation and save their stacks under distinct names.
Try a duplicate name and check that the form stays open with an error.
On a paired device, check that the saved names appear and that a rename there appears on the host.
