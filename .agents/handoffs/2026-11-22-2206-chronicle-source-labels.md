# Handoff: Chronicle source labels

Supersedes: none
Workspace: Outlore, `worktree/chronicle-source-labels`, at `02c269fe` (CHG-0641).

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Every Chronicle row in Attention and History says whether its source is a quest, an errand, or a realm. Done when all three label types land on main and the owner has reviewed the look on desktop.

## State

- Verified by commit and rebase. The delivery commit `02c269fe`, "Show Chronicle source types (CHG-0641)", sits on `worktree/chronicle-source-labels` rebased onto `fbd7aa01`, the tip of `origin/main` at the time of writing; `git merge-base --is-ancestor origin/main HEAD` passes. This handoff's commit follows it. Both are intended to be pushed to `origin/main` together; on resume, confirm `git merge-base --is-ancestor origin/main worktree/chronicle-source-labels` (or that `origin/main` contains `02c269fe`) before building on them.
- Verified by command runs on the rebased tip this session: `bun run check` (Biome, 1,181 files, no fixes), `bun run typecheck` (all seven workspaces exited 0), and the two focused test files `apps/app/test/shell/chronicleFeed.test.ts` and `packages/service/test/work/chronicle.test.ts` (14 tests passed, including the three source types and the fallback). Rebase replays commits without the pre-commit hook, so these were run after the rebase, before pushing.
- Verified by the full suite before the rebase, on the original base `7026ce87`: `CI=1 bun run test` passed with 2,713 tests, 68 sandbox skips, 0 failures; one unrelated lore-fading test passed after two retries. Recorded as the Evidence line of CHG-0641.
- The change, verified by reading the diff of `02c269fe`: `packages/contracts/src/chronicle.ts` gains an optional `source` (`"quest" | "errand" | "realm"`); `packages/service/src/work/chronicle.ts` derives it in SQL (a quest's top thread is a quest, a child thread is an errand, a realm's opening event is a realm); the feed in `apps/app/src/shell/chronicleFeed.ts` prints the label before the title with a fallback for hosts that predate the field, which show no label rather than a guess; `chronicleRows.tsx` lets long titles wrap; the accessibility label speaks the type. Hosts must send the field; a paired older host is the fallback case.
- Assumed, not seen: the visual result on a real desktop window. The owner attached a screenshot to the first message that this session's model could not view (no image input); its contents were never read.

## Decisions

- The changelog entry is numbered CHG-0641, not CHG-0640 as first written: main took CHG-0640 for the background check-in admission slice while this work waited, so the entry was renumbered and the rebase conflict in `documentation/changelog/0.2.2-Pre-Alpha.md` resolved with both entries in order.
- The label sits before the title, so the type stays visible when a long title is clipped; titles wrap instead of truncating mid-line.
- A host that predates the `source` field shows no label rather than a guessed one.
- The owner answered "Okay… commit and push on main" to the request for Git identity values without giving any; taken as assigning the owner's own identity for these commits, per the realm rule that forbids guessing or inventing one. Every commit in the repo carries it. The attribution line `Z.ai - GLM-5.3` names the actual provider and model in every commit message.

## Next

1. Push the delivery and handoff commits to main: `git push --no-verify origin worktree/chronicle-source-labels:main` from the worktree (a branch push to main needs `--no-verify` for the branch guard; the owner already approved committing and pushing on main in this conversation). Verify first that `origin/main` has not moved again.
2. Ask the owner what the screenshot showed and do a desktop window review of the three labels in Attention and History, including a long title that wraps and a paired host that predates the field.
3. After the review, record the verified look in the CHG-0641 Validation line and retire the thread: remove the worktree and its `worktree/chronicle-source-labels` branch, and drop this thread's line from `AGENTS.md`.

## Open questions

- What the owner's screenshot showed; no session has been able to view it.
- No dedicated agent Git identity exists; the owner has not assigned one. Re-ask before any future commit if the assumption above is challenged.

## Sources

- Commit `02c269fe` on `worktree/chronicle-source-labels`: `packages/contracts/src/chronicle.ts`, `packages/service/src/work/chronicle.ts` and `packages/service/test/work/chronicle.test.ts`, `apps/app/src/shell/chronicleFeed.ts`, `apps/app/src/shell/chronicleRows.tsx`, `apps/app/src/shell/chronicleActivity.tsx` and `apps/app/test/shell/chronicleFeed.test.ts`
- [Conversation panes specification](../../documentation/capabilities/conversation-panes/specifications.md#main-conversations-and-channels)
- CHG-0641 in [changelog 0.2.2-Pre-Alpha](../../documentation/changelog/0.2.2-Pre-Alpha.md)
