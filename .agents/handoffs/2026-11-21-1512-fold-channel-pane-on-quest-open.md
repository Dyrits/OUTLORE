# Handoff: fold the realm channel pane when a quest opens

Supersedes: none
Workspace: Dyrits/OUTLORE (checked out at `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked (2026-11-21): when a quest is opened from the sidebar, only the quest panel should be open — the realm (channel) panel should be folded by default. Done looks like: every quest open lands the owner on the quest conversation alone, with the channel pane one notch-press away, and the owner's own folds kept for the rest of that quest.

## State

- CHG-0613 is implemented and committed as `849774e7` on `main` ("Fold the channel pane behind its notch when a quest opens"). Verified: `git log` shows the commit on `main` at the time of writing.
- The rule lives in the pure pane-chain module so the component only draws it:
  - `apps/app/src/shell/paneChain.ts` — new `openedQuestMemory(channel, weights)`: the pane memory a quest opens with (realm channel folded, weights kept), used by `usePaneChain`'s initial `useState`; `prunedMemory` now prunes nothing while the chain is empty (the quest's thread tree is still loading), otherwise that first prune wiped the initial fold on every `PaneHost` mount.
  - `apps/app/src/shell/usePaneChain.ts` — initial memory is `openedQuestMemory(channelId, readPaneWeights())`.
  - Behavior comes from `PaneHost` remounting per quest open (React key `` `${openMission}:${openCount}` `` in `apps/app/src/shell/appScreen.tsx`), so the initial memory is the quest-opening default; folds the owner makes afterwards hold for the rest of that quest (errand opens and Workshop round trips do not remount).
- Tests, written red first: 5 new tests in `apps/app/test/shell/paneChain.test.ts` describe "a quest opened from the sidebar" (only the quest pane open, errand variant, kept weights, notch reveal brings the channel back, folded channel survives the loading prune). Verified: run this session on the owner's machine — `CI=1 bun run test apps/app/test/shell/paneChain.test.ts` first failed the five (red), then passed all 38; `CI=1 bun run test apps/app` passed 88 files, 681 tests, 6 skipped; `bunx biome check` clean on the changed files; `bun run --filter app typecheck` exit 0. The pre-commit hook re-ran Biome, the whole workspace typecheck and the related tests at commit time, all green.
- Not checked: nothing was seen in a desktop window. The owner must look at: the channel notch on the quest pane's left edge, the notch press revealing the channel beside the quest, and the next quest opening folded again. `bun run dev` starts the desktop app for that look.
- Not run: the full workspace test suite for this batch; the changed code is covered by the app suite.
- The working tree has an unrelated untracked `.tmp-test/` directory left by an earlier session; it is not part of this work.

## Decisions

- The fold is a per-quest-open default, not a remembered preference: each quest open (sidebar, Chronicle, channel Quests tab) starts folded, because `PaneHost` remounts per quest open and there is no persisted pane memory. If the owner wants "revealed once, stays revealed", that needs persisted state and is a new decision.
- The default is expressed in pure `paneChain.ts` functions with its tests, not in the hook or the component (repository convention: logic a component decides with lives in a plain `.ts` module).
- Recorded in: changelog `documentation/changelog/0.2.1-Pre-Alpha.md` (CHG-0613), spec `documentation/capabilities/conversation-panes/specifications.md` ("The window" section), `documentation/work-in-progress.md` (top entry), verification note `documentation/verification/2026-11-21-fold-channel-on-quest-open.md`.

## Next

1. The owner looks at a desktop window (open the app, open a quest from the sidebar): only the quest pane shows; the realm channel is a notch on its left edge; pressing the notch reveals the channel; opening another quest folds the channel again.
2. If the look shows a problem (for instance the notch is hard to find, or folding on opens from the channel's own Quests tab feels wrong), fix or refine as CHG-0614 and note it in the changelog of `0.2.1-Pre-Alpha`.

## Open questions

- Should a channel the owner revealed stay revealed across the next quest open? Today it re-folds (the default). Only the owner can say; ask before persisting anything (would need stored pane memory keyed by realm, not today's session-scoped memory).
- The full workspace suite was not run for this batch; run `CI=1 bun run test` before the next release if that release includes CHG-0613.

## Sources

- Commit `849774e7` on `main` — the change, the five red-first tests, and all records (changelog, spec, work-in-progress, verification note) in one commit.
- `documentation/changelog/0.2.1-Pre-Alpha.md` — CHG-0613 entry.
- `documentation/capabilities/conversation-panes/specifications.md` — agreed behavior; the new bullet cites CHG-0613.
- `documentation/verification/2026-11-21-fold-channel-on-quest-open.md` — which commands were run this session and what was not checked.
- `apps/app/src/shell/paneChain.ts`, `apps/app/src/shell/usePaneChain.ts`, `apps/app/src/shell/appScreen.tsx`, `apps/app/test/shell/paneChain.test.ts` — code and tests.
- `documentation/backlog.md` — where a follow-up belongs if the owner wants more pane work.
