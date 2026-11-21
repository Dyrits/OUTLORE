# Mistral Vibe's reasoning levels in the Companion menu

The Companion menu showed no reasoning level for Mistral Vibe. `listVibeModels` read a model's effort levels only
from its `_meta["mistral.ai/thinking"]` in the `model` config option of one short `vibe-acp` session — levels a
newer Vibe build carries — and the released `vibe-acp` 3.1.3 reports no `_meta` on any model (verified with a live
probe: five models, none with levels; the levels 3.1.3 offers sit on the session's own `thinking` config option,
`low`/`high`/`max`). So every model listed no effort, and the effort picker stays hidden when a model offers none
(`apps/app/src/editors/runners.tsx` shows it only with more than "default").

The fix, in `packages/service/src/harness/vibeAccount.ts`: `modelOptionListOf` also reads the session's `thinking`
config option, and a model that says no levels of its own takes its values; a model that says its own keeps them.

Checks, run 2026-11-21 in `.worktrees/vibe-thinking-levels` (branch `worktree/vibe-thinking-levels`, from `3132caec`):

- Red-green: `CI=1 bun run test packages/service/test/harness/vibe.test.ts` — the model-list test first failed
  expecting the stand-in's level-less model to carry the session's levels (1 failed, 10 passed), and passed after
  the fix (11 passed).
- Live against the installed `vibe-acp` 3.1.3: the fixed `listVibeModels` returned all five models, each with
  efforts `low`, `high`, `max`; before the fix the same probe returned none with efforts.
- `packages/service/test/harness/harnessTools.test.ts` and `liveHarnesses.test.ts` passed (9 passed, 5 skipped —
  the live suite skips without its harnesses installed). Biome passes on the changed files, and the workspace
  typecheck passes.

A newer `vibe-acp` that carries per-model `_meta["mistral.ai/thinking"]` levels again takes over per model without
a change.

To re-verify: `CI=1 bun run test packages/service/test/harness/vibe.test.ts`, and for the live check run
`listVibeModels` against the installed `vibe-acp` and compare the models' `efforts` with its `thinking` option.
