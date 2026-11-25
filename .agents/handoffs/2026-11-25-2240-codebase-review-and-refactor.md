# Handoff: Whole-codebase review and refactor

Supersedes: none
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review the whole codebase against the conventions and the specifications, fix the owner's two reported defects (images flicker, an open panel reloads when another loads, so every panel behaves as an island), and address every finding.
Done means the owner has accepted the desktop behavior and the listed findings are fixed or deliberately deferred.

## State

- **First pass committed on `main` (verified: `git log -1`):** CHG-0750 in `documentation/changelog/0.2.8-Pre-Alpha.md` records it.
  Image tile keyed by attachment id with a synchronous `peek` in `apps/app/src/attachments/imageCache.ts`; `PaneHost` no longer keyed per quest (`apps/app/src/shell/appScreen.tsx`); stable navigation callbacks in `apps/app/App.tsx`; the open quest reaches only the Quests list through a context in `apps/app/src/shell/channelPane.tsx`; `apps/app/src/shell/threadSlot.tsx` holds each thread pane; shared query cache in `apps/app/src/foundation/useServiceQuery.ts`; `markThreadRead` broadcasts only when it clears something unread (`packages/service/src/work/chronicle.ts`).
- **Checks run before the commit (verified: command output this session):** app Vitest 872 passed, `tsc --noEmit` clean for the app, Biome clean, relay `workerBundle`, `remote` and `chronicle` suites passed earlier in the quest.
- **Assumed:** the flicker and the realm panel are gone in the desktop window; nothing was observed there.
- **In flight:** follow-up errands, each on its own `worktree/<name>` branch, listed in the quest journal; their branches are merged into `main` by the quest's top thread.

## Decisions

- Panels are islands: a panel re-renders only when its own data or its parent changes (the owner, 2026-11-25).
- Scoped `Changed` topics, the standalone-channel merge and the standards sweeps are follow-ups, not part of the first pass.
- Wire and stored field names (for example `multiple` in `contracts/questions.ts`) are not renamed by the boolean-prefix sweep.

## Next

1. Read the quest journal for the errands in flight and merge each finished branch, running Biome, the typecheck (about 4 minutes, in the background) and the tests once over the result.
2. Ask the owner to check the flicker and the realm panel in the desktop window, then record Delivery for CHG-0750.
3. Get the owner's decision on Fresh or Resting for an empty errand opened by Reply (SPEC-07) and update `mission-tracking/specifications.md` and `tree.ts` if Fresh.

## Open questions

- Should an empty errand opened by Reply show Fresh (grey) or Resting (yellow)? The owner decides.

## Sources

- `documentation/changelog/0.2.8-Pre-Alpha.md` (CHG-0750)
- `documentation/work-in-progress.md`
- `documentation/conventions.md`
- `documentation/capabilities/conversation-panes/specifications.md`
- `documentation/capabilities/message-attachments/specifications.md`
- `.agents/handoffs/2026-11-25-2028-reply-opens-child-and-parent-search.md` (the previous thread's handoff, not superseded)
