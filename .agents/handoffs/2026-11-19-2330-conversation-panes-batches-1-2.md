# Handoff: Conversation panes, batches 1 and 2

Supersedes: none (forked from `2026-11-19-2227-connector-panels.md` for the repository's state; the quest's own briefing is in the specification)
Workspace: `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS/.worktrees/delineate-specify-i-d-like-to-have-more-b606ee66`, branch `mission/delineate-specify-i-d-like-to-have-more-b606ee66` (not merged, not pushed)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked for a Slack-like window ([specification](../../documentation/capabilities/conversation-panes/specifications.md)). This errand built batches 1 and 2 of its [blueprint](../../documentation/capabilities/conversation-panes/blueprint.md): the overlay sidebar and the chain of panes for a quest and its errands. Done is the owner looking at it and redirecting the choices.

## State

- Built and committed on the branch (CHG-0557, CHG-0558), app only: `shell/sidebarMode.ts`, `useSidebarOverlay.ts`, `sidebarOverlay.tsx`, `foundation/sidebarPreference*.ts`, the top bar button and the Look card choices; `shell/paneChain.ts`, `paneHost.tsx`, `paneStrip.tsx`, `paneResizer.tsx`, `conversation/paneThread.tsx`, `threadPane.tsx`, `questPages.tsx`, `questPanelOf.tsx`, `replyLine.tsx`; `shell.tsx` split (`shellStyles.ts`, `useDetailsColumn.tsx`). Verified: Biome and `bun run typecheck` clean; `apps/app` tests 633 passed; the full suite's 29 failures are all `git init` template copies in `packages/service` (sandbox). Behavior seen in a throwaway window: [verification note](../../documentation/verification/2026-11-19-conversation-panes.md).
- The first commit on the branch is the specification itself (CHG-0553 to CHG-0556), copied from the main checkout's uncommitted files; the main checkout still has those as uncommitted edits, so take the branch's copy and drop the main checkout's when merging.
- Deviations from the blueprint, all in CHG-0557 and CHG-0558: the sidebar's mode and side live in `foundation/` (`settings/` may not import `shell/`); `location.ts` and `navigation.ts` did not change, because the chain is the path to `openThread`; the pane widths are remembered as shares by depth.
- Assumed, not seen: the owner's judgement of the look; a real drag with the panel open; touch; the black and white theme.

## Decisions

- Equal sharing when a pane folds, reply line with title, state, waiting count and age, the details panel following the pane pressed last, close on every pane but the first, fold on every pane but the deepest: built as the draft recommended and listed in CHG-0558 for the owner to redirect.
- The panel is slid away, not unmounted, so the sidebar keeps its state and its dialogs.

## Next

1. The owner looks at the window and redirects the pane choices.
2. Batch 3: the Chronicle as the first pane (removes the Chronicler dock; `shell.tsx` then loses `ChroniclerColumn` and the narrow-window card); the panes' first slot becomes a main conversation, so closing and folding rules need the quest pane to become closable.
3. Batch 4: Reply and the agent-opened errand card (contracts and service); `replyLine.tsx` is where the card's reply line goes.
4. Batch 7 (phone) is untouched: a window under 820 px keeps `Conversation`.

## Open questions

- The draft's open items about the Chronicle and channels are unchanged.
- Whether the reply line's grey "open" mark, the strip, and the missing focus mark on the pressed pane read well.
- Keyboard focus between panes is not designed.

## Sources

`documentation/changelog/0.1.13-Prototype.md` (CHG-0557, CHG-0558), `documentation/capabilities/conversation-panes/`, `documentation/verification/2026-11-19-conversation-panes.md`, the commits on the branch.
