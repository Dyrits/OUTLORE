# Handoff: Codex Full access prompts

Supersedes: none
Workspace: OUTLORE, `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Local commands blocked by the sandbox in a Codex turn running in Full access can use Codex's per-command escalation without prompting the owner. Verify this in a live turn.

## State

- Verified in Git and source. `62f7c7d6` adds Full access instructions to Codex's starting context and removes contradictory worktree approval guidance for that mode.
- Verified in the implementation worktree before landing. The instruction regression test failed before the change and passed afterward. The full suite had 2,704 passes and 64 skips. Lint, typecheck, and the commit hook passed.
- A live Codex run with the new instructions is pending.

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
- `documentation/capabilities/action-approval/specifications.md`
- CHG-0629 in `documentation/changelog/0.2.2-Pre-Alpha.md`
