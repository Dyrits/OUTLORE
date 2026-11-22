# Handoff: Ritual release verification

Supersedes: `2026-11-22-0202-ritual-navigation.md`
Workspace: Outlore at /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS on `main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state gets a new handoff.

## Goal

Confirm Ritual navigation, manual runs, and creation and editing approvals in a current running build.

## State

- Verified with `git ls-remote` that remote `main` contains the Ritual batch at `45a12d1a`. The landing recorded a passing workspace typecheck, Biome check, and full suite with 2,706 passed and 68 skipped.
- Verified again at `45a12d1a` with `CI=1 bun run test apps/app/test/rituals apps/app/test/shell/navigation.test.ts packages/service/test/work/guildmasterRituals.test.ts packages/service/test/work/ritualSchedulingAndEditing.test.ts`. All 34 tests passed.
- The installed desktop window refused Computer Use access. This live session's tool schema still describes creation as restricted to Chronicler and lacks the edit tool. Desktop, paired-phone, and live approval checks remain open.

## Decisions

- Use a disposable Ritual in a test realm for live checks. Keep its schedule off during the manual run check.

## Next

1. Use a running build that includes `45a12d1a` and a fresh conversation. Confirm that a realm can propose creation and that quests and errands can propose creation and same-realm edits. Verify the approval card and the result of approval or denial.
2. On desktop and a paired phone, check the Rituals tab, the Ritual details tab, and the crescent. On desktop, check the plus inside the Add Ritual crescent and the crescent on the folded pane.
3. Use **Run now** with the schedule off. Confirm that the run appears in the Ritual's history and its schedule stays off.

## Open questions

- The mail recap's 15-minute cadence within a daily window remains a separate scheduling decision.

## Sources

- [Rituals specification](../../documentation/capabilities/rituals/specifications.md)
- [Work in progress](../../documentation/work-in-progress.md)
- [GitHub checks for the Ritual landing](https://github.com/Dyrits/OUTLORE/actions/runs/44973222762)
