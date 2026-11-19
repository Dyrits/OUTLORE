# Handoff: architecture audit fixes

Supersedes: `2026-11-19-0836-architecture-audit.md`
Workspace: OUTLORE, `.worktrees/architecture-audit`, branch `worktree/architecture-audit`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Implement and verify the relevant fixes from the November 19 architecture audit. Hand off the audit branch for review and integration.

## State

- Verified by Git history: `859f2ee` consolidates the command runner and `8cff089` addresses the realm, ACP, app import, sidebar, label, and loopback findings. The branch starts from `e42800f` and targets local `main`.
- Verified in the final test log: `TMPDIR=/tmp CI=1 bun run test` reported 2,196 passed, 51 skipped, and zero failures. Biome, workspace typechecking, and both pre-commit hooks passed.

## Decisions

- Preserve folder-backed lookup for quest placement and lookup across both realm kinds for rename. Preserve each ACP adapter's fallback behavior and Chronicler's receipt checks at the point of mutation.
- Leave app-wide folder exports, deeper sidebar extraction, and relay lifecycle changes for separate review.

## Next

1. Compare the audit branch with current `main` and verify the integrated result before landing it.
2. If taking up relay shutdown, establish the intended handling of in-flight work on disconnect and reconnect before changing it.

## Open questions

Whether to take up the remaining broader refactors after integration.

## Sources

- [Architecture audit](../../documentation/architecture-audit/architecture-audit-2026-11-19-0825.html)
- [Changelog](../../documentation/changelog/0.1.12-Prototype.md), CHG-0531 and CHG-0534.
- Commits `859f2ee` and `8cff089`.
