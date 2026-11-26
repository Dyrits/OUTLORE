# Handoff: Chronicle pins no thread root

Supersedes: none
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Stop Chronicle conversations (global Chronicler, realm channels, and Borderlands) from pinning their first message as a thread root, which drew a misleading `0 replies` divider above an anchored quest's real reply count.
Done means the fix is committed and pushed to `origin/main` and verified in a running window by the owner.

## State

- **Service fix, spec, changelog, and regression test (verified in worktree `.worktrees/chronicle-no-root`):** `packages/service/src/work/missionDetail.ts` reads `missions.is_guildmaster` and omits `thread.root` when `isGuildmaster === 1 && selected.parentId === null`.
- **Tests and lint (verified in main checkout before worktree transfer; re-run by pre-commit hook in worktree):** `bunx vitest run packages/service/test/work/replies.test.ts` passed 26/26 (including `pins no root in Chronicler or in a channel conversation`), `bun test apps/app/test/conversation/entries.test.ts` passed 32/32, and `bunx biome check` reported no errors.
- **Not checked:** a running desktop window with a channel whose first message anchors a quest.

## Decisions

- **No root pinned in Chronicle channels:** Chronicler, realm channels, and Borderlands are channels rather than threads hanging from a parent message, so they pin no root (owner decision, 2026-11-26; recorded in `documentation/capabilities/conversation-panes/specifications.md` and `CHG-0762`).
- **Keep child threads unchanged:** the guard checks `isGuildmaster === 1 && selected.parentId === null`, so any child thread beneath Chronicler (such as an aside) still follows normal thread-root rules.

## Next

1. Owner checks a realm channel or Borderlands in the desktop window to confirm the `0 replies` divider is gone and the quest reply line sits directly under its anchor message.

## Open questions

None.

## Sources

- `packages/service/src/work/missionDetail.ts`
- `packages/service/test/work/replies.test.ts`
- `documentation/capabilities/conversation-panes/specifications.md`
- `documentation/changelog/0.2.10-Pre-Alpha.md` (CHG-0762)
