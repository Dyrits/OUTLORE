# Handoff: Hindsight agent-memory research for Outlore

Supersedes: none
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked (quest "Hindsight for Outlore", 2026-11-21): research https://hindsight.vectorize.io/ against primary sources and assess whether and how Hindsight, Vectorize's agent-memory product, could be used for Outlore. Done looks like a research note in `documentation/research/` with every claim cited to a primary source, ending with a "Use for Outlore" recommendation and open questions.

## State

Done. The research note is `documentation/research/hindsight-vectorize-2026-11-21.md` (committed with this handoff). Verified: the note exists, was read in full, and its four load-bearing claims were spot-checked on 2026-11-21 against their sources: the docsite MCP page (endpoint enabled by default, one per bank, open without auth, `HINDSIGHT_API_MCP_ENABLED=false` to disable), the coding-agents integration page (Claude Code / Codex / opencode wiring, sdebench corrections match; Vibe is not a wired harness), `packages/service/src/harness/claudeArgs.ts:43-44` (`--strict-mcp-config`, `--setting-sources` — the reason a drop-in install cannot fire through Outlore's harness launches), and `documentation/research/cua-computer-use.md` (only Outlore's own MCP server reaches harnesses). The note was written by one errand from the repo clone at commit `62a03bfc96f175e9ac155acc72f292bed9ac4449` and the docs site as of 2026-11-21; nothing was run live (no server, no account, no key).

Key findings, all cited in the note: MIT-licensed, active (78 releases since Dec 2025, v1.2.3 2026-11-19); Postgres+pgvector (embedded pg0 by default); retain/recall/reflect over world facts, experiences, observations (evidence-backed, refined not overwritten) and mental models/pages; recall = semantic + BM25 + graph + temporal with rerank; embeddings local by default (BAAI/bge-small-en-v1.5), LLM extraction default openai/gpt-5-nano but ~25 providers incl. fully local; full image ~0.8–1.5 GB RAM; Cloud retain $10/M tokens.

## Decisions

- **Research-only**: no Hindsight server was started, no account created, no key held, nothing installed. Reason: the work was to assess, not adopt.
- **Recommendation recorded in the note**: do not install `hindsight-coding-agents` for Outlore's harnesses (its hooks/MCP cannot fire through Outlore's strict wiring, and user-scope config would leak non-Outlore projects into per-repo banks). If the owner wants learning memory, run one self-hosted Hindsight behind Outlore's own tool layer (read-only `recall`/`reflect` via `HINDSIGHT_API_MCP_ENABLED_TOOLS`, `HINDSIGHT_API_MCP_AUTH_TOKEN`, banks per realm; Memory Defense on; local or Vault-held LLM key). The narrower alternative first: semantic search over existing lore/journals/handoffs inside Outlore's own store, adopting Hindsight's learning layers only if that proves insufficient.

## Next

1. The owner answers the note's five open questions (recall-only vs learning; LLM provider and who holds the key; whether lore stays the source of truth; Cloud vs on-machine cost; bank/realm attribution rules).
2. Only then, if adoption is wanted: propose the integration as a capability in `documentation/` (outline → specification → ADR if hard to reverse), starting from the note's "Use for Outlore" section.

## Open questions

The five in the note's final section, for the owner. Also: repo-state drift — the note reflects `vectorize-io/hindsight` at commit `62a03bfc` and the docs site on 2026-11-21; a resuming session should re-check maturity/pricing claims dated after that.

## Sources

- `documentation/research/hindsight-vectorize-2026-11-21.md` — the research note (the deliverable).
- Hindsight docs: https://hindsight.vectorize.io/ (overview, /developer/installation, /developer/mcp-server, /developer/memory-defense, /developer/models, /sdks/integrations/coding-agents).
- GitHub repo `vectorize-io/hindsight` at commit `62a03bfc96f175e9ac155acc72f292bed9ac4449` (README, LICENSE, `hindsight-integrations/coding-agents/`, `hindsight-api-slim/hindsight_api/config.py`, `mcp_tools.py`).
- Vectorize pricing: https://vectorize.io/pricing.
- Outlore side: `packages/service/src/harness/claudeArgs.ts`, `documentation/research/cua-computer-use.md`, `documentation/capabilities/tool-and-skill-loading/specifications.md`, `documentation/glossary.md` (lore fading), `documentation/architecture.md` (lore store).
