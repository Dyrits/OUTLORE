# Handoff: a thread's first message draws the owner's chips

Supersedes: none
Workspace: Outlore repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The message a thread hangs from (the pinned first message above "1 reply") draws the skills, files, quests, errands, realms and Companions the owner named as chips, as the message box and the later bubbles do. Done means the owner has looked at it in the window and on the phone.

## State

- Cause (verified: a render test failed on the starting commit and passes now): `ThreadRootView` in `apps/app/src/conversation/conversationEntries.tsx` drew the root with `Markdown`; the pure `chipsOf` in `apps/app/src/ui/chipPlaces.ts` already returned the chip, the component never called it. An owner's root now draws through `ChipText`; other senders' roots stay `Markdown`.
- Committed as `b7731012` on `main` (CHG-0784 in `documentation/changelog/0.2.12-Pre-Alpha.md`), with the test `apps/app/test/conversation/threadRootChips.test.ts` and the proof `documentation/verification/2026-11-27-thread-root-chips.md` (verdict: not proven; C1 and C5 proven, C2 and C3 unproven, C4 awaits a human eye).
- Verified now: `bun run vitest run` in `apps/app` (129 files, 1,050 passed, 6 skipped), `bun run typecheck` clean in every workspace (the commit hook ran it), Biome clean apart from 4 existing warnings in `documentation/architecture-audit/*.html`.
- Review ran without subagents. Standards: one documented finding (the test cast `{} as ServiceClient`; the convention reserves `as`), fixed by using a real `ServiceClient` on a fake transport as `phoneScreens.test.ts` does. The test still uses `vi.mock` for `react-native`, as the other render tests do; dismissed as the existing way to render there. Specifications: no gap found for the skill chip; no finding open.
- The main checkout lacked six `expo-*` packages declared in `apps/app/package.json`, so the app typecheck failed there; `bun install --frozen-lockfile` fixed it.
- Not checked: how the chip looks in the root in the window and on the phone. Assumed: the owner's screenshot is a thread panel, not the Chronicler chat (the code path found matches it).
- Not pushed at the time of writing; check with `git log origin/main..main`.

## Decisions

- Only an owner's root draws chips; an agent or thread root stays `Markdown`, since chips are what the owner names (the bubble does the same for `message.sender === "user"`).

## Next

1. Look at a thread whose first message names a skill, a file, a quest and a Companion, in the window and on the phone.
2. Decide how a root holding comments or a terminal snapshot should read: the bubble splits those with `commentsOf` and `terminalSnapshotOf`, the root draws the raw text.
3. Add a render test for an agent root if C3 of the proof should be proven.

## Open questions

- Should the root also split comments and terminal snapshots like the bubble (owner)?

## Sources

- `documentation/verification/2026-11-27-thread-root-chips.md`
- `documentation/changelog/0.2.12-Pre-Alpha.md` (CHG-0784)
- `documentation/capabilities/thread-messaging/specifications.md` (Files with + and skills with $)
- commit `b7731012`
