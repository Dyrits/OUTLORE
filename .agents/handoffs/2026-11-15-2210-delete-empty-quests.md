# Handoff: Archiving an empty quest deletes it

Supersedes: none
Workspace: ISKIOS repository, `main` (committed on top of `63c3bbc`, then pushed to `origin/main` right after this file; check `git log origin/main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A quest that carries nothing ("New quest", 0 tokens) must not pile up in the Archived view: archiving it deletes it. Done means accepted by the owner after archiving an empty quest in a window.

## State

- Implemented in the service: `EndMission` now goes through `archiveOrDeleteEmpty` (`packages/service/src/work/deleting.ts`). When the ending is Archived and `isEmptyQuest` (`work/ending.ts`) holds (no tokens in `usage`, no message in any thread of the mission, no Ritual), it checks the owner's working-threads snapshot, then deletes the top thread through `previewDeletion` and `deleteThread`, and returns the same `QuestPlacement` so the app goes back to the realm overview. Otherwise it runs `endMission` as before. Verified: files read and tests run before this handoff.
- Verified (run in the sandbox on this tree): `bunx biome check packages` clean, `bun run typecheck` clean, `CI=1 bun run test` 1,619 passed, 54 skipped. Two new tests in `packages/service/test/tracking.test.ts` (an empty quest is gone from both views and reads NotFound; a quest with a message and no token is archived).
- Archiving a realm is unchanged: `realmLifecycle.ts` calls `endMission` directly, so empty quests are archived and restored with the realm. Mark as done is unchanged. Inactivity auto-archive only touches Done quests.
- Four existing tests archived zero-token quests; they now work a turn first (`usage 5 5 0 0`): `tracking.test.ts` (`idle`), `offTopic.test.ts`, `work/realmLifecycle.test.ts`.
- Documents: mission-tracking specification (Ending a mission), changelog `0.1.6-Prototype.md` (CHG-0300).
- Not done: no window check of the app (assumed to behave as after an archive, since the same placement is returned).

## Decisions

- Owner-approved (2026-11-15): a quest is deleted only if it has no tokens and no message; a quest with a message but no tokens (for example blocked by a budget) is archived. Recorded in the specification and CHG-0300.
- Only the owner's Archive action deletes; the realm archive keeps archiving, so Restore stays intact (`realm_archived_quests` rows point at missions).
- Ritual missions are never deleted this way.

## Next

1. Ask the owner to archive a fresh "New quest" in the app and check it vanishes and the view returns to the realm.
2. If wanted, decide whether the dashboard's inactivity "Archive" prompt and the realm archive should delete empty quests too.

## Open questions

- Should empty quests also be deleted when a realm is archived? Currently no, to keep Restore simple. The owner decides.

## Sources

`packages/service/src/work/deleting.ts` (`archiveOrDeleteEmpty`), `packages/service/src/work/ending.ts` (`isEmptyQuest`, `endMission`), `packages/service/src/service.ts` (`EndMission`), `packages/service/test/tracking.test.ts`, `documentation/capabilities/mission-tracking/specifications.md`, `documentation/changelog/0.1.6-Prototype.md` (CHG-0300).
