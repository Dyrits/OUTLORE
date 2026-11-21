# Architecture audit follow-through

The owner approved the relevant candidates in the [2026-11-21 audit](../architecture-audit/architecture-audit-2026-11-21-0702.html). The work starts from `eaf8fb69` on `worktree/audit-follow-through`.

| Candidates | Evidence |
| --- | --- |
| A1–A3, pane state and geometry | The pane-session tests cover starter reset, quest and errand slot kinds, and revealing a Chronicle target. The notch test checks shared padding across open panes. The existing layout suite covers folds and resizing. |
| A4–A5, sidebar and window | The sidebar takes an explicit host. The window derives the active or parked channel and the parked quest from its location. Window interaction remains pending. |
| B1–B4, Chronicle and conversations | Target tests cover exact question IDs, an older host response that omits the ID, and quest-level targets. Existing tests cover Chronicle reads, feed entries and notch rankings. The shared renderers and read hook still need a window check. |
| C1, inbox wake | Command tests cover a wake after commit, a conversation-only message and a rolled-back insert. Existing tests exercise delivery, command replay, Rituals, suggestions and errand results. |
| C2, background wake | Admission tests cover a running turn taking the wake and refusing archived or ended work. The pool and Claude Code stand-in tests exercise starting a wake, recording its output and closing a refused process. |
| C3, Claude Code file edits | File-step tests cover Edit, MultiEdit and the previous contents of a Write. The fake harness uses the same event conversion as the Claude Code adapter. |
| C5, Codex restart key | The restart key uses one profile lookup. Startup checks grants again after resolving the start folder because folder approval can wait on the owner. The Codex adapter and Git grant suites cover the existing behavior. |

C4 stays as assessed. Replies select and count unread messages, while Waiting and Failed retain their entries and compute unread status.

Before merging the channel-fold change from `849774e7`, the focused run passed 113 tests and the full suite passed 2,673 with 64 skipped. Biome, the workspace typecheck, the Expo web export and the desktop bundle passed. Electron exited with `SIGABRT` before opening the isolated development window, including on the retry outside the sandbox.

After the merge, the pane reducer starts with the channel folded and keeps that fold while the quest loads. The full app suite passed 688 tests with 6 skipped. Biome, the app typecheck and a fresh Expo web export passed.

Run `bun run check`, `bun run typecheck`, and `CI=1 bun run test` from the worktree root. For a window check, use an isolated data folder and exercise Chronicle links, pane folds and resizing, narrow and wide sidebars, and a return from the Workshop.
