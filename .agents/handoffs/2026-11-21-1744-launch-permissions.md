# Handoff: Launch permission inheritance

Supersedes: none
Workspace: OUTLORE, `worktree/launch-permissions`, based on `3132caec`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Give new errands their parent's permission setting and new realm quests their channel's permission setting. Keep the mode editable after launch.

## State

- Verified in the service tests. Inheritance covers errands opened by the owner or an agent, empty quests and quests opened from a realm Reply. Changing the realm channel after launch leaves the earlier quest's mode in place.
- Recorded verification for the implementation before this handoff. Biome and workspace typecheck passed. The full suite passed with 2,685 tests and 64 skips. The commit hook passed with 1,246 tests and 52 skips on its isolated retry.

## Decisions

- Copy the saved mode at launch. A copied Default permissions setting follows the Workshop default.
- The owner asked for a provider and model signature on every agent-authored commit. The format is recorded in `AGENTS.md`.

## Next

1. Confirm that the branch tip reached `origin/main`. If the push was interrupted, obtain approval for the exact push.
2. In the desktop app, set an explicit mode in a realm channel, start a quest and open an errand from it. Check the mode in each new composer's permission menu.

## Open questions

The owner mentioned a launch-time picker as a possible follow-up.

## Sources

- `documentation/capabilities/action-approval/specifications.md`
- `documentation/changelog/0.2.1-Pre-Alpha.md`
- `packages/service/src/work/threadPermissionMode.ts`
- `packages/service/test/work/questOrigins.test.ts`
- `packages/service/test/work/replies.test.ts`
