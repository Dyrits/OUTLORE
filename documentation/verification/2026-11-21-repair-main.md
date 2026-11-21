# Proof: Ritual sidebar build and dependency audit

- **Verdict:** The typecheck and audit repairs are proven. The sidebar interaction needs a window check.
- **Work:** `75d01850` to the repair in `worktree/repair-main`.
- **Agreement:** Repair the failing main checks and refresh and audit dependencies. The sidebar behavior follows [Conversation panes](../capabilities/conversation-panes/specifications.md) and [Rituals](../capabilities/rituals/specifications.md).
- **Environment:** macOS arm64, Bun 1.4.4, Electron 45.4.1. Tests ran in the quest sandbox.
- **Date:** 2026-11-21.

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | The app compiles with both sidebar placements of the Ritual row. | [Failed CI run](https://github.com/Dyrits/OUTLORE/actions/runs/44944597430) | Proven |
| C2 | The updated lockfile installs frozen and clears the reported vulnerability. | [Minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) | Proven |
| C3 | Expanding a Ritual shows its run errands, and **Show N errands** opens its **Errands** tab. | [Sidebar errands](../capabilities/conversation-panes/specifications.md) | Unproven |

## Evidence

### C1. App compiles

`bun run --filter app typecheck` failed on `75d01850` with four prop errors in `railQuests.tsx` and `sidebar.tsx`, matching CI. The same command and two runs of the workspace typecheck exited zero in the repair worktree.

### C2. Frozen install and audit

`bun audit` on `75d01850` reported one moderate advisory. After `bun update` and the scoped override, `bun install --frozen-lockfile --ignore-scripts` succeeded. Repeated audits exited zero and reported no vulnerabilities across 698 packages. The affected `minimatch` dependency ranges now resolve to 11.0.1. The unaffected 3.x and 5.x ranges retain their own versions.

### C3. Run errands

Both sidebar placements supply the existing `onOpenErrands` callback to the Ritual row. It passes the callback and title into the same nested errand list used by quest rows. TypeScript checks the wiring. Opening the row and pressing the button still need a desktop window check.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Typecheck | `bun run typecheck` | App failed with four errors | Passed |
| Lint and format | `bun run check` | Not run | Passed |
| Full suite | `CI=1 bun run test --maxWorkers=4` | Not run | 2,699 passed, 64 skipped, 0 failed |
| Desktop build | `bun run --filter desktop build` | Not run | Passed twice |
| Web export | `cd packages/relay && bun run site` | Not run | Wrote the bundle. The wrapper stayed open, and a repeat with Expo's `--max-workers 1` exited zero. |
| Dependency audit | `bun audit` | One moderate finding | Zero findings |

## Not proven

C3 needs a Ritual with a completed run. Expand the row in each sidebar placement, open the run, then use **Show N errands** to confirm the parent opens on its **Errands** tab.

## Reproduce

Run the app typecheck and audit on the starting commit to observe the failures. Run the following on the repair with Electron installed.

```sh
bun install --frozen-lockfile
bun run check
bun run typecheck
bun audit
CI=1 bun run test --maxWorkers=4
bun run --filter desktop build
(cd packages/relay && bun run site)
```

## New files

None.
