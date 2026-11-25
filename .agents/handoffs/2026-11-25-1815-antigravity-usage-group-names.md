# Handoff: Antigravity usage groups named Gemini and Others

Supersedes: `2026-11-25-1740-plan-usage-hover-card.md`
Workspace: repository OUTLORE, branch main

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The plan usage of Antigravity names its two model groups "Gemini" and "Others" instead of the CLI's "Gemini Models" and "Claude and GPT models". Done means the owner has seen the new names in the running app and accepted them.

## State

- Verified: `packages/service/src/harness/antigravityPlanLimits.ts` maps a group whose name starts with Gemini to "Gemini" and every other group to "Others", so limits read "Gemini · 5-hour", "Others · Weekly" (file read).
- Verified: the service tests `test/harness/antigravityPlanLimits.test.ts` and `test/work/planLimits.test.ts` pass, 9 of 9, run with `npx vitest run` in `packages/service` (run this session, 2026-11-25). `bun test` cannot run them.
- Verified: the app tests `test/editors/planUsage.test.ts` and `test/foundation/labels.test.ts` pass, 61 of 61, run with `bun test` in `apps/app` (run this session).
- Verified: the budget-control specification and the changelog entry CHG-0743 (`documentation/changelog/0.2.8-Pre-Alpha.md`) describe the new names (file read).
- Assumed: the typecheck passes. It was not run for this change (it takes about 4 minutes); the pre-commit hook runs it when the change is committed.
- Assumed: the new names show in the running app. Not seen there.
- The raw CLI names ("Gemini Models", "Claude and GPT models") remain in the test fixtures that stand in for the CLI's answer, in `documentation/backlog.md`, and in the CHG-0722 line of `documentation/work-in-progress.md`, as history of what the CLI reports.
- The hover card from the superseded handoff lists limits flat, so it shows the new names as "Gemini · Weekly"; its open question about a model-group table for Antigravity is unchanged.

## Decisions

- The owner chose the names "Gemini" and "Others" (this session). The service renames at the source, so every display shows them; any group not starting with Gemini reads "Others", including future model groups.
- The CLI's own names stay recorded in the specification as what the CLI reports.

## Next

1. Open the app, hover Antigravity in the rail, and check the names in the card (window and narrow width).
2. Once the owner accepts, record the acceptance in the CHG-0743 entry.
3. Decide, with the owner, whether the card should group Antigravity's limits under "Gemini" and "Others" headings instead of the flat list (the open question from the superseded handoff).

## Open questions

- Whether the owner wants group headings in the card for Antigravity or the flat list. Answer: the owner.
- Whether several non-Gemini groups appearing later should stay merged under one "Others" name. Answer: the owner, when the CLI reports more groups.

## Sources

- `packages/service/src/harness/antigravityPlanLimits.ts` (`groupLabelOf`)
- `documentation/changelog/0.2.8-Pre-Alpha.md` (CHG-0743)
- `documentation/capabilities/budget-control/specifications.md` (the Antigravity paragraph)
- `apps/app/src/editors/planUsage.ts` (group splitting by " · ")
- `.agents/handoffs/2026-11-25-1740-plan-usage-hover-card.md` (superseded)
