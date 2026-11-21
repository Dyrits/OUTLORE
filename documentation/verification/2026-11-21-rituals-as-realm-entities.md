# Rituals as realm entities · 2026-11-21

The implementation of CHG-0616 (the Ritual as a top-level entity of its realm, each run an errand beneath it), in the batch's three commits — the specifications pass, the service core (errand A), and the app UI (errand B) — plus the app-guide alignment. Everything here ran inside this session's sandbox on the main checkout; the original hashes were 578aeefb, 4a2e4bc6, 3ee64920 and 586c5afc, rewritten by the rebase onto the permission-modes and sidebar-errands work (which also took the 0071 migration number, renumbering this batch's to `0073_ritual_origin_mission`).

## Checks run now (by the quest's own thread, after the last edit)

- `CI=1 bun vitest run test/work/ritualRuns.test.ts test/work/ritualStart.test.ts test/work/ritualSchedulingAndEditing.test.ts` (packages/service): **18 passed**.
- `CI=1 bun vitest run test/work/appGuide.test.ts test/work/guildmasterAppGuide.test.ts` (after aligning the guide's sidebar and empty-quest wording to the entity model): **36 passed**.

## Checks run by the errands at their commits (their recorded results)

- Errand A, at the service-core commit: `bun run check` clean; workspace typecheck clean; `CI=1 bun run test` **2725 passed, 24 skipped (pty/Seatbelt), 0 failed**.
- Errand B, at the app-UI commit: `bun run check` clean; workspace typecheck clean; `CI=1 bun run test` **2734 passed, 24 skipped, 0 failed** (baseline 2725 + 9 new app tests).

## What the tests cover (the specification's Acceptance, machine side)

- A scheduled or manual run opens a persisted errand beneath the Ritual, carrying the trigger line; the Ritual's conversation holds service-made trigger and result lines while its top thread stays Resting; nothing wakes it.
- One run at a time: Run now refused with the reason while a run errand is under way, scheduled runs then skipped; a failed start leaves "Could not start the scheduled run:" with no errand, inside one savepoint (`ritualStart`, injected failing write).
- Fallback Companions with the visible "Fell back to" line in the run errand; a used-up list fails the run; the next run starts on the primary again.
- `ListMissions.includeRituals` places rituals beside their realm's quests (and realm-less rituals with the quests in no realm); `find_missions` and the dashboard keep rituals out; `CreateRitual.originMissionId` inherits the origin quest's realm; `DeleteRitual` removes the Ritual with its whole history; guarded migration `0073_ritual_origin_mission` adds `rituals.origin_mission_id`.
- App side (`apps/app/test/rituals/ritualRow.test.ts` and the updated place tests): placement requests, run-underway and archived-realm markers on the row, hidden composer wording, the delete confirmation naming the loss, and the create request with origin.

## Not checked here

- The desktop window (sandbox-blocked): the ritual row's look among the quests, the panel, Schedule as a Ritual, the delete confirmation, phone-narrow — for the owner's eye.
- A live-harness scheduled run (as the old model's verification also noted): the fake harness covers the seams.
- Open review points from the errands: rituals of an archived realm are invisible until the realm is restored (the Realm-archived notice exists on the panel); a realm tied to no folder cannot receive a directly created Ritual (pre-existing form limitation); the muted "no message box" line's wording; the "Made from" origin-link wording.
