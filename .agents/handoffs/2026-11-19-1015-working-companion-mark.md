# Handoff: Keep the working Companion visible

Supersedes: none
Workspace: OUTLORE, branch `worktree/working-companion-mark`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Fix the running indicator so it continues to show the Companion that started the active turn after the user selects another Companion. Publish the completed change on `origin`.

## State

- Verified: implementation commit `caf7f8dbaebc1cd4fcf15977838ebfc6280f5321` added persisted turn model metadata and displays the active turn's runner in the working indicator and draft label. The commit was rebased onto `origin/main` and is now at a new hash; confirm with `git log`.
- Verified: earlier checks recorded in the preceding conversation passed the service change test, typecheck, and Biome. Two unrelated `harnesses.test.ts` failures were reported on both the feature branch and unmodified main. Visual behavior remains unconfirmed in the app window.
- In flight: hand-off and pointer are being committed, then the branch is to be pushed to `origin/worktree/working-companion-mark`.

## Decisions

- A turn keeps the mark for the runner that started it until the turn ends. The product specification was updated accordingly.
- This work is on a dedicated worktree branch, not `main`.

## Next

1. Commit this hand-off and the `AGENTS.md` pointer on the feature branch.
2. Verify the new branch tip and relevant diff, then push it to `origin/worktree/working-companion-mark`.
3. Confirm remote tip and report the hand-off path.
4. When convenient, check the behavior in a desktop window or phone app.

## Open questions

- Has the updated indicator been visually checked in the running app?

## Sources

- `caf7f8d` (original implementation commit; rebased on current `origin/main`)
- `documentation/capabilities/thread-handover/specifications.md`
- `apps/app/src/conversation/threadConversation.ts`
- Prior session verification summary in the conversation that preceded this hand-off.
