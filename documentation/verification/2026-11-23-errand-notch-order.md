# Errand notch order · 2026-11-23

The owner requested that errand notches match the sidebar order.
The sidebar consumes the service's tree order through `sideQuestRowsOf` and `foldThreads` without sorting.
Errand child shortcuts now preserve that order, and a folded errand is inserted at its tree position among the other shortcuts.
Quest shortcuts retain urgency ranking, and overflow retains the most urgent hidden state.

Starting revision: `8aa83e49`.

Checks run:

- `bun run test apps/app/test/shell/childNotches.test.ts apps/app/test/shell/paneNotches.test.ts apps/app/test/shell/questTree.test.ts apps/app/test/rituals/ritualRow.test.ts`: 46 passed across four files.
- `bun run check`: passed, 1234 files.
- Targeted Biome check after formatting: passed, four files.
- `git diff --check`: passed.
- `bun run typecheck`: all seven workspace packages passed.

Tests cover preserved tree order despite urgency and recency differences, the four-shortcut limit, overflow state, and placement and reopening of a folded errand among its siblings.
Tests were not repeated after formatting.
Running-app visual verification remains pending.
