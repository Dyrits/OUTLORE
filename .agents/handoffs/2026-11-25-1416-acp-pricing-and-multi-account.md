# Handoff: ACP pricing lookup, Antigravity live isolation finding, and multi-account Batches 2 to 4

Supersedes: `2026-11-25-1320-acp-hygiene-and-multi-account.md`
Workspace: Outlore repository, branch `main` (local, ahead of `origin/main` `b4d4dd0e` with `8aeff2e9` and CHG-0729 `7586f01d`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish rolling out multi-account support across providers that can isolate credentials (Batches 2 to 4 on top of Batch 1's `AccountIsolation` foundation) and close the remaining T3 Code parity gaps cleanly in Outlore's shared ACP layer.
Done means CHG-0729 and this handoff are pushed to `origin/main`, Antigravity's `WSL_DISTRO_NAME` file-backed login isolation is live-verified and enabled (Batch 2), and Batches 3 and 4 (Cline, Devin, Copilot, Muse) are each live-verified and resolved.

## State

- **CHG-0726 (`63560f85`), CHG-0727 (`e6580b9d`), CHG-0728 (`010ca991`), and prior handoff (`b4d4dd0e`):** already on `origin/main`. Verified: `git log -n 5 --oneline` shows `origin/main` at `b4d4dd0e`.
- **CHG-0729 (`7586f01d`, cherry-picked from `44a4d39c` on `mission/antigravity-vs-t3code-47229313`) — Price lookup for effort-suffixed model IDs:** on local `main`. Verified: `git log -n 3 --oneline` shows `7586f01d` at `HEAD`; `packages/service/src/core/prices.ts` (`priceOf`) now strips trailing effort suffixes (`-low`, `-medium`, `-high`, `-xhigh`, `-max`) and date+effort combinations after exact and undated lookups while keeping exact matches first and returning `null` for unknown base models. `packages/service/src/core/priceSnapshot.ts` was refreshed from `models.dev` via `bun run --filter @outlore/service prices:snapshot` (298 prices, now including `gemini-4-neon` and `gemini-4-hydrogen`). Verified on `44a4d39c` before cherry-pick: 35 focused tests (`priceSources.test.ts`, `prices.test.ts`), Biome, all 7 workspace typechecks, and 1,774 pre-commit related tests passed; no live `agy` turn was run.
- **Live zero-token isolation probe on local `agy 1.5.16` (`/Users/dgerrits/.local/bin/agy`) — critical Batch 2 finding:** verified directly by spawning `agy acp` (`initialize` + `session/new`, zero tokens) against an empty temporary folder on macOS:
  - `AGY_ACP_FORCE_FILE_STORAGE=1` + `SSH_CONNECTION="127.0.0.1 0 127.0.0.1 0"` + `GEMINI_HOME=<tmp>` + `--gemini-dir=<tmp>` **did NOT isolate** — both `session/new` and `agy --print "/usage"` still succeeded using the computer's existing login.
  - `WSL_DISTRO_NAME=Outlore` + `GEMINI_HOME=<tmp>` + `--gemini-dir=<tmp>` **did isolate** — `session/new` returned `-32000 "Authentication required"` without overriding `HOME`.
  - `HOME=<tmp>` alone also returned `-32000`, but overriding `HOME` is undesirable because child tools (`git`, `ssh`, etc.) rely on the real `HOME`.
  - Still unverified (interactive step pending owner): running `agy acp --login` with `WSL_DISTRO_NAME=Outlore` into a temp folder to prove file-backed login writes into `<tmp>`, leaves macOS Keychain untouched, and works for follow-up `session/new` and `--print "/usage"`.
- **Inline terminal for launched commands:** split out into its own quest ("Inline terminal for launched commands", id `e6890800-20db-43fa-91da-a52c4ea2d1c5`). Verified: `git status -sb` shows 17 modified and 2 untracked files in the main working tree from that quest (not touched or staged by this handoff).
- **Antigravity ToS clarification (topic 205306):** daily 09:00 read-only Ritual ("Check Antigravity ToS forum topic", Light tier) remains active.

## Decisions

- **Effort-suffix price fallback preserves "never guess a price":** `priceOf()` tries exact `name`, `withoutDate(name)`, `withoutEffort(name)`, `withoutDate(withoutEffort(name))`, and `withoutEffort(withoutDate(name))` in order, so exact rows (e.g. `gpt-5.1-codex-max`) always win and unknown models stay `null`. Recorded in CHG-0729 (`documentation/changelog/0.2.7-Pre-Alpha.md`).
- **Do not use `SSH_CONNECTION` for Antigravity multi-account on macOS:** disproved live on `agy 1.5.16` (leaks the computer's login). Test and use `WSL_DISTRO_NAME` for added accounts only (keeping computer sign-in without `WSL_DISTRO_NAME` so macOS Keychain keeps working).
- **Do not override `HOME` for Antigravity isolation:** child tools need the real `HOME`.
- **Inline terminal sign-in is a separate quest:** tracked in quest `e6890800-20db-43fa-91da-a52c4ea2d1c5`, not mixed into this thread.
- **No unapproved live `agy` model turns:** still waiting on Google AI Developers forum topic 205306.

## Next

1. Confirm `main` (including `8aeff2e9`, CHG-0729 `7586f01d`, and this handoff) is pushed to `origin/main` (owner-approved push).
2. **Batch 2 — Antigravity multi-account:** have the owner run one interactive login into a throwaway folder with `AGY_CLI_DISABLE_AUTO_UPDATE=true WSL_DISTRO_NAME=Outlore GEMINI_HOME="$TMP_AGY" /Users/dgerrits/.local/bin/agy acp --gemini-dir="$TMP_AGY" --app-data-dir=antigravity-acp --login`. Verify `session/new` and `--print "/usage"` against `$TMP_AGY` (zero tokens) and confirm the computer's Keychain login is untouched. If confirmed, flip `antigravityProvider.ts` `isolation` from `computerOnly` to `directory` (adding `GEMINI_HOME` + `WSL_DISTRO_NAME` for added accounts only) and update `documentation/backlog.md` to record that `WSL_DISTRO_NAME` replaced `SSH_CONNECTION`.
3. **Batch 3 — Cline & Devin multi-account:** once `cline` (`>= 3.0.68`) and `devin` are installed locally, live-verify `CLINE_DIR` + `CLINE_DATA_DIR` and `XDG_DATA_HOME` (plus `devin auth login`) and flip each provider's `isolation` to `directory`.
4. **Batch 4 — Copilot & Muse multi-account:** live-verify on macOS whether `COPILOT_HOME` isolates `copilot login` from Keychain/`gh` fallback and whether `XDG_CONFIG_HOME` + `XDG_DATA_HOME` isolates `muse login` from macOS Keychain (`ai.meta.dev.credentials`); enable whichever isolates cleanly and keep any Keychain-bound provider as `computerOnly`.
5. **Later T3-parity candidates (backlog):** `update_steps` plans, Antigravity edit diffs (`replace_file_content` / `multi_replace_file_content`), and Ritual/errand policy once Google answers topic 205306.

## Open questions

- **Antigravity interactive login with `WSL_DISTRO_NAME`:** does `agy acp --login` under `WSL_DISTRO_NAME=Outlore` write credentials strictly inside `--gemini-dir` / `GEMINI_HOME`, and does `agy --print "/usage"` read them? Answered by the owner's one-shot temp-dir login check in Next step 2.
- **ACP `"default"` turns stay unpriced:** ACP replies emit no `model` field, so turns left on `"default"` record `model = null` and show tokens only; explicitly chosen models (e.g. `gemini-4-neon-medium`) now price via CHG-0729. Decide later if `session/new`'s `currentModelId` should be stamped on `"default"` turns.
- **Google Antigravity ToS (topic 205306):** whether scheduled Rituals, parallel sessions, and `agy --print "/usage"` are permitted on a personal plan. Monitored daily by the Ritual.

## Sources

- `documentation/changelog/0.2.7-Pre-Alpha.md` (CHG-0726 through CHG-0729)
- `documentation/work-in-progress.md`
- `documentation/backlog.md`
- `packages/service/src/core/prices.ts`
- `packages/service/src/core/priceSnapshot.ts`
- `packages/service/test/core/priceSources.test.ts`
- `packages/service/src/harness/antigravityProvider.ts`
- `.agents/handoffs/2026-11-25-1320-acp-hygiene-and-multi-account.md`
- `https://discuss.ai.google.dev/t/tos-clarification-scheduled-and-parallel-sessions-of-the-official-agy-acp-from-a-personal-desktop-app/205306`
