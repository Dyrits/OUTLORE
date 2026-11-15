# Handoff: Outlore rename, Chronicler, One as default, 0.1.4 release

Supersedes: none (forked from `2026-11-14-1953-host-browser-architecture.md`)
Workspace: ISKIOS (GitHub `Dyrits/OUTLORE`, renamed from `Dyrits/ISKIOS`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The app is renamed Outlore, with the old name kept only as a theme, and 0.1.4-Prototype is published so an installed Iskios 0.1.x can update into Outlore. Done means the owner accepted the look, the release was tagged with the owner's approval, and an installed Iskios was seen updating through it.

## State

- **Verified by `git rev-parse` just now:** the rename is on `origin/main` as one commit, `92b0a04`, with nothing uncommitted. The owner then asked for this handoff to be added by amending that commit and pushing again; check `git log origin/main` for whether that happened and for the commit's final hash.
- **Verified by the full run during verification:** `bun run check`, `bun run typecheck` (six workspaces) and `env -u CLAUDE_CONFIG_DIR CI=1 bun run test --maxWorkers=4` pass, 1,603 tests passed and 18 skipped, on the tree committed as `92b0a04`.
- **Verified by a throwaway Electron drive:** window title `Outlore`, `window.outlore` is the bridge, One is the default (page ground `rgb(220, 220, 221)`), the Theme choice lists One, Iskios, Gild, choosing Iskios stores `outlore.theme` and draws the Iskios palette, the top bar says Chronicler.
- **Verified by mutation in a throwaway worktree:** seven behaviours were each broken and the matching test failed; one mutation survived (the assistant's title) until a test was added.
- **Verified by `gh repo view` and a WebSocket probe:** the repository is `Dyrits/OUTLORE`, and `https://outlore-relay.dyrits.workers.dev` accepts a host connection and answers a ping. A nonexistent name fails the same probe. The old `iskios-relay` Worker still runs and was left alone.
- **Assumed, not run:** the release workflow's new copy step. Its own lines were run as a shell fragment on stand-in files (tag `0.1.4-Prototype` gives two `Iskios-…dmg` copies, tag `0.1.5-Prototype` none); it has not run in CI, and `actionlint` is not installed.
- **Assumed, not run:** an installed Iskios 0.1.3 updating through the copy. Read from `apps/desktop/src/updates/stage.ts` and `swap.ts` only: the app found in the image is swapped into the old bundle path, so the result is Outlore at `/Applications/Iskios.app`.
- **Not run:** a packaged build, the installer, the first launch moving a real `Iskios` data folder (only `apps/desktop/test/formerData.test.ts`), Windows and Linux updates, the Iskios and Gild themes in dark mode.
- No tag exists for 0.1.4-Prototype. The owner approved the commit and the push to `main`, not the tag.

## Decisions

- **Full rename, as in CHG-0143** (the owner's choice): window, bundle and installer names, `@outlore/*`, `OUTLORE_*`, `window.outlore`, `outlore.sqlite`, MCP server `outlore`, `app.outlore.desktop`, the app scheme `outlore-app`, storage keys `outlore.*`, handshake label `outlore/1`, pairing prefix `outlore1-`, relay Worker `outlore-relay`. The owner said a prototype may break between releases, so saved theme and drafts reset once and devices paired before must be paired again. Recorded in CHG-0285 in `documentation/changelog/0.1.4-Prototype.md`.
- **The assistant is Chronicler** (the owner's answer). Code identifiers that named it say Chronicler; `guildmaster` remains in older names. Migration `0050_assistant_renamed_chronicler` renames its stored titles; `0041_assistant_renamed_iskios` keeps its id and meaning.
- **Iskios stays a theme and keeps the original application icon; One is the default and is listed first.** The owner's new Outlore icon is stored as received in `documentation/brand/outlore-icon-2026-11-15.png` and is not used: the owner asked to keep the old icon for now.
- **Release compatibility:** only the `0.1.4-Prototype` release also publishes `Iskios-<version>-mac-<arch>.dmg` copies (the workflow checks the tag), because an installed Iskios 0.1.x looks for exactly that name and cannot be changed. The Outlore app looks for `Outlore-…` names, so 0.1.5 needs no copy. The owner proposed this plan; the tag is hard-coded in `.github/workflows/package.yml`.
- **Renamed outward at the owner's word:** the GitHub repository and the Cloudflare Worker `outlore-relay` were done in this session ("You do that"). The original checkout's `origin` still names the old address, which GitHub redirects.
- **Pushing to `main` needs `git push --no-verify`** because the pre-push hook refuses protected branches; the owner's instruction to push to `main` was taken as that approval for this push only.

## Next

1. Confirm with the owner what they want first; their look at the running app is still pending. Run the app with `bun run dev` (it opens as **Outlore Dev** on its own profile) or follow `documentation/verification/2026-11-15-outlore-rename.md` for a throwaway window.
2. With the owner's approval, tag `0.1.4-Prototype` (no `v` prefix) and watch the release workflow, the first CI run of the copy step. Check that the release carries both `Outlore-…` and `Iskios-…` macOS installers and that `SHA512SUMS.txt` lists both.
3. Prove the update: use `apps/desktop/scripts/check-update.ts` (see the README) or an installed Iskios 0.1.3, and check the app that results is named Outlore and keeps the old data (the `Iskios` data folder moved to `Outlore`).
4. After the first Outlore release, 0.1.5 needs no change to the workflow; confirm its release has no `Iskios-…` files.
5. Leftovers, when the owner wants them: use the new icon (make its black outside transparent and cut it like the Gild icon, see `documentation/brand/README.md`); redo the README screenshots and GIF, which still show the old name and assistant; older capability text that still says Guildmaster; the `~/.iskios/` paths in `documentation/capabilities/workspace-attachment/specifications.md`.

## Open questions

- Does the owner accept the look? Only the owner can say.
- Whether the Outlore app should rename its own bundle from `Iskios.app` after an update, so Finder shows Outlore. Not designed.
- The updater could match any `-<version>-mac-<arch>.dmg` regardless of the product name, so a later rename needs no copy. Offered to the owner, not decided or built.
- The Windows and Linux updaters were never run, and the product name changed; an NSIS installer under a new name may install beside the old app. Needs a run on those systems.

## Sources

- `documentation/changelog/0.1.4-Prototype.md` (CHG-0285)
- `documentation/verification/2026-11-15-outlore-rename.md` and the folder beside it (proof, drive scripts, `check-release-copy.sh`, screens)
- `documentation/work-in-progress.md` (the top entry)
- `.github/workflows/package.yml` (the copy step in the release job)
- `apps/desktop/src/formerData.ts`, `apps/desktop/src/updates/`, `packages/service/src/core/recentStoreMigrations.ts`
- `documentation/brand/README.md`, `documentation/backlog.md` (the icon entry)
- Commit `92b0a04`; rename script `documentation/verification/2026-11-15-outlore-rename/rename.py`.
