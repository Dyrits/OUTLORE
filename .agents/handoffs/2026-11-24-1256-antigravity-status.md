# Handoff: Antigravity sign-in status

Supersedes: `2026-11-24-0718-antigravity-sign-in.md`
Workspace: OUTLORE repository, `worktree/antigravity-status-handoff` (target `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Confirm that a desktop build carrying CHG-0687 shows Gemini (Antigravity) as signed in in Workshop and lists its models using the existing login.

## State

- Verified by reading the service diff: the harness uses the Antigravity model probe for sign-in status.
- Verified in the errand before integration: 10 focused tests, Biome and the service typecheck passed, and the live probe reported signed in with six models on `agy` 1.5.16 outside the sandbox.
- The desktop status remains unverified in a build carrying this change.

## Decisions

- Reuse the session probe so the status uses the same login as model discovery.
- Keep existing Usage token accounting and defer the plan-limit ring until the provider reports quota data.

## Next

1. Run a desktop build that includes CHG-0687 on the host with the existing Antigravity login.
2. Open Workshop and confirm that Gemini (Antigravity) shows signed in and lists its models without another sign-in.
3. If Workshop still shows Unknown, compare the app's probe result and executable with the live host probe.

## Open questions

- Does the status appear correctly in the updated desktop app?

## Sources

- `documentation/changelog/0.2.5-Pre-Alpha.md`, CHG-0687
- `packages/service/src/harness/antigravityProvider.ts`
- `packages/service/src/harness/acpProviders.ts`
- `packages/service/test/harness/antigravityProvider.test.ts`
