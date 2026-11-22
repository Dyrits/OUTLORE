# Background check-ins

Status: agreed on 2026-11-22. [Open technical and provider questions](draft.md).

## Problem and outcome

Outlore combines an agentic development environment with an autonomous assistant. Once the owner sets up check-ins, Outlore checks on ongoing work and brings decisions, blockers, and meaningful progress back to the owner without waiting for another request.

## Agreed behavior

- The Workshop explains what the routine checks and shows the schedule, selected realms, and Companion. The owner opts in once, selects the realms, and chooses a daily time in the host's local time. The owner can pause the routine or change the realms, time, or Companion. Changes to the Companion apply to subsequent runs.
- At the chosen time, Outlore reviews new developments in the selected realms and posts to a realm's Missives when there is a decision to make, a blocker, meaningful progress, or a completion to report. Each item links to its quest. A check with nothing new to report leaves Missives quiet.
- The Workshop recommends a free or low-cost model available to the owner. A built-in free option requires a verified provider that meets Outlore's terms and budget obligations. The owner can replace the recommended or built-in Companion. When the selected Companion is unavailable or hits a limit, the Workshop shows why. A paid fallback runs only if the owner selected it.
- The daily check can mention inactivity warnings. The 4-hour Attention and 12-hour Resting warning rules keep their own timing and continue to apply when check-ins are paused or inference is unavailable.

## Acceptance and validation

- Verify on a controlled clock that a selected realm receives a linked Missive after a reportable change, without a new owner request. Repeat with unchanged input, an unselected realm, and a paused routine and verify that none posts a Missive.
- Verify a Companion change applies on the next run. Exercise provider unavailability and quota exhaustion and check the visible reason and the owner's paid fallback choice. Confirm inactivity warnings still become due independently.
- Review setup and a sample Missive with the owner. Check that the scope, time, and Companion are easy to find and that a quest link opens from the host and a paired device.

## Requirements and dependencies

- [System-wide requirements](../../requirements.md) for local data, provider terms, cost, and paired access apply. Enablement is explicit and the Companion stays under owner control.
- Depends on [realm Missives and quest navigation](../conversation-panes/specifications.md#the-three-levels) and the existing [Companion choices](../companion-presets/specifications.md).

## First scope

Check-ins read quest developments and report in Outlore. Changes to quest state, external messages, and other actions on the owner's behalf are outside this scope.
