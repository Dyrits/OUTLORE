# Handoff: track inspirations' latest changes

Supersedes: none
Workspace: Outlore repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep `documentation/inspirations.md` current against primary sources for every tracked product, fix stale attribution or license notes, and surface concrete candidate ideas and compliance/integration risks for the owner to triage into `documentation/backlog.md`. Done means the owner has chosen which candidate ideas belong in `documentation/backlog.md` and decided how to act on the Antigravity compliance and multi-account findings.

## State

- Four primary-source research notes (dated 2026-11-27) were written under `documentation/research/` and verified present by `git status -s`:
  - `documentation/research/paseo-t3code-openbot-nightly-labs-2026-11-27.md` (OpenBot `v0.80.0`, MausBot `v0.1.184`, Paseo `v0.18.0`, T3 Code `v0.1.13`).
  - `documentation/research/workspace-products-2026-11-27.md` (intentic `v1.431.0`, Cindy `v0.1.148`, Rakazo `v0.16.0`, Turnstone `v0.8.7`, Cookout `0.8.0` / `f254d9e`, Delta `v0.29.0` & DeltaDB).
  - `documentation/research/agent-directory-watchlist-2026-11-27.md` (Hermes Agent `v0.23.4`, Grok Bot live docs, agentes.chat `v0.1.18` / `desktop-v0.8.20`, Codync `v2.54.0`, Bloks `v3.2.15`, Muse Bot / Meta Muse, OpenFuse retired into OpenBot, Noodle `v0.98.0`, OpenBot CopilotKit `v1.2.1`).
  - `documentation/research/assistants-and-memory-2026-11-27.md` (Claude Duet safety article, Crest `0.11.70`, Rerun `v0.25.0`, souls.house & hearth, Timon `ccfafd02`, Beads `0c9c8e69`, `@anthropic-ai/sandbox-runtime` `0.0.83`, Codex `0.174.0-alpha.8`, Claude Code `v2.1.332`).
- `documentation/inspirations.md` was updated with all four research notes (verified by `git diff --stat documentation/inspirations.md`: +150/-43 lines), including moving the misattributed 2026-11-23 sandbox bullets to Hermes Agent and Codync, updating verified/changed licenses (Cindy and Rakazo Apache-2.0, agentes.chat AGPL-3.0, Noodle FSL-1.1-ALv2, souls-house MIT, Timon AGPL-3.0), retiring OpenFuse, and updating Crest's repository URL.
- No code, specifications, or `documentation/backlog.md` entries were changed yet.
- Pending in this session: commit the four research notes, `documentation/inspirations.md`, this handoff, and `AGENTS.md`, then push `main` to `origin/main` (verify with `git status` and `git log origin/main..main` after).

## Decisions

- Ideas only unless an architecture decision record explicitly allows code reuse (`documentation/requirements.md`), and no code was copied from any upstream repository.
- Recorded every finding in `documentation/inspirations.md` first without pre-emptively adding items to `documentation/backlog.md`, leaving backlog prioritization to the owner.

## Next

1. Review the immediate Antigravity compliance finding with the owner: Paseo (`39410ae7`) removed `agy -p /usage` polling citing Google's Antigravity FAQ and maintainer guidance that third-party harnesses running `agy -p` breach consumer terms, which directly affects Outlore's `CHG-0722` (`agy --print "/usage"`).
2. Feed the Antigravity CLI 1.5.16 multi-account fix from MausBot (`7dd86877`: set `AGY_CLI_FORCE_FILE_TOKEN_STORAGE=1` alongside `SSH_CONNECTION`) and ~55 KB tool-list budgeter (`09a4d73c`, `b2e66200`) into Antigravity multi-account batch 2 in `documentation/backlog.md`.
3. Check Outlore's secret scrubbers for Claude Code's new `oat02-` OAuth token prefix (`v2.1.332`) and check relayed `claude -p` handling for `isSynthetic: true`.
4. Triage the candidate ideas summarized in the 2026-11-27 updates of `documentation/inspirations.md` with the owner and add the chosen ones to `documentation/backlog.md`.

## Open questions

- Should Outlore remove or gate `agy --print "/usage"` (`CHG-0722`) to stay compliant with Google's Antigravity consumer terms (owner)?
- Which candidate ideas from the 2026-11-27 inspirations sweep should be promoted into `documentation/backlog.md` (owner)?

## Sources

- `documentation/inspirations.md`
- `documentation/backlog.md`
- `documentation/research/paseo-t3code-openbot-nightly-labs-2026-11-27.md`
- `documentation/research/workspace-products-2026-11-27.md`
- `documentation/research/agent-directory-watchlist-2026-11-27.md`
- `documentation/research/assistants-and-memory-2026-11-27.md`
