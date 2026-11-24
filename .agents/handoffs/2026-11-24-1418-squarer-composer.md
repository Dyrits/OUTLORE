# Handoff: Squarer composer and the Workshop in the File menu

Supersedes: none
Workspace: OUTLORE repository, branch `worktree/squarer-composer` (from `origin/main` at 6ebe7f79), pushed to `origin/main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The composer bar and its buttons are squarer instead of pill-shaped, and the Workshop (the settings) opens from the sidebar footer and from the desktop menu bar (File, and the Outlore menu on macOS) instead of a top-bar gear.
Done means the changes are on `origin/main` and the owner has seen them in the running desktop app.

## State

- Composer bar radius 24 to 14; send, stop, and microphone buttons radius 10 (`apps/app/src/foundation/styles.ts`, `apps/app/src/dictation/dictationButton.tsx`).
- The top bar no longer has a Workshop gear (`apps/app/src/shell/topBar.tsx`, `shell.tsx`); the sidebar footer always shows the Workshop row, not only in a narrow window (`apps/app/src/shell/sidebar.tsx`).
- Desktop menu: Workshop… with ⌘, in File and in the Outlore menu on macOS (`apps/desktop/src/appMenu.ts`, wired in `main.ts`, `preload.ts`; renderer side `apps/app/src/foundation/desktopBridge.ts`, `apps/app/src/shell/useWorkshopMenu.ts`, `App.tsx`). Chosen while the Workshop is open, it stays open.
- Changelog entry CHG-0689 in `documentation/changelog/0.2.5-Pre-Alpha.md`.
- Verified: `CI=1 bun run test apps/desktop apps/app/test/shell` passed 300 tests in 38 files (2 skipped in the sandbox), including `apps/desktop/test/appMenu.test.ts`; Biome reports no error in the changed files.
- Verified: `bun run typecheck` exited 0 for every workspace.
- Assumed: the composer's look and the menu in the running desktop app; nothing was launched.
- The main checkout holds other threads' uncommitted changes; none of them are in this commit.

## Decisions

- The entry is named "Workshop", not "Settings" or "Réglages" (owner, this session).
- Radii are 14 for the bar and 10 for the buttons; the owner may ask for rounder or squarer.
- Choosing Workshop from the menu never closes it; the sidebar row still toggles.

## Next

1. Run the desktop app, check the composer corners and File > Workshop… (⌘,), and tell the owner.
2. Adjust the radii if the owner finds them too round or too square.

## Open questions

None.

## Sources

- `documentation/changelog/0.2.5-Pre-Alpha.md` (CHG-0689)
- `apps/desktop/src/appMenu.ts`, `apps/desktop/test/appMenu.test.ts`
- `apps/app/src/shell/useWorkshopMenu.ts`, `apps/app/src/shell/sidebar.tsx`, `apps/app/src/shell/topBar.tsx`
- `apps/app/src/foundation/styles.ts`
