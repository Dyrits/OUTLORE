# Handoff: Threads no longer announce opening an errand

Supersedes: none
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner does not want an agent to write that it opened a quest or errand when the opening is already visible.
Done means the thread instructions say so and the owner has seen an agent open an errand without announcing it.

## State

- **Instruction line (verified: file read, `bun test test/harness/instructions` passes, 17 tests):** `threadInstructionsOf` in `packages/service/src/harness/instructions.ts` ends its `open_thread` paragraph with "The owner sees each errand open, so do not write that you opened a quest or errand."
- **Changelog (verified: file read):** CHG-0745 is in `documentation/changelog/0.2.8-Pre-Alpha.md`, validation says owner acceptance is pending.
- **Assumed:** agents obey the line; no live thread was run to see it. The typecheck and the full test suite were not run.
- **Other work in the tree, not part of this commit:** `guildmaster.tsx`, `threadAnchors.ts`, `questsHandlers.ts`, `replies.ts`, `replies.test.ts` and the CHG-0746 changelog entry belong to another session.

## Decisions

- **A change to the thread instructions, not lore:** the owner said the behavior belongs to Outlore itself; the workspace lore entry I first saved was deleted. Recorded in CHG-0745.

## Next

1. Open an errand in a quest and check the agent's reply does not say it opened one.
2. If it still does, tighten the wording in `instructions.ts` and add a test in `packages/service/test/harness/instructions.test.ts`.
3. Once accepted, mark CHG-0745 delivered.

## Open questions

None.

## Sources

- `packages/service/src/harness/instructions.ts`
- `packages/service/test/harness/instructions.test.ts`
- `documentation/changelog/0.2.8-Pre-Alpha.md` (CHG-0745)
