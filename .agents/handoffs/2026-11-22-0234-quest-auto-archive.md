# Handoff: Quest inactivity warnings and auto-archive

Supersedes: none
Workspace: Outlore, `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Warn in a realm's Missives when a quest or errand reaches its inactivity threshold. Keep automatic archiving for Fulfilled quests after the configured delay.

## State

- Verified in source. The service sweeps at startup and hourly. With auto-archive enabled, it archives Fulfilled quests whose `done_at` is present and old enough. An error escaping the sweep becomes a defect through `Effect.orDie` and ends the scheduled fiber.
- Verified in source. Quest summaries already expose `MarkDone` and `Inactive` prompts. The inactivity prompt uses the later of quest activity and dismissal, then applies one threshold in days. The app still defines `promptQuestionOf`, but a source search found no caller or app request for `DismissMissionPrompt`. The earlier investigation traced the missing UI to the dashboard removal during the sidebar simplification.
- Historical observation from the quest journal. The installed app had recorded 22 automatic archives, with no eligible quests overdue at the time. The next two predicted archives were due the morning of November 22. Their outcome has yet to be checked.
- The warning batch is still a proposal. The Realm quest updates errand is waiting for the shared warning contract before building the Missives and Chronicle integration.

## Decisions

- The owner set two inactivity thresholds measured from the last message. Warn after 4 hours in Attention or 12 hours in Resting. Underway and Waiting are ineligible. A qualifying errand can cause its parent quest to be mentioned in its own realm's Missives.
- Auto-archive applies only to Fulfilled quests after the existing delay. Quest journal entry 7 records these decisions.
- Daily background check-ins are a separate capability specified in CHG-0633. Their schedule does not govern inactivity warnings.

## Next

1. Confirm what counts as the last message. The proposal counts owner and agent messages. Check the message timestamps and status derivation for individual errands before choosing a data source.
2. Once the batch is approved, specify the configurable hour thresholds, dismissal behavior, and warning contract. Share the contract with the Realm quest updates errand so Missives can link the parent quest and Chronicle can reuse an existing attention item.
3. Verify both thresholds at their boundaries, errand eligibility, realm isolation, delivery without duplicate warnings, and the Fulfilled-only archive delay. The proposed batch also restores prompt actions in the quest panel and logs recoverable sweep failures so the next scheduled run can proceed.

## Open questions

- Should owner and agent messages both reset the timer, or only owner messages? The owner has yet to confirm the rule or authorize the proposed implementation batch.
- Does the owner want prompt actions in the quest panel as well as warnings in Missives? The quest-panel UI was proposed alongside the confirmed Missives behavior.

## Sources

- [Ending a quest](../../documentation/capabilities/mission-tracking/specifications.md#ending-a-mission)
- [Archive sweep](../../packages/service/src/work/ending.ts), [quest summary prompts](../../packages/service/src/work/missions.ts), [app labels](../../apps/app/src/foundation/labels.ts), and [service tracking tests](../../packages/service/test/tracking.test.ts)
