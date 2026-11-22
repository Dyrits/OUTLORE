# Handoff: Codex Full access prompts

Supersedes: `2026-11-22-0201-codex-full-access.md`
Workspace: OUTLORE, `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

In a live Full access Codex turn, a local command the sandbox blocks runs through Codex's own per-command escalation without prompting the owner, while consequential actions still prompt. Done when a live turn shows exactly that.

## State

- Verified in Git this session: `main` carries `62f7c7d6` (CHG-0629, Full access instructions for Codex in `packages/service/src/harness/instructions.ts` with its regression test) and `56a282aa` (the previous handoff and its `AGENTS.md` pointer), and nothing else beyond `origin/main`.
- Verified in the implementation worktree before landing: the instruction regression test failed before the change and passed after it; the full suite had 2,704 passes and 64 skips.
- Verified this session on the tip before pushing: `bun run check` (Biome, 1,169 files) and `bun run typecheck` (all seven workspace packages) passed at the workspace root.
- Assumed: the commit carrying this handoff was pushed to `origin/main` right after it was made (the owner instructed the push this session). Confirm with `git fetch && git status -sb`; expected: up to date with `origin/main`, nothing ahead.
- A live Codex run with the new instructions is still pending.

## Decisions

Keep direct owner approval for consequential actions and turn-wide sandbox grants. Use Codex's own escalation for individual blocked commands under Full access. A mode change applies from the next turn.

## Next

1. Start a live Full access Codex turn with the updated service. Have it retry a harmless local command that the sandbox blocks.
2. Check that Permissions history records an automatic harness approval and the command succeeds without a prompt.

## Open questions

Does the live Codex model choose its per-command escalation when it sees the new guidance?

## Sources

- `packages/service/src/harness/instructions.ts` and `packages/service/test/harness/instructions.test.ts`
- `packages/service/test/work/approvalsSandbox.test.ts`
- CHG-0629 in `documentation/changelog/0.2.2-Pre-Alpha.md`
- `.agents/handoffs/2026-11-22-0201-codex-full-access.md` (superseded)
