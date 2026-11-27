# Handoff: the Companion mention with @ is built

Supersedes: `2026-11-27-0715-message-marks-and-companion-mention.md`
Workspace: Outlore repository, branch `main` (fast-forwarded to `9fe2307c`; not pushed when this was written)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A message that names a model with `@` is answered by that model in the same conversation while the main Companion carries on; done means it works in a real window and on a real harness, not only against the fake harness.

## State

- Built (CHG-0781), commit `9fe2307c`, merged into `main` by fast-forward. Verified now on the merged tree: `bunx biome check packages apps` clean; `bun run typecheck` clean on 7 workspaces; `GIT_CONFIG_VALUE_0= CI=1 bun run test packages/service packages/contracts apps/app` gave 389 files passed, 7 skipped, 3,273 tests passed, 80 skipped, 0 failed.
- Shape: each mentioned model has its own thread in a hidden one-thread quest of kind `companion` (migration `0082_companion_mentions`: `missions.is_companion`, `companion_threads`, `companion_exchanges`), so the planned side-run scope and per-run MCP token were not needed (`SideTurnScope` stays reserved and unused in `work/turnScopes.ts`). Token `@companion:<harness>:<account or ->:<model>`, at most 5 per message. A message with tokens is conversation-only for the main Companion; answered exchanges ride on its next turn as one context line and never start a turn. Refusals read `Cannot answer: <cause>` (account gone, signed out, budget, plan window with reset time, failed turn, restart). A Companion thread may call only `request_approval` and `answer_prompt`. Details: `documentation/capabilities/thread-messaging/specifications.md` and `blueprint.md`, CHG-0781.
- Not checked: the `@` list, chip, reply label and a Companion's approval card in the desktop window and on the phone; a live harness turn; a real signed-out or over-quota account; whether a real harness failure text carries a reset time (only the plan-window reading is formatted with one). Also unchecked from earlier work: `#`, `+`, `$` and the keep icon in a window.
- Known gaps: a Companion's approval question does not mark the quest as needing the owner in the sidebar or Chronicle; `appGuideTopics.ts` writes the marks by hand instead of reading `marks.ts`; attachments are not forwarded to the model.
- The branch `worktree/companion-mention` and its folder `.worktrees/companion-mention` still exist; the other two worktrees (`.worktrees/turn-scope`, `.worktrees/quest-visibility`) are merged and can be removed (git worktree commands need approval and run outside the sandbox).

## Decisions

- The answer is the Companion's last message of its turn; several models answer as they finish, not in chip order; a second question while one is answering is steered into the running turn and the one answer is copied under the latest.
- Usage is reported under the quest it answered in; the account budget counts it, the quest's own budget does not.
- `@` is offered only in a quest's or errand's box (`mentions.canAskCompanions`); Chronicler's box and an errand's opening message read `@` words as plain text.
- Earlier decisions (the mentioned model works in the quest's folder with its permission mode; one resumed session per model per conversation; a plain refusal line) stay as in the superseded handoff.

## Next

1. Confirm with the owner whether to push `main` (it is ahead of `origin/main` by the Companion commit; a push to `main` needs the owner's approval and `git push --no-verify origin main`, since the pre-push hook refuses it).
2. Try `@` in the desktop window and on the phone with a real signed-in model, including an approval question and a signed-out or over-quota account; fix what shows.
3. Mark a quest as needing the owner when its Companion asks an approval question; make `appGuideTopics.ts` read the marks table.
4. Remove the three merged worktrees and branches once the owner agrees.

## Open questions

- Whether other owner-visible places should show a Companion's exchange (Chronicle, sidebar): ask the owner after the window check.
- Own-copy errands still fail with "needs a top folder of a git repository"; worktrees were made by hand.

## Sources

- `documentation/changelog/0.2.10-Pre-Alpha.md`: CHG-0777 to CHG-0781.
- `documentation/capabilities/thread-messaging/specifications.md`, `blueprint.md`.
- Commit `9fe2307c`; `packages/contracts/src/companionMentions.ts`, `packages/service/src/work/companionAsking.ts`, `companionThreads.ts`, `companionExchanges.ts`, `companionRefusals.ts`, `questVisibility.ts`.
