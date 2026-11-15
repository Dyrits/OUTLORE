# Handoff: Dock icon bounce on summons

Supersedes: `2026-11-15-1908-dock-bounce.md`
Workspace: ISKIOS repository, branch `worktree/dock-bounce` in the worktree `.worktrees/dock-bounce`, rebased onto `origin/main` at `508a696`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

On a Mac, the app's Dock icon bounces when a thread waits for the user (Summons, the Attention state), so the user notices it without reading a notification. Done means the bounce is seen on a real Mac and the work is on `main`.

## State

- The branch holds four commits on top of `508a696`: the code and changelog, the earlier handoff, the owner's choice recorded in the changelog, and this handoff. The mobile navigation work took CHG-0292 on `main` first, so this change is now CHG-0293 (the earlier handoff and one commit message may still say CHG-0292). The code commit's patch is unchanged by the rebases. Verified: `git log` now.
- Conflicts: only the `AGENTS.md` pointer list and the changelog file. The pointer list holds three links; to keep three, the relay deploy link (the oldest) was removed in favour of this thread's. Its handoff file is still in the folder. Verified: files read.
- Verified before the second rebase, which changed only documentation and the pointer list (re-run below if the next step needs it): `bun run check` (Biome), `bun run typecheck` (six workspaces), and the tests under `apps/app/test/foundation` and `apps/app/test/shell` (215 passed, 8 skipped). Not run: the full suite, and an actual bounce on a Mac (assumed to work; `app.dock.bounce` is Electron's macOS API).
- Flow, unchanged: a new open question makes `useAttentionNotice` (`apps/app/src/shell/notifications.ts`) call `bounceDesktopDock` (`apps/app/src/foundation/desktopAttention.ts`), which calls the bridge's `requestAttention`; `apps/desktop/src/main.ts` checks the sender and, only while the window is not focused, calls `app.dock.bounce("critical")`; the window's `focus` event cancels it.
- Whether the branch has been pushed to `origin/main` is recorded in `git ls-remote origin main` and in the quest journal, not here.
- The worktree's `node_modules` folders are symlinks to the main checkout's (`bun install` fails inside the sandbox). Not committed.

## Decisions

- The bounce repeats until the owner returns (`critical`). Confirmed by the owner on 2026-11-15; recorded in CHG-0293. The superseded handoff still lists this as open; this file replaces it.
- No bounce while the window is focused.
- Only a new open question triggers the bounce, not other Attention reasons, because the existing hook watches only `ListOpenQuestions`.

## Next

1. Check `git ls-remote origin main` to see whether the work reached `main`; if not, push the branch to `main` fast-forward, with the owner's approval of `--no-verify`.
2. Run the desktop app on a Mac, open a question while another app is in front, and confirm the icon bounces and stops on return.
3. Run the full suite (`env -u CLAUDE_CONFIG_DIR CI=1 bun run test`, outside the sandbox).
4. Restore the relay deploy pointer in `AGENTS.md` when a pointer slot frees up (its open item: the first tag runs the `relay` job).

## Open questions

- Whether other Attention reasons (a budget reached, a failed thread) should also bounce: the owner.

## Sources

- `apps/desktop/src/main.ts`, `apps/desktop/src/preload.ts`
- `apps/app/src/foundation/desktopBridge.ts`, `desktopAttention.ts`, `apps/app/src/shell/notifications.ts`
- `apps/app/test/foundation/desktopAttention.test.ts`
- `documentation/changelog/0.1.5-Prototype.md` (CHG-0293), `documentation/capabilities/action-approval/specifications.md`
- `.agents/handoffs/2026-11-15-1747-relay-deploy-in-release.md` (pointer removed from `AGENTS.md`)
