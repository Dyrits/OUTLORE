# Verification: connector gateway on a fake backend

- **Work:** CHG-0530, based on `7880ab0`, on the branch `mission/connectors-composio-and-apple-apps-5906083b`.
- **Environment:** macOS, inside a thread's sandbox, with `TMPDIR=<repo>/.tmp-test` (no space) and `CI=1`. A real SQLite database in a temporary folder per test; the scripted fake harness; the scripted fake backend, fake Vault and test catalog in `test/fixtures/connectorBackend.ts` and `connectorWorld.ts`.
- **Verdict:** The gateway, the stored choices, the owner's requests and the wiring pass on fakes. No real server, Vault, harness or screen was run.

## Recorded results

| Claim | Where it is checked | Result |
| --- | --- | --- |
| Installing enables a connector for every quest, an errand and Chronicler; not connected, no thread gets its tools until it is | `gateway.test.ts` | Passed |
| The global switch off hides it everywhere, even where a quest says On | `gateway.test.ts`; `availability.test.ts` over every combination | Passed |
| Inherit, On, Off, Reset for a quest, its errand, a realm, the Borderlands; Chronicler follows the global switch; the counterexample (Borderlands Off, a quest in a realm that inherits is On); a moved quest keeps its own choice; a deleted quest forgets its choices | `gateway.test.ts`, `availability.test.ts` | Passed. A Ritual's quest is not run as such: it is an ordinary quest to the code. |
| A tool switched off is absent from the listing and marked off on the card; a call to it stops at once in a turn underway | `gateway.test.ts`, `gatewayCalls.test.ts` | Passed |
| Switching off stops a read and a write underway; the write says the action may already have happened and is not retried; an open question is withdrawn | `gatewayCalls.test.ts`, on the fake harness as Claude Code, Codex and OpenCode | Passed (3 x 3 cases) |
| A tool switched off and on again in a turn stays off until the next turn; switching on applies at the next turn | `gatewayCalls.test.ts`, `calls.test.ts` | Passed |
| A read-only tool runs unasked; a write and an unclassified tool ask once per call, in the catalog's words; Always allow covers that tool only, in the thread's quest, and no command; a connector with no named tool asks every call | `gatewayCalls.test.ts` | Passed on all three harness names |
| A failing connector warns, is marked Needs connecting for everyone (a refusal) or not (unreachable), and the turn goes on; bad arguments change nothing; a read is retried once on `Unreachable`, a write never | `gatewayCalls.test.ts` | Passed on all three harness names |
| A secret the server echoes, in any of four spellings, reaches no result, conversation, question, permission, card or lore; the server's own words reach no thread | `gatewayCalls.test.ts`, `connectorErrors.test.ts` | Passed |
| Removal in three steps; a failing Vault leaves it Removing and unusable; a crash after step 1 resumes at start; only the connector's own permissions go | `connectorOwner.test.ts` | Passed |
| Apple apps refused off a Mac; its default apps; an app not chosen offers no tool; an app turned off stops a call underway; a tool of no known app is never offered | `connectorOwner.test.ts` | Passed |
| A thread finds no tool by which to install, switch or remove a connector | `connectorOwner.test.ts` | Passed |
| Code Mode over the real gateway: a read runs unasked, a write asks while the code runs, a denial and a switched-off connector reach the code as errors; direct calls are refused | `connectorTurns.test.ts` | Passed |
| The harness is told each turn's connector tools; Claude Code's allow rule names them; Code Mode names none; a tool switched off leaves the next turn's list | `connectorTurns.test.ts` (restart keys read in code, not run on a live process) | Passed |
| A database saved before migration `0060` migrates with its data | `connectorOwner.test.ts` | Passed |
| Whole suite | `bun run test` | 2,262 passed, 55 skipped, 28 failed: the 28 that fail on a clean checkout in a sandbox (`git init` hook samples) |
| Biome, workspace typecheck | `bunx biome check`, `bun run typecheck` | Clean, passes on all workspaces |

Two mutations were made to see that the tests bite and then undone: not narrowing the snapshots on a tool switch (6 failures) and not checking the snapshot in `call` (6 failures).

## Not checked

- A real Composio server or key, a real Apple server (`mcp-icloud`), its tool names, its AppleScript permissions; the backends (blueprint step 4).
- A real Vault and its adapter to `VaultPort`, the Vault's requests, and that a secret is unreadable from a harness's sandbox (steps 1 and 2).
- A live Claude Code, Codex or OpenCode: the three are the one scripted fake harness under three names, so that Claude Code runs only the tools named in `--allowedTools` and that a kept process lists its tools again after a restart are read in code, not run; a restart key that is unchanged by a connector tool the harness has never seen was reasoned, not run.
- A Steps line for a read: the fake harness reports no tool call, so that line is the harness's own.
- That `ChooseAppleApps` and the switches stop a call that is on the wire to a real server; here the fake backend's wait is interrupted.
- The Charter, the realm and quest panels, the thread panel's tools line, a phone; a realm's and a quest's current choice is not readable yet (only the Borderlands', on the card).
- Concurrent owner requests racing a dispatch beyond what the tests order by gates; the ordering rests on the snapshot narrowing inside the transaction, argued in the code, not stress-tested.
- Behavior on Windows and Linux hosts: the platform is injected in tests (`linux` for the Apple refusal).
