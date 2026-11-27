# Handoff: Quest tab switching drops stale Errands list requests

Supersedes: `2026-11-27-0039-quest-pane-remembers-tab.md`
Workspace: Outlore repository, branch `main` (base `743f7690`, reviewed from `42b7d4b0`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep desktop quest-to-quest switching on the currently open tab (such as Missives) instead of reverting to Errands when returning to a quest that previously had an Errands list request.
Done when the fix is committed, pushed, and checked in the live desktop window.

## State

- **Confirmed release status (verified by `git log` and `git tag`):** CHG-0774 (`20695b4e`, *"Open a quest's pane on the tab the last quest showed"*) was already released in `0.2.11-Pre-Alpha` (`f14085c7`).
- **Root cause and fix (committed on `main` at `fab6138b`, *"Clear stale Errands list requests when switching quests"*):** `paneSessionOf` in `apps/app/src/shell/paneSession.ts` set `listRequest: { id: action.id }` on `"list"` actions and never cleared it, so returning to a quest that previously had an Errands list request remounted its `PaneThread` with `listRequest !== undefined` and forced `"Errands"` over `questTabMemory`.
  - Updated `apps/app/src/shell/paneSession.ts` to prune `listRequest` on `"chain"` (when `listRequest.id` leaves `action.chain`), clear quest-scoped `listRequest` on `"quest"` (keeping `channelId`), and clear `listRequest` on `"target"`.
  - Added three regression tests in `apps/app/test/shell/paneSession.test.ts`.
- **Review and refactor (verified):**
  - Standards: 3 findings resolved (`STD-1` comment on `"quest"` branch, `STD-2` direct `expect(returned.listRequest).toBeNull()` assertion, `STD-3` role-based test names), 0 open, verified with no regressions.
  - Specifications: 0 resolved, 1 open (`SPEC-1`: pre-existing stale `channelId` `listRequest` across realm switches because `paneSessionOf` has no realm-change signal; requires expanding scope to `paneHost.tsx` and `usePaneChain.ts`, deferred by owner approval).
- **Verification proof (verified and reproduced in a fresh context):** `documentation/verification/2026-11-27-quest-tab-list-request.md`.
  - Verdicts: C1–C3 proven (all shown able to fail before fix or under mutation in a detached worktree at `42b7d4b0`, then reproduced in a fresh context); C4 (live desktop window check) awaiting human judgment.
  - Checks passed (including pre-commit hook on `fab6138b`): `bunx biome check apps/app/src/shell/paneSession.ts apps/app/test/shell/paneSession.test.ts` (0 errors), full workspace `typecheck` (all 7 packages clean), `CI=1 bun run test apps/app/test/shell/paneSession.test.ts` (11 passed), `CI=1 bun run test apps/app` (129 files, 1,054 passed, 6 skipped).

## Decisions

- Deferred `SPEC-1` (pre-existing realm-switch channel `listRequest` persistence) to a follow-up rather than expanding scope into `paneHost.tsx` and `usePaneChain.ts` (owner approved shipping the quest-switching fix now).

## Next

1. Verify C4 in the live desktop window: trigger quest X's Errands via an errand title or notch, switch X to Missives, switch to quest Y on Missives, then switch back to quest X and confirm it lands on Missives.
2. In a follow-up if desired, close `SPEC-1` by passing `channel.id` into `usePaneChain` and clearing `{ id: channelId }` on realm change in `paneSessionOf`.

## Open questions

- None.

## Sources

- `apps/app/src/shell/paneSession.ts`
- `apps/app/test/shell/paneSession.test.ts`
- `apps/app/src/shell/usePaneChain.ts`
- `apps/app/src/shell/paneHost.tsx`
- `apps/app/src/conversation/paneThread.tsx`
- `apps/app/src/conversation/questTabMemory.ts`
- `documentation/capabilities/conversation-panes/specifications.md`
- `documentation/verification/2026-11-27-quest-tab-list-request.md`
- Commit `20695b4e` (CHG-0774) and tag `0.2.11-Pre-Alpha` (`f14085c7`)
