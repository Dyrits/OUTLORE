# Verification: Code Mode widened to every tool of Outlore's tool server (CHG-0447)

Branch `worktree/code-mode-widen`, started from `main` at `00d569c`. Run inside Claude Code's sandbox (`CI=1`) with no pty, as for the whole suite.

## Results run on this branch

- `bun run check`: no fixes.
- `bun run typecheck`: seven workspaces pass.
- `CI=1 bun run test`: 254 files passed, 4 skipped; 2,061 tests passed, 54 skipped.
- `packages/service/test/connectors/codeMode.test.ts` (15 tests, the real MCP tool server, the real thread tools, a fake gateway):
  - the listing with Code Mode off holds each connector tool and each thread tool and no `run_code`; with it on, only `run_code` and the four direct tools, `run_code` declaring `outlore.<tool>` and `connectors.<connector>.<tool>`; with no connector it still declares `outlore`;
  - a connector call from code gives the same result and the same gateway call as direct; a write waits for the owner's answer while the code runs; a denied or switched-off call throws into the code;
  - from code, `outlore` holds exactly the covered tools and none of `request_approval`, `answer_prompt`, `report_result`, `suggest_mission`; no `fetch`, `require` or `process`;
  - several of Outlore's tools chained in one call (`save_intel`, `search_intel`, `read_journal`);
  - the same answer from code and direct for a Chronicler-only tool refused for a quest thread, and for invalid arguments;
  - a direct call to a covered thread tool or a connector tool is refused while Code Mode is on, `run_code` is unknown while it is off, and `report_result` still reaches its own handler;
  - the sixth and seventh calls to `send_thread_message` in a run are refused by the cap of 5, and 20 calls to `read_journal` are not counted;
  - Chronicler's `create_ritual` called from code asks the owner, the thread waits, and the Ritual is made after Allow;
  - a setting flipped during a turn changes neither the listing nor the answers of that turn; the next turn starts with it, and flipping it back mid-turn changes nothing either (the fake harness, with `Endpoints.heldCodeMode` awaited).
- `codeExecutor.test.ts` (13): the existing twelve with the nested globals, and one new test for `outlore` and `connectors` beside each other.
- `threadTools.test.ts`: only tools that already run unasked are covered; the direct four; the three work-starting tools; `run_code` unasked only while Code Mode is on.
- `activities.test.ts` (3): a `run_code` call shows as "Run code that calls its tools".
- `apps/app/test/charter/codeMode.test.ts`: the new label, explanation and state lines.

## Measured

With no connector, on the real thread catalogue, the JSON a thread is listed (name, description and input schema of each tool): **20,077 characters with Code Mode off, 18,619 with it on, 7% less.** The tools' descriptions stay in the code tool's declarations, so most of the gain is expected from chained calls and from results that never enter the context, which this run cannot measure. The test keeps only the weak guard that the listing does not grow.

## Not checked

- No live Claude Code, Codex or OpenCode: whether a model writes working code against the declarations, and how often it prefers it, was not tried.
- A harness's restart on a changed setting was checked in the restart keys and with the fake harness only, not on a live kept process. OpenCode's key holds all of `access`, so `usesCodeMode` is part of it without a line of its own.
- Whether Claude Code accepts `run_code`'s calls to the covered tools without a permission prompt of its own: its own prompt is skipped for the one `run_code` call (it is in `--allowedTools` only while Code Mode is on); not run against a live Claude Code.
- The Charter's switch was not seen in a window or on a phone.
- No real connector; the fake gateway answers the connector part.
- No token, call or latency measurement of a task done with the switch on and off.
- The calls the code makes are not shown one by one in the thread's steps, only the run.
