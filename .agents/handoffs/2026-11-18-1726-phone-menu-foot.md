# Handoff: the phone menu's foot pinned to the bottom (CHG-0508), staged, commit blocked by a concurrent session

Workspace: OUTLORE, main checkout, branch `main` (edited in place, not in a worktree). Written 2026-11-18 17:26 UTC while the owner is AFK.

## Goal

The owner's phone screenshot showed the full-screen menu's foot — the plan-limit rings and the **Workshop** row — packed at the top of the screen. Done means the foot sits at the bottom of the phone menu, verified in a running window, with a changelog entry. The push to `origin/main` is not done and needs the owner's approval.

## State

- Verified: the cause. On a narrow window (< 820 px) `Shell` renders the menu as `<View style={local.narrowContent}><Sidebar width="100%"/></View>` (`apps/app/src/shell/shell.tsx`); `narrowContent` is a column and `local.sidebar` (`railStyles.ts`) has no vertical grow, so the sidebar's root was content-height and its foot followed the scrolling list at the top. On a wide window the sidebar sits in the frame's row and stretches, which is why desktop was correct.
- Verified: the fix. The menu wrapper is now `[local.narrowContent, local.menuScreen]` with `menuScreen: { flexDirection: "row" }`, so the sidebar stretches to the window's height exactly as in the wide frame. One component, one style; the wide layout is untouched.
- Verified red then green with a CDP loop: Expo web server on 8081 + Electron (`--remote-debugging-port=9333`, `OUTLORE_HARNESS=fake`, `OUTLORE_DATA_DIR=/tmp/outlore-dbg-data`), viewport 390 × 780 via `Emulation.setDeviceMetricsOverride`, click `[aria-label="Open the menu"]`, measure `getBoundingClientRect()` of `[aria-label="Workshop"]`. Before: bottom 317 of 780. After: 772 of 780. Wide 1200 × 800 rail: 792 of 800 before and after. Screenshots and the loop's description: `documentation/verification/2026-11-18-phone-menu-foot.md` (+ `2026-11-18-phone-menu-foot/`). Driver scripts were throwaway, in `/tmp/outlore-dbg/`.
- Verified when the tree was consistent: `bun run check` (911 files) clean, `bun run typecheck` clean on all seven workspaces, `bun run test apps/app` 74 files, 534 passed, 6 skipped.
- Recorded: changelog entry CHG-0508 appended to `documentation/changelog/0.1.10-Prototype.md` (newest tag is `0.1.9-Prototype`).
- Staged (index), not committed: `apps/app/src/shell/shell.tsx`, `documentation/changelog/0.1.10-Prototype.md`, `documentation/verification/2026-11-18-phone-menu-foot.md` and its three PNGs. Commit with `git commit -- apps/app/src/shell/shell.tsx documentation/changelog/0.1.10-Prototype.md documentation/verification/2026-11-18-phone-menu-foot.md documentation/verification/2026-11-18-phone-menu-foot` and the usual message.
- Blocked: the pre-commit hook runs the workspace typecheck on the working tree, and a concurrent session is mid-edit adding a `vibe` harness (`packages/contracts/src/harnesses.ts`, `packages/service/src/harness/*`, `apps/app/src/shell/usageColors.ts`, `apps/app/src/ui/providerMarks.tsx`, untracked `vibe.ts`), which fails typecheck until it finishes. Retry the commit once that lands; do not use `--no-verify`.
- Not checked: a real phone (the 390 px Electron web layout stands in, as in earlier batches), the plan-limit rings themselves (the fake harness reports no plan limits; the loop measured the foot's Workshop row, the rings render in the same foot), light and Iskios looks, resizing across the 820 px breakpoint with the menu open. The owner's look on the phone remains open.

## Next

1. When the working tree typechecks clean again (the other session's `vibe` work landed or was reverted), commit the staged paths above; the hook runs Biome, typecheck and the related tests.
2. Push needs the owner's approval (`git push` to protected `main`; the guard asks). Then the owner looks at the phone menu: rings and Workshop at the bottom.

## Sources

- Fix: `apps/app/src/shell/shell.tsx` (narrow menu wrapper + `menuScreen` style); spec line "a narrow window's full-screen sidebar has the same foot" in `documentation/capabilities/mission-tracking/specifications.md` (simplified left navigation).
- Evidence: `documentation/verification/2026-11-18-phone-menu-foot.md`; changelog CHG-0508 in `documentation/changelog/0.1.10-Prototype.md`.
