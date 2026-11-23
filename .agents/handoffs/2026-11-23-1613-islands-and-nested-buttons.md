# Handoff: Islands theme and nested sidebar buttons

Supersedes: `2026-11-23-1536-islands-theme.md`
Workspace: OUTLORE, `main` (the work was done on `worktree/sidebar-directions`, which the owner asked to push to `origin/main` and delete)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Redesign the sidebar look with floating cards (the Islands theme), and remove the dev-terminal error the owner kept seeing from the sidebar.

## State

- Done, verified by file read: the Islands theme (CHG-0668, `c4b9ed37`) is a fourth theme with Canvas, Gap, Radius and Lift controls. Only the hairline style was built.
- Done, verified by file read: the five-design preview `documentation/art-direction/sidebar-prototype.html` and the whole-window mockup `documentation/art-direction/islands-prototype.html` are committed.
- Done, recorded verification: the "nested button" React warning is fixed (CHG-0671, `15076835`). Rows in `sidebar.tsx`, `railRows.tsx` and `railQuests.tsx` are plain views with sibling buttons. A throwaway desktop app showed no warning and 0 nested buttons. See `documentation/verification/2026-11-23-nested-sidebar-buttons.md`.
- Done, recorded verification: `answerFrame` in `packages/service/src/remote/frames.ts` logs the request tag and cause before it answers "The service failed unexpectedly." One unit test covers it.
- Assumed: the three commits are on `origin/main` once the push in this session succeeded; check with `git log origin/main`.
- The nesting dates from the sidebar's first build (2026-11-11), not from a library upgrade (recorded by the fix errand).
- The cause of "The service failed unexpectedly." was never reproduced; the new log line will name it the next time it appears.
- Not checked: touch devices and Android, the Islands theme and dark look with the new row structure, dragging rows, Ritual rows and rows with corner marks, the quest panel column, and the sidebar pinned on the right.
- Not built: an island per conversation pane, and the mockup's realm letter tiles, running-quest dots and search box.

## Decisions

- Only the hairline Islands style is built (owner's request, recorded in CHG-0668).
- Logging the cause in `answerFrame` rather than at the process top was chosen because that is where the cause is otherwise lost; the conventions prefer the process top.
- The owner has not chosen among the five sidebar designs; none was applied.

## Next

1. Pull `origin/main` into the main checkout. It had uncommitted Providers changes, so commit or set those aside first.
2. When "The service failed unexpectedly." appears again, read the service log line it now leaves and fix that request.
3. Ask the owner whether to build an island per conversation pane and the mockup's sidebar row details, and which sidebar design, if any, to apply.
4. Check the unchecked items above, including Android.

## Open questions

- Which of the five sidebar designs does the owner want, if any?
- Should each conversation pane be its own island?
- What request makes the service fail unexpectedly? The log line will answer.

## Sources

- `documentation/changelog/0.2.3-Pre-Alpha.md` (CHG-0668, CHG-0671)
- `documentation/verification/2026-11-23-islands-theme.md`
- `documentation/verification/2026-11-23-nested-sidebar-buttons.md`
- `documentation/art-direction/sidebar-prototype.html`
- `documentation/art-direction/islands-prototype.html`
- `apps/app/src/shell/sidebar.tsx`, `railRows.tsx`, `railQuests.tsx`, `railActions.tsx`
- `packages/service/src/remote/frames.ts` and `packages/service/test/remote/frames.test.ts`
- Commits `c4b9ed37`, `ac011194`, `15076835`
