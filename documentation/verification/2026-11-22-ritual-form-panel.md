# Proof: The Ritual form in the middle panel

- **Verdict:** Automated checks passed. The desktop and paired-device window check is pending.
- **Work:** `e26c9f6d` to the Ritual-form-panel implementation on `worktree/ritual-form-panel`.
- **Agreement:** [Rituals specifications](../capabilities/rituals/specifications.md); the owner's request that the middle panel be a quest or a Ritual with a working Companion choice.
- **Environment:** macOS 26.6.2, Bun 1.4.4, Electron as the test runtime, a stub service client for static markup.
- **Date:** 2026-11-22.

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | A new Ritual opens as the conversation area's own screen: the panes of an open quest (or the conversation or screen beneath it) stay mounted unchanged, Back returns to them, and the panes are not remounted on the way back. | Owner's request; CHG-0643 | Proven at the navigation model; the drawn window is pending |
| C2 | **Schedule as a Ritual** and a Ritual's **Edit** open the same middle-panel form; a saved creation or edit closes it by opening the Ritual's conversation. | Owner's request; CHG-0643 | Proven at the navigation model and drawn markup |
| C3 | The form chooses its Companion and each fallback with the named fields (Harness, Account, Companion (model), Effort), not the compact button that opened the Companions column behind the old modal. | Owner's report; CHG-0643 | Proven at drawn markup |
| C4 | On a narrow window the form covers the content under the top bar with a Back, and opening a form closes the menu it was opened from. | Owner's request; CHG-0643 | Narrow layout wiring is asserted by typecheck and code; window check pending |

## Evidence

### C1 and C2. Where the form opens and how it closes

- **Check:** `CI=1 bun vitest run test/shell/location.test.ts` in `apps/app`.
- **Shown able to fail:** the covering assertions do not resolve on the base: `Location` has no `ritualForm` field there, so the tests do not compile against it.
- **Result:** Passed, including the three new tests: covering a quest keeps `openMission` and returns to the same `openCount` after Back (no remount); opening a destination on top of the form (a saved Ritual) clears it; opening a form uncovers the narrow menu.

### C2. The drawn form over the panes

- **Check:** `CI=1 bun vitest run test/rituals/ritualFormScreen.test.ts` in `apps/app`.
- **Result:** Passed. The panel form's static markup contains ← Back, and **New Ritual** stem texts for a plain and an origin-quest creation, with the origin form naming the quest's realm as taken.

### C3. Named Companion fields

- **Check:** the same static-markup test, counting the `Companion (model)` field name per picker.
- **Shown able to fail:** replacing `apps/app/src/rituals/ritualForm.tsx` with its base version and rerunning fails both field assertions (`expected 1 to be 2`, `expected 2 to be 4`): the compact picker draws one combined pill per runner, so the named field never appears. Restoring the implementation passes again.
- **Result:** Passed on the implementation: one named Companion field for a creation, and two with a saved fallback, one per runner, with Remove keeping its own row.

### All claims. Workspace gates

- **Check:** `bun run check`, `bun run typecheck`, and `CI=1 bun run test` in the worktree, starting from `e26c9f6d`.
- **Result:** All pass. The full suite ran for 105 seconds: 2,764 tests passed and 24 skipped (339 files), the skips being the sandbox-gated checks.

## Pending review

- Open the desktop window wide and narrow: press **+ Ritual**, **Schedule as a Ritual**, and **Edit**; check the covered panes come back unchanged on Back, that a saved Ritual opens its conversation, and that the named fields and fallback rows read well at both widths. On a paired phone, check the full-screen form under the top bar and Back.
