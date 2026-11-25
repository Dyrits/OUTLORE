# Handoff: ACP launch hygiene, Antigravity steering, and multi-account architecture

Supersedes: none
Workspace: Outlore repository, branch `main` (local, ahead of `origin/main` `953e98b9` with CHG-0726, CHG-0727, and CHG-0728)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Close the selected T3 Code parity gaps cleanly in Outlore's shared ACP layer and roll out multi-account support across every provider that can isolate credentials per folder.
Done means Batch 1's unified `AccountIsolation` foundation is pushed to `origin/main` and Batches 2 to 4 (Antigravity, Cline, Devin, Copilot, and Muse) are each live-verified and either enabled as `directory`-isolated or kept `computerOnly` with documented evidence.

## State

- **CHG-0726 (`63560f85`) — Antigravity 1.5+ mid-turn steering:** merged fast-forward onto local `main`. Verified: `git log -n 5 --oneline` shows `63560f85` on `main`; `packages/service/src/harness/acpSession.ts` reads `agentInfo.version` from `initialize`, `steersWithPromptFrom: "1.5.0"` is enabled on Antigravity only, and Outlore's existing ACP interrupt path already matches T3 Code's `cancelBehavior: "wait-for-prompt"`. Pre-commit Biome, all 7 workspace typechecks, and 1,534 related tests passed on that commit; no live `agy` turn was run.
- **CHG-0727 (`e6580b9d`) — Provider-agnostic ACP launch hygiene:** merged fast-forward onto local `main`. Verified: `git log -n 5 --oneline` shows `e6580b9d` on `main`; `AcpProviderDefinition` / `AcpProviderProtocol` declare `minimumAgentVersion`, `hasIsolatedTempDir`, and `scrubEnvPrefixes` (executed generically in `acpLaunch.ts`, `acpHarness.ts`, `acpProviders.ts`, and `core/lineProcess.ts`), with Antigravity enabling `1.5.0`, isolated temp dir, and `["GEMINI_", "GOOGLE_"]` scrubbing. Pre-commit Biome, all 7 workspace typechecks, and 1,756 related tests passed on that commit; no live `agy` turn was run.
- **CHG-0728 (`010ca991`) — Batch 1: unified `AccountIsolation` model + Workshop UI contract:** merged fast-forward onto local `main`. Verified: `git log -n 5 --oneline` shows `010ca991` at `HEAD` on `main`; `packages/service/src/harness/accountIsolation.ts` replaces `configVariable`, `supportsAddedAccounts`, and `StateHomeRule` so launch, sign-in command, sign-in read, model probe, plan limits, and Workshop's **+ Add account** button (`HarnessInfo.supportsAddedAccounts` in `packages/contracts/src/harnesses.ts` and `apps/app/src/settings/providers.tsx`) derive from one declaration per harness. No provider's account support changed in Batch 1 (same 6 directory-isolated, same 6 computer-only). Pre-commit Biome, all 7 workspace typechecks, and related tests passed; full suite had 3,195 passed, 74 skipped, and 1 unrelated timing flake in `idleTraffic.test.ts` (passes alone in 4 s). No real provider turn or sign-in was run.
- **Antigravity ToS clarification:** the owner posted topic 205306 on the Google AI Developers forum (`https://discuss.ai.google.dev/t/tos-clarification-scheduled-and-parallel-sessions-of-the-official-agy-acp-from-a-personal-desktop-app/205306`), recorded in `documentation/backlog.md`. A daily 09:00 read-only Ritual ("Check Antigravity ToS forum topic", Light tier) is active in Outlore to summarize new replies.
- **Errand branches:** `mission/antigravity-vs-t3code-4774eeeb`, `mission/antigravity-vs-t3code-e08e3479`, and `mission/antigravity-vs-t3code-5a344e2b` all point at commits now on local `main` and can be cleaned up after pushing.

## Decisions

- **Provider-agnostic shared ACP code:** all hygiene and isolation mechanisms live as declarative fields on `AcpProviderDefinition` / `AcpProviderProtocol` and `AccountIsolation`, with zero provider-name branches in shared code. Recorded in CHG-0727 and CHG-0728 (`documentation/changelog/0.2.7-Pre-Alpha.md`).
- **Steering via second `session/prompt` is Antigravity-only:** verified against T3 Code `93a7cfe745ac784e559c727e4eccd90929dfd169` that no other ACP agent accepts a second `session/prompt` as steering; other ACP harnesses stay unchanged. Recorded in CHG-0726.
- **Cursor stays `computerOnly`:** `CURSOR_CONFIG_DIR` moves settings only while `cursor-agent` stores one OAuth login per OS user in macOS Keychain, and storing `CURSOR_API_KEY` is forbidden by `documentation/architecture-decision-record/0011-accounts-as-harness-folders.md`. Recorded in `documentation/backlog.md`.
- **No unapproved live `agy` turns:** do not run a real Antigravity model turn without owner approval while Google's consumer-plan ToS clarification (topic 205306) is open.
- **Batch 1 design choices:** `pinnedHome` stays a separate field on ACP definitions; computer-only providers ignore any stale account folder; Muse's unverified `MUSE_HOME` placeholder was removed; probing a directory-isolated ACP provider with no folder reads the computer's own sign-in. Recorded in CHG-0728.

## Next

1. Confirm `main` (including CHG-0726, CHG-0727, CHG-0728, and this handoff) is pushed to `origin/main` (owner-approved push).
2. **Batch 2 — Antigravity multi-account:** run one owner-driven interactive temporary-folder login on local `agy 1.5.16` (`/Users/dgerrits/.local/bin/agy`) with `AGY_ACP_FORCE_FILE_STORAGE=1` and `SSH_CONNECTION="127.0.0.1 0 127.0.0.1 0"` to confirm file-backed auth isolation (without touching macOS Keychain) and whether `agy` follows `--gemini-dir`, `GEMINI_HOME`, or both; then switch `antigravityProvider.ts` from `computerOnly` to `directory` isolation (passing those two flags for added accounts only, keeping computer sign-in on Keychain) and wire `configDirectory` through Antigravity plan limits.
3. **Batch 3 — Cline & Devin multi-account:** once `cline` (`>= 3.0.68`) and `devin` are installed locally, live-verify `CLINE_DIR` + `CLINE_DATA_DIR` and `XDG_DATA_HOME` (plus `devin auth login`) and flip each provider's `isolation` to `directory`.
4. **Batch 4 — Copilot & Muse multi-account:** live-verify on macOS whether `COPILOT_HOME` isolates `copilot login` from Keychain/`gh` fallback and whether `XDG_CONFIG_HOME` + `XDG_DATA_HOME` isolates `muse login` from macOS Keychain (`ai.meta.dev.credentials`); enable whichever isolates cleanly and keep any Keychain-bound provider as `computerOnly`.
5. **Later T3-parity candidates (backlog):** `update_steps` plans, Antigravity edit diffs (`replace_file_content` / `multi_replace_file_content`), and Ritual/errand policy for Antigravity once Google answers forum topic 205306.

## Open questions

- **Google Antigravity ToS (topic 205306):** whether scheduled Rituals, parallel sessions, and `agy --print "/usage"` are permitted on a personal plan. Awaits a reply on the Google AI Developers forum (monitored daily by the Ritual).
- **Live Antigravity steering/cancel verification (CHG-0726):** whether `agy 1.5.16` answers the first prompt cleanly on a mid-turn second `session/prompt` and settles `session/cancel` within `interruptGraceMillis` (10 s). Requires owner approval for one live turn.
- **Batch 1 minor confirmations:** whether dropping Muse's unverified `MUSE_HOME` is fine for any legacy DB row, and whether probing a directory-isolated ACP provider with no folder should read the computer's sign-in (current Batch 1 behavior). The owner confirms.

## Sources

- `documentation/changelog/0.2.7-Pre-Alpha.md` (CHG-0726, CHG-0727, CHG-0728)
- `documentation/work-in-progress.md`
- `documentation/backlog.md`
- `documentation/capabilities/provider-accounts/specifications.md`
- `documentation/architecture-decision-record/0008-drive-harness-tools-directly.md`
- `documentation/architecture-decision-record/0011-accounts-as-harness-folders.md`
- `documentation/research/acp-antigravity-t3code-paseo-2026-11-24.md`
- `packages/service/src/harness/accountIsolation.ts`
- `packages/service/src/harness/acpProviderDefinition.ts`
- `packages/service/src/harness/antigravityProvider.ts`
- `https://discuss.ai.google.dev/t/tos-clarification-scheduled-and-parallel-sessions-of-the-official-agy-acp-from-a-personal-desktop-app/205306`
