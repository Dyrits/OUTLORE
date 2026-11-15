# Outlore rename

## Verdict

The app is renamed Outlore, the assistant Chronicler, and One is the default theme; checked headlessly and in a throwaway Electron window. The owner's look is pending. Agreement: [CHG-0285](../changelog/0.1.4-Prototype.md).

## Scope

- Starting revision `3269091`; nothing committed.
- Done by [`rename.py`](2026-11-15-outlore-rename/rename.py) over the tracked code files, then by hand: the app against the assistant on each line of prose was decided one by one (the script guesses, and was wrong often enough that every "Chronicler" and the assistant-heavy "Outlore" lines were read), the Iskios theme left as it is, the default theme, former-data moves for an `Iskios` folder, migration 0050, and the current documents.
- The application icon is unchanged; the owner's new icon is kept as received in [brand](../brand/README.md).

## Checks

Run from the repository root with Bun 1.4.3 (the README pins 1.4.4):

```sh
bun install            # relinks the workspaces under @outlore/*
bun run check          # Biome: 653 files
bun run typecheck      # six workspaces
env -u CLAUDE_CONFIG_DIR CI=1 bun run test --maxWorkers=4
```

- Biome and the typecheck pass.
- The full suite, outside Claude Code's sandbox: first run 1,601 passed, 1 failed, 18 skipped. The failure was a test query ("is") that matched the old fixture name "Iskios" and not "Outlore"; the query is now "ou". That file then passed alone (9 tests). The whole suite then passed after the last edits: **1,602 passed, 18 skipped**, 156 files passed and one skipped; `bun run check`, the typecheck and `git diff --check` passed again.
- New or changed tests: `store.test.ts` (migration 0050 renames the assistant's stored titles and no other; 0041 keeps its own expectations), `formerData.test.ts` (an `Iskios` install moves into `Outlore`, its `iskios.sqlite` renamed `outlore.sqlite`, its Claude sessions renamed), `themeRules.test.ts` (One is the default and first), `appIcon.test.ts`, `appGuide.test.ts`, `pairingCode.test.ts`.

## Window drive

`bun run --filter desktop build`, an Expo dev server on port 8105 and Electron with a fresh profile and data folder under the ignored `.expo/`, the fake harness, and `OUTLORE_*` variables; read through the debugging port with [`drive.mjs`](2026-11-15-outlore-rename/drive.mjs) (Node's own WebSocket).

- Window title `Outlore`; the bridge is `window.outlore` (no `window.iskios`).
- (Run before the storage keys were renamed.) With nothing stored the page draws One (light, the system's look here): ground `rgb(220, 220, 221)`, the One light ground of the earlier check.
- The top bar's button reads "Chronicler" and its label "Ask Chronicler"; the panel is titled Chronicler with "Tell Chronicler what you need."; the Guild Hall says "Ask Chronicler for one."
- Workshop → Look and feel lists Theme as One, Iskios, Gild, with One selected.
- Screens: [Chronicler panel](2026-11-15-outlore-rename/chronicler-panel.png), [Look and feel](2026-11-15-outlore-rename/look-and-feel.png).

## Not checked

- A packaged build, the installer, the macOS updater against an `Outlore-…dmg`, or the first launch of an installed Outlore moving a real `Iskios` data folder (only `formerData.test.ts`).
- The Iskios and Gild themes in a window after the change, dark mode, a paired host, Windows and Linux, a real provider turn.
- An old pairing code (`iskios1-`) is refused as an unsupported code, and devices paired before the rename no longer connect (the handshake label is now `outlore/1`). The relay was renamed in code only: `outlore-relay` is not deployed, so no pairing through the shared relay was run.
- The release workflow's new step (a copy of each macOS installer named `Iskios-<version>-mac-<arch>.dmg`, listed in `SHA512SUMS.txt` and uploaded) was exercised only as a shell fragment on empty files, and `actionlint` is not installed here. Nothing ran in CI, and an installed Iskios 0.1.3 updating through it is unproven. Reading `stage.ts` and `swap.ts`: the old updater copies the app found in the image to a hidden path and swaps it into its own bundle path, so the result is Outlore at `/Applications/Iskios.app`.

## Repository and relay (2026-11-15)

- `gh repo rename OUTLORE` on `Dyrits/ISKIOS`; `gh repo view Dyrits/OUTLORE` answers. The original checkout's `origin` remote was not edited.
- `wrangler deploy` of `packages/relay` as `outlore-relay` on the owner's account (already logged in by OAuth): `https://outlore-relay.dyrits.workers.dev`, version `b175b668-73ac-4519-9ee3-87e31ce4b36c`. A throwaway host WebSocket to a random room opened and answered `ping` with `pong`. No pairing between two apps through it was run. The old `iskios-relay` Worker was not touched.


## Proof (`/verify`, 2026-11-15)

Starting commit `3269091`; end state is the working tree at commit time (uncommitted until then). Overall verdict: **not fully proven**: 11 claims proven, 0 failed, 3 unproven, 1 awaiting human judgment.

Commands were run from the repository root. Mutations were made only in a throwaway worktree of the end state (`git worktree add --detach /tmp/outlore-mut HEAD`, working-tree patch applied, removed afterwards); the checkout itself was not mutated.

| # | Claim | Evidence | Shown able to fail | Verdict |
| --- | --- | --- | --- | --- |
| 1 | One is the default theme and is listed first (One, Iskios, Gild) | `themeRules.test.ts`; window drive (`drive-final.mjs`): nothing stored, ground `rgb(220, 220, 221)` = One light, Theme choice `["One","Iskios","Gild"]` | M1: default back to `"iskios"`: the test fails (`expected 'iskios' to be 'one'`) | proven |
| 2 | The Iskios theme is still selectable, persists, and keeps the old icon | Drive: choosing Iskios stores `outlore.theme = iskios`, ground becomes `rgb(235, 227, 216)`, screen `2-iskios-theme.png`; `git diff --stat HEAD -- apps/desktop/assets apps/app/assets` is empty (every icon byte-identical) | M5: Iskios's icon file swapped: `appIcon.test.ts` fails | proven (the Dock icon was not observed) |
| 3 | The window and bridge are Outlore | Drive: title `Outlore`, `typeof window.outlore` is `object`, `window.iskios` is `undefined`, storage keys `["outlore.theme"]` only; `instance.test.ts` | the stale-name scan below is 0 where HEAD had hundreds | proven |
| 4 | The assistant is Chronicler: top bar button, panel, instructions, stored titles | Drive: label `Ask Chronicler`; new test `guildmaster.test.ts > the assistant's name`; `store.test.ts` (migration 0050 renames its quest and thread titles and no other) | M6: title constant back to `"Iskios"`: the new test fails (this mutation survived before the test existed, so the test was added); M2: migration 0050 emptied: `store.test.ts` fails | proven |
| 5 | An `Iskios` user-data folder and database move into `Outlore` on first launch | `formerData.test.ts` (database and write-ahead file renamed `outlore.sqlite*`, Claude sessions renamed) | M3: `"Iskios"` removed from the former names: two tests fail | proven at unit level; real install **unproven** |
| 6 | The update check looks for `Outlore-<version>-mac-<arch>.dmg` | `apps/desktop/test/updates/*` | M4: the name changed to `Iskios-`: `macUpdater.test.ts` fails (`Nothing` instead of `Ready`) | proven |
| 7 | Only the `0.1.4-Prototype` release also publishes `Iskios-<version>-mac-<arch>.dmg` copies, listed in `SHA512SUMS.txt` | `check-release-copy.sh` runs the workflow's own lines (cut out of `package.yml`): tag `0.1.4-Prototype`: 2 copies, 6 names in the sums; tag `0.1.5-Prototype`: 0 copies, 4 names | Mutation: the tag guard replaced by `true`: tag `0.1.5-Prototype` then yields 2 copies | proven as a shell fragment; **not run in CI** |
| 8 | An installed Iskios 0.1.3 updates itself into Outlore through that copy | Read from `stage.ts` and `swap.ts` only | none | **unproven** |
| 9 | The pairing code starts `outlore1-` and an old prefix is refused | `pairingCode.test.ts` | M7: the prefix back to `iskios1-`: the test fails | proven |
| 10 | The `outlore-relay` Worker is deployed and accepts a host connection | `node relayprobe.mjs` (WebSocket to a random room on `outlore-relay.dyrits.workers.dev`): `open, answered pong` | the same probe at `outlore-relay-nonexistent.dyrits.workers.dev`: `error` | proven (no two-app pairing through it) |
| 11 | The repository is `Dyrits/OUTLORE` | `gh repo view Dyrits/OUTLORE` answers `OUTLORE https://github.com/Dyrits/OUTLORE` | a name that does not exist would not answer | proven |
| 12 | No stale name is left in code | `git ls-files … \| xargs grep -E "window\.iskios\|ISKIOS_\|@iskios/\|iskios\.sqlite\|mcp__iskios\|app\.iskios\|iskios-app\|iskios-relay"` outside dated documents: 0 matches | HEAD matches hundreds of lines | proven |
| 13 | Nothing else broke | `bun run check` (665 files), `bun run typecheck` (6 workspaces), `git diff --check`, `env -u CLAUDE_CONFIG_DIR CI=1 bun run test --maxWorkers=4`: **1,603 passed, 18 skipped**, 156 files passed, 1 skipped | not applicable (the starting commit passed the same suite before this work: 1,599 passed in the 0.1.3 record) | proven |
| 14 | A packaged build is named Outlore (bundle, installer, Dock) | not run: no `bun run package` | none | **unproven** |
| 15 | The look and feel are acceptable | screens in this folder | none | awaiting human judgment |

Reproduction: the commands above were rerun by the agent that wrote them from a fresh shell (`bun run check`, `typecheck`, the full suite, `check-release-copy.sh` for both tags, the relay probe, `gh repo view`); no independent subagent was used. The mutation results were each observed once.

Files: `drive-final.mjs` (window drive), `check-release-copy.sh`, `1-default.png`, `2-iskios-theme.png`, the earlier `drive.mjs`, `rename.py`, and two screens above.
