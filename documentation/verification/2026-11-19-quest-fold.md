# Proof: quest folding

- **Verdict:** not proven end to end
- **Work:** working tree on 8d4b767
- **Agreement:** owner requested that folding work and opening another quest not fold the first.
- **Environment:** macOS, Bun, Electron/Vitest; 2026-11-19.

## Claims

| Claim | Verdict |
| --- | --- |
| The selected quest can be folded. | Unproven end to end; state calculation checked. |
| Selecting another quest preserves the first quest's fold. | Unproven end to end; state calculation checked. |

## Evidence

`bun run test apps/app/test/shell/railOutline.test.ts` passes all 6 tests on the fix. The same tests copied into a separate checkout of 8d4b767 fail 3 assertions because the selected quest is forced open. The tests exercise the outline calculation, not clicks or the running app; a live interaction is still needed. The checks have not been independently reproduced from the proof.

## Regressions

On the working tree, `CI=1 bun run test` passed 2,194 tests, with 51 skipped; `bun run typecheck`, `bun run check`, and `git diff --check` passed. Build and live UI checks were not run. Baseline full checks were not run.

## Reproduce

Run `bun run test apps/app/test/shell/railOutline.test.ts` on the fix; copy that test into a checkout of 8d4b767 and run it there to see the three expected failures. In the running app, fold the selected quest and switch between two quests with different fold states.

## New files

This proof; the regression tests are additions to an existing test file.
