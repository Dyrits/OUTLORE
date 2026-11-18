# Verification: Sidebar creation controls and backup label

- **Work:** CHG-0462, based on `bc3787c`.
- **Environment:** macOS, local Expo web export, Chromium, isolated Outlore service with the fake harness and a throwaway SQLite database. The fixture held one folder-backed realm and one realm without a folder.
- **Verdict:** Browser checks passed. Native rendering and the owner's visual review remain open.

| Claim | Observation | Baseline at `bc3787c` |
| --- | --- | --- |
| A small plus accompanies the castle | The sidebar action's SVG contains the plus path. The same icon appears in the overview toolbar. | The sidebar castle contains no plus. |
| A horizontal line separates the list from the actions | The line immediately above **Visit a realm** measured 1 × 251 CSS px at 1360 × 850, with an opaque gray fill. It also measured 1 px high at 390 × 844. | There is no line immediately above the action. |
| Only folder-backed realms show the leading folder | The first element of the folder-backed realm row has the folder path as its title. The folderless realm has no folder cue. | The existing folder cue follows the name. |
| The global quest action creates outside the current realm | Opened the folder-backed realm's overview and pressed the sidebar's **Start a quest**. The Realms overview showed both realm counts at zero, then the new quest below them. | The request already sent `realmId: null`. Existing service tests cover the distinction between a realm and no realm. |
| The backup link uses lowercase | Settings → Companions → edit the default companion shows **+ Add a backup companion**. | The same view shows **+ Add a backup Companion**. |

The desktop comparison ran against separate web exports with the same service and fixture. To repeat it, create a realm tied to a temporary folder and a realm without a folder in an isolated fake-harness session, then open Realms. At phone width, use **Open the menu** to show the sidebar. For the quest check, start with empty realms so the counts and placement are visible.

The initial handoff reported 33 focused tests and Biome passing, with incomplete dependencies blocking typecheck, full tests, and export. Rerunning `.agents/worktree-setup.sh` restored the missing packages. `bun run check`, `bun run typecheck`, and `CI=1 bun run test --maxWorkers=4` passed (2,056 tests, 50 skipped). The full suite preceded the backup label edit. The final web export passed with `CI=1 bunx --no-install expo export --platform web`. Aside local authentication failed. Playwright used a writable temporary daemon directory and isolated Chromium because the sandbox blocked the default cache and browser startup.
