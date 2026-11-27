# Handoff: message marks, the three audit refactors, and the Companion mention

Supersedes: none
Workspace: Outlore repository, branch `main` (merged locally, not yet pushed when this was written)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The message box uses `#` (realm, quest, errand), `+` (files and folders), `$` (skills) and keeps `@` for a Companion mention: a second model the owner names answers one message in the same conversation while the main Companion carries on. The three architecture-audit refactors that make that mention cheap are merged; the mention itself is the work left.

## State

- Marks (CHG-0777, CHG-0778), commit `c7cb177d`: `#`, `+`, `$` built; `/` opens nothing; old `@` and `/` words are plain text; the realm chip is the keep icon again; `packages/contracts/src/marks.ts` is the single table (the `@` row exists with no chips, no heading, no list). Verified: Biome, 7-workspace typecheck and `CI=1 bun run test packages/service packages/contracts apps/app` (386 files passed, 7 skipped, 3,237 tests passed) were run on the merged tree with `GIT_CONFIG_VALUE_0=` set.
- Turn scope (CHG-0780), merged as `a2fb5361` from `worktree/turn-scope`: `work/turnScopes.ts` opens a run-keyed scope that owns a turn's run state; `runKey` defaults to the thread id; only a main scope writes the thread's session and state. Conflict in `turnRunner.ts` resolved by keeping `prepareAccountKey` before `scopes.open`. Verified by the same test run.
- Quest visibility (CHG-0779), merged as `b8b1dcd5` from `worktree/quest-visibility`: `work/questVisibility.ts` owns quest kinds (owner, chronicler, reserved `companion` with `companionCondition = "0"`, no column) and standings. The two deferred sites (`accounts.ts`, `pendingMessages.ts`) now read it. Verified by the same test run.
- Not checked: the message box in a desktop window or on the phone (`#`, `+`, `$`, the keep icon); a live turn with a `$skill`; a live turn on a real harness through the turn scope.
- Tests that start git need `GIT_CONFIG_VALUE_0=` set in this environment; without it about 40 service tests fail with "missing config value".
- Assumed: the merged `main` was pushed only if a later handoff or `git status` says so. Check `git log origin/main..main`.
- `appGuideTopics.ts` still spells the four marks by hand; it can read the table.

## Decisions

- `+` for files, not `./` or `/`: root files like `+.gitignore` work and `/` stays free (owner, 2026-11-27; CHG-0777).
- The mentioned model works in the quest's folder with the quest's permission mode; one resumed session per model per conversation (cache); a signed-out, over-budget or failed model answers with a clear line saying the cause and reset time, and the main Companion only gets it as context (owner, 2026-11-27; thread-messaging blueprint, "Mentioning a Companion with @").
- The Companion mention runs as the top thread of its own hidden quest (kind `companion`), not as a child errand and not as a second run on the conversation's thread, so the tree, counts and limits never see it.
- A side run is a `SideTurnScope` with its own run key; it must not be reachable by thread-id steering or interrupts.

## Next

1. Confirm with the owner that `main` is pushed, or push after their approval.
2. Build the Companion mention in an errand with its own worktree (see Open questions on the worktree tool): the `companion` quest kind and its migration; excluding it in the lists that read `questVisibility.ts`; `ListCompanions` for the `@` menu; the `@` row's token grammar, chip kind and list in `marks.ts`; a per-run MCP endpoint token (`Endpoints.urlFor` is per thread) so a side run's tool calls resolve its run key; recording a side run's reply and failure; copying the reply under the owner's message labelled with the model; a context-only delivery to the main Companion that does not wake it.
3. Check `#`, `+`, `$` and the keep icon in the desktop window and on the phone.

## Open questions

- Opening an errand with its own copy failed earlier with "needs a top folder of a git repository", and git in the service environment may lack the same setting. Check whether it still fails; otherwise make the worktree by hand in `.worktrees/<name>` and run `.agents/worktree-setup.sh`.
- Hidden-quest listings: the blueprint estimates about 35 list queries; with `questVisibility.ts` merged the count should be small, to be confirmed by reading the module's callers.

## Sources

- `documentation/capabilities/thread-messaging/specifications.md` and `blueprint.md` ("Mentioning a Companion with @").
- `documentation/changelog/0.2.10-Pre-Alpha.md`: CHG-0777 to CHG-0780.
- `documentation/architecture-audit/architecture-audit-2026-11-27-0124.html`.
- Commits `c7cb177d`, `a2fb5361`, `b8b1dcd5`.
- `packages/contracts/src/marks.ts`, `packages/service/src/work/turnScopes.ts`, `packages/service/src/work/questVisibility.ts`.
