# Handoff: summons ring, "your turn" dot, errand archive

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `worktree/summons` (worktree `.worktrees/summons`), two commits on top of `origin/main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Make the sidebar say who must act: a Summons rings its row, a quest whose agent finished its turn shows it is the owner's turn, and the owner can archive a quest from the quest list and an errand on its own. Done when the owner has looked at each in a window and on a phone and accepted or redirected it.

## State

Built in one commit (CHG-0512 to CHG-0516, in `documentation/changelog/0.1.10-Prototype.md`), rebased onto `origin/main` at `fa24172`:

- CHG-0512: a quest or errand row in Summons has a 1 px border in the dot's color (`apps/app/src/shell/railRows.tsx`, `railQuests.tsx`, `railStyles.ts`). Verified: Biome, typecheck, full suite (2,126 passed, 55 skipped) in the worktree after the rebase. Not seen in a window or on a phone.
- CHG-0513: `isYourTurn` (optional) on `ThreadSummary` and `MissionSummary`, true when the thread is Idle after a completed turn; the sidebar and quest list draw a teal dot (`teal` added to the four palettes). The stored state stays Idle. Verified by `packages/service/test/work/archivingErrands.test.ts` (one test); the look is not seen.
- CHG-0514: archive (or delete, for an empty quest) button on each quest row of the quest list (`shell/questListRows.tsx`). Not seen.
- CHG-0515: a row that moves under a still pointer shows its hover marks (`foundation/pointerPosition.ts`, `useRowActions`). Assumed to work: it rests on `document.elementFromPoint` and was not tried in a window.
- CHG-0516: an errand can be archived on its own: migration `0059_thread_archived`, requests `ArchiveThread` and `RestoreThread`, `ThreadSummary.isArchived`, `lifecycle.ts`, a hover button on the sidebar errand row, Archive and Restore errand in the errand's panel, an Archived errands list in the conversation's tree. Verified by two tests in `archivingErrands.test.ts`. Not seen.

The main checkout (`/Users/dgerrits/Codelab/Dyrits/CANOPY`, branch `main`, at `8dc4348`) still holds another session's uncommitted work: Mistral Vibe harness files and a queued-message feature (`SteerQueuedMessage`, a "Queue" default delivery, the thread-messaging specification). That session's changelog entry is numbered CHG-0514, which this work now uses for the quest list's archive button; it needs the next free number (0517 or higher). The checkout was left as it was; its `main` is behind `origin/main` and needs a fast-forward after that work is committed or set aside.

## Decisions

- "Your turn" is derived, not a new stored state: a stored state would have touched the lifecycle, messaging and board rules, and many tests assert Idle. Teal because blue is Underway, green Done, amber Summons, violet Awaiting word.
- Archiving an errand stops what is at work and archives the errands beneath it, asks no confirmation, and refuses messages to it until restored. The owner agreed to the proposal (in the quest's conversation); the three unasked details are my choices: no confirmation, no errand button in the quest list, writing in an archived errand does not restore it.
- Migration is 0059 because `origin/main` took 0058 (CHG-0509).

## Next

1. Ask the owner to look at the Summons ring, the teal dot, the quest list's archive button, and the errand archive in a window and on a phone, including the pointer case (archive a quest without moving the mouse).
2. Tell the other session in the main checkout to renumber its CHG-0514, then fast-forward `main` to `origin/main` once its work is committed.
3. Decide the three unasked details above and the board and quest panel, which still read a waiting quest as Resting.

## Open questions

- Whether the board's cards and the quest panel should show the teal "your turn" mark too (the owner).
- Whether an errand at work should ask before archiving stops it (the owner).
- A Ritual's quest shows the teal dot after each run; whether that is wanted (the owner).

## Sources

- `documentation/changelog/0.1.10-Prototype.md`, CHG-0512 to CHG-0516
- `documentation/capabilities/thread-tree/specifications.md`, Archiving an errand and Thread states
- `packages/service/test/work/archivingErrands.test.ts`
- The first of the two commits of `worktree/summons` ("Ring a summons, mark a quest waiting for the owner, archive errands alone")
