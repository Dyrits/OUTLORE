# Handoff: Daily background check-ins

Supersedes: none
Workspace: Outlore, `worktree/background-check-ins`, starting revision `f5e50adb`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish opt-in daily check-ins that review selected realms and post linked quest updates in their Missives when there is something to report.

## State

- Verified through the settings requests. The host saves selected realms, local time, Companion, and an optional paid fallback. Pausing retains the setup. An older client's settings save preserves the check-in settings.
- Verified with `bun run check`, `bun run typecheck`, and `CI=1 bun run test` on the settings slice. The full suite passed with 2,714 tests and 64 skips.
- Verified in the implementation diff. The Workshop controls, daily scheduler, model review, and linked check-in Missives are pending. CHG-0639 already supplies independent inactivity warnings.

## Decisions

- CHG-0633 defines the owner-controlled scope, schedule, and Companion. The settings are initially unset and only the owner can change them.
- Check-ins need inference with tools disabled. The existing Ritual runner starts ordinary agent turns, although its local-time calculation can be reused.

## Next

1. Confirm first-release Companion support. The proposed first slice uses one verified Companion that can run with tools disabled. Verify provider terms and quota before offering built-in free inference.
2. Add the daily host scheduler and Workshop controls. Report qualifying developments as linked Missives and surface Companion availability or quota failures in the Workshop.
3. Use the controlled clock and a stand-in Companion to verify selection, pause, unchanged input, linked delivery, and explicit paid fallback. Review the Workshop and quest links on desktop and a paired device.

## Open questions

- The owner has yet to choose between one Companion in the first build and support across all Companions.
- No provider has been selected for built-in free inference.

## Sources

- [Check-in specification](../../documentation/capabilities/background-check-ins/specifications.md) and [provider questions](../../documentation/capabilities/background-check-ins/draft.md)
- [Implementation state](../../documentation/work-in-progress.md) and [settings tests](../../packages/service/test/changeSettings.test.ts)
- [Ritual scheduling](../../packages/service/src/work/ritualSchedule.ts) and [inactivity notices](../../packages/service/src/work/inactivityMissives.ts)
