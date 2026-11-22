# Handoff: Ritual tabs and manual runs

Supersedes: `2026-11-22-0146-ritual-conversation-tools.md`
Workspace: Outlore at /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS on `main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state gets a new handoff.

## Goal

Make Rituals easy to find and run from their realm or the Borderlands. Verify the navigation and controls in the running app.

## State

- Verified in Git: `8ac19c85` implements dedicated Ritual tabs, crescent icons for Ritual panes, and Run now in the header. The changelog records this as CHG-0638: CHG-0629 went to Codex Full access and CHG-0630 to notch titles on hover.
- The implementing errand reported 26 affected tests, the desktop build, and Expo web export passed. The desktop and phone visual checks are pending.
- The earlier conversation tools and Add Ritual icon are on main at `04cc66ee`. Live-harness creation and editing approval still need a check.

## Decisions

- Rituals have a dedicated tab in realm and Borderlands panes. Each Ritual has its own details tab and crescent identity.
- Run now leaves an off schedule off.

## Next

1. In the desktop app and on a paired phone, open the Rituals tab, open a Ritual, and check the details tab and crescent. On desktop, fold the pane and inspect its shortcut.
2. Run a Ritual with its schedule off from the header. Check that its history shows the new run and that its schedule remains off.
3. Check the Add Ritual icon and approve a creation and an edit from live conversations.

## Open questions

- Sub-hour schedules with daily time windows remain a separate product decision.

## Sources

- [Rituals specification](../../documentation/capabilities/rituals/specifications.md)
- [Release changelog](../../documentation/changelog/0.2.2-Pre-Alpha.md)
- [Pending desktop and phone checks](../../documentation/work-in-progress.md)
- [Ritual row tests](../../apps/app/test/rituals/ritualRow.test.ts)
