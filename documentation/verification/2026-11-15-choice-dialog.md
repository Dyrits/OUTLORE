# Verification: choice questions (CHG-0299)

Environment: macOS, Claude Code's sandbox, the worktree `.worktrees/choice-dialog` (base `d0896ad`, uncommitted), fake harness.

Checks run:
- Red first: seven tests in `packages/service/test/work/approvals.test.ts` ("asking the owner to choose") failed against the old code, which ran `AskUserQuestion` unasked and recorded `AllowedAutomatically` (the failure output showed the echo `{"behavior":"allow","updatedInput":{...}}` with no `answers`). They pass after the change; an eighth (an adapter asking through `askOwner`) was added with the code.
- `apps/app/test/ui/questionAnswers.test.ts`: six tests of the dialog's logic. Written together with the helpers, so not seen red.
- `bunx biome check .`, `bun run typecheck` (seven workspaces), and `CI=1 bun run test` inside the sandbox: 1,617 passed, 54 skipped.

Not checked:
- The dialog in a window. A side-quest tried to drive it with Electron over Expo web (the method of the mobile navigation record) and could not: Electron does not start inside the sandbox (`bootstrap_check_in com.github.Electron.MachPortRendezvousServer: Permission denied (1100)`, then `Failed to create socket directory`); the build and Expo web were fine. Nothing was seen of the layout on a wide window, on a phone width, on the dashboard list or in Chronicler. To run it: from `apps/desktop` after `bun run build` and with Expo on a free port, `env -i HOME=$HOME PATH=$PATH USER=$USER TMPDIR=$TMPDIR LANG=en_US.UTF-8 OUTLORE_HARNESS=fake OUTLORE_DATA_DIR=<throwaway folder> OUTLORE_APP_URL=http://localhost:<port> <electron> dist/main.js --remote-debugging-port=<port>`, then send a quest the message `call answer_prompt {"input":{"questions":[{"header":"Build","multiSelect":false,"options":[{"description":"x","label":"A"},{"description":"y","label":"B"}],"question":"Which build?"}]},"tool_name":"AskUserQuestion"}`.
- A live Claude Code run: the exact `updatedInput.answers` shape (question text to label, joined by `, `) rests on the Claude Agent SDK's documentation, not on a probe.
- Codex and OpenCode: not wired.
