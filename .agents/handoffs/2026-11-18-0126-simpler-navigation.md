# Handoff: Simpler navigation and appearance

Supersedes: none
Workspace: OUTLORE, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Implement the simpler sidebar and remove the visual elements and destinations listed in CHG-0449. Verify the navigation on desktop and phone.

## State

- Verified by reading the specification and blueprint. They record the agreed navigation and the proposed implementation batches. CHG-0449 includes Gild removal.
- Verified by inspecting the documentation diff on `main`. This change records the agreement and handoff. The app implementation and its acceptance checks are pending.

## Decisions

- The owner confirmed two separate creation buttons, a clickable Realms title, and ordinary quest rows for quests with no realm. The specification records where each action goes.
- The owner removed the Guild Hall hub from scope for now and kept Chronicler in its own right-hand panel.
- The owner asked to remove Gild and defer all implementation to a later session. The specification retains One and Iskios.

## Next

1. Confirm the first implementation batch with the owner. Follow the blueprint and resolve only the open choices needed for that batch.
2. Update the theme plan before removing Gild, including handling saved selections. Check the surviving light and dark looks on desktop and phone.
3. Verify the sidebar and navigation against the specification as each batch lands. Record the owner's visual acceptance in a window and on a phone.

## Open questions

- Decide how to move an existing quest out of a realm without a dedicated sidebar drop target.
- Confirm the blueprint's proposals for the hub's navigation fallback, budget rings, the stored mention token, and Workshop section icons when each becomes relevant.
- Confirm the fallback for a saved Gild selection. The blueprint proposes One, the current default.

## Sources

- `documentation/changelog/0.1.8-Prototype.md`, CHG-0449.
- `documentation/capabilities/mission-tracking/specifications.md#simplified-left-navigation`.
- `documentation/capabilities/mission-tracking/blueprint.md#simplified-sidebar-errands-and-crest-removal-chg-0449`.
- `documentation/work-in-progress.md`, Simpler app.
