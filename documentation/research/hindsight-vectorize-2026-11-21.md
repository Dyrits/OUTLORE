# Hindsight, Vectorize's agent memory: memory that learns (read 2026-11-21)

Primary sources read for the owner's question "could https://hindsight.vectorize.io/ be used for Outlore". The claims
below are from Hindsight's own docs site, the `vectorize-io/hindsight` repo (its source is the docs site's source too),
and Vectorize's pricing page — never from a third-party write-up. Nothing was run: no server was started, no account
created, no key held, and no request was sent to a Hindsight server or to Hindsight Cloud.

## Sources

- Repo `vectorize-io/hindsight`, branch `main`, commit `62a03bfc96f175e9ac155acc72f292bed9ac4449` (cloned and read
  2026-11-21; MIT). Paths below are relative to the clone. Docs-site pages cited by URL are rendered from
  `hindsight-docs/docs/` in this same commit; the URL is the published form of the cited file.
- `README.md` and `LICENSE` ("Copyright (c) 2025 Vectorize AI, Inc.", MIT; `LICENSE`).
- GitHub API, read 2026-11-21: repo created 2025-10-30, ~62,364 stars, 7,394 forks, 78 releases; first release
  v0.1.0 2025-12-09, v1.0.0 2026-10-13, newest v1.2.3 2026-11-19.
- Docs site, read 2026-11-21: `https://hindsight.vectorize.io/` (overview; `README.md` mirrors it),
  `/developer/installation` (`hindsight-docs/docs/developer/installation.md`), `/developer/mcp-server`
  (`.../mcp-server.md`), `/developer/memory-defense` (`.../memory-defense/index.md`), `/developer/models`,
  `/developer/observations`, `/developer/mental-models`, `/developer/pages` (`hindsight-docs/docs/developer/*.mdx`).
- `hindsight-integrations/coding-agents/README.md` and `src/` — the coding-agent integration the assessment below is
  about (published at `https://hindsight.vectorize.io/sdks/integrations/coding-agents`).
- Vectorize pricing, fetched 2026-11-21: `https://vectorize.io/pricing`.

## What Hindsight is (memory model, architecture, license, maturity)

- **Product and backing.** "Hindsight™ is an agent memory system built to create smarter agents that learn over time…
  focused on making agents that learn, not just remember" (`README.md`). Built by Vectorize.io; state-of-the-art claim
  on the LongMemEval benchmark, "independently reproduced by research collaborators at the Virginia Tech Sanghani
  Center… and The Washington Post", with live results at `https://benchmarks.hindsight.vectorize.io/` and a paper
  (arXiv 2512.12818) (`README.md`).
- **License and maturity.** MIT, and Vectorize's pricing FAQ puts it in writing: "MIT licensed, no usage limits, **no
  telemetry**, and no restrictions" (`https://vectorize.io/pricing`). The GitHub README page carries a web-analytics
  pixel in its footer (`README.md` line 457), but that is the GitHub page, not the product. The repo is 13 months old
  and very active: 78 releases in a year, a release cadence of days, v1.0.0 on 2026-10-13, and a Models launch on
  2026-11-03 (`hindsight-docs/blog/2026-11-03-hindsight-models.md`).
- **Memory model.** Four memory types: **world facts** ("the stove gets hot"), **experiences** ("I touched the stove
  and it hurt"), **observations** (consolidated, evidence-backed beliefs), **mental models** (learned understanding
  synthesized from observations and facts). Memories live in **banks** — "isolated memory store… one 'brain' for one
  user, agent, or project. Isolation is strict: no cross-bank leakage" — with per-bank background context and
  "disposition traits (skepticism, literalism, empathy)" that shape reflect (`README.md`).
- **Three operations.** `retain` pushes content in; "behind the scenes, retain uses an LLM to extract key facts,
  temporal data, entities, and relationships" and normalizes them into entities, time series, and search indexes.
  `recall` runs "4 retrieval strategies in parallel: Semantic (vector similarity), Keyword (BM25), Graph
  (entity/temporal/causal links), Temporal (time range filtering)", merged by reciprocal rank fusion plus a
  cross-encoder reranker. `reflect` does a deeper LLM synthesis over the bank (`README.md`);
  `https://hindsight.vectorize.io/developer/retrieval`, `/developer/retain`, `/developer/reflect`).
- **Consolidation and forgetting.** "In the background, Hindsight consolidates related facts into **observations** —
  deduplicated beliefs… Each observation keeps its supporting evidence with exact quotes and a proof count, and is
  *refined* rather than overwritten when new evidence arrives" (`README.md`, and `hindsight-api-slim/hindsight_api/
  engine/consolidation/consolidator.py` docstring: background job creates or updates `memory_units` rows with
  `fact_type='observation'`, `proof_count`, `source_memory_ids`, a `history` JSONB; "updates existing observations
  when new evidence supports/contradicts/refines them"). Memories can also be `invalidate`d and banks `clear`ed (tool
  list in `mcp_tools.py`). There is no automatic TTL/forgetting of raw memories mentioned in the docs read.
- **Mental models and pages.** A mental model is "a standing answer to a question about a bank… You define the
  question once; Hindsight writes the answer, stores it, and rewrites it in the background as the bank learns more.
  Reading one is a database read". Pages are mental models "with the mechanics hidden: living documents a bank writes
  about itself, organized in folders like a wiki… projectable onto disk as ordinary markdown" (`README.md`;
  `https://hindsight.vectorize.io/developer/mental-models`, `/developer/pages`).
- **Architecture.** A Python API server (REST on :8888, a UI on :9999). Storage is "PostgreSQL + pgvector" — PostgreSQL
  14+ with pgvector (default) or pgvectorscale/vchord/scann; "Oracle AI Database 23ai" parity for enterprise — and by
  default it runs **pg0**, "an embedded PostgreSQL that runs locally… convenient for development but **not recommended
  for production**" (`hindsight-docs/docs/developer/installation.md`). Deployment: one Docker command
  (`ghcr.io/vectorize-io/hindsight:latest`, with a named volume for pg0), docker-compose with an external Postgres,
  pip (`hindsight-api`), a Helm chart, or a Python-embedded server (`hindsight-all`, no server)
  (`README.md`, `installation.md`).
- **Resource footprint.** "Designed to run on commodity hardware": the **full** image (bundled local models) is 1.5 GB
  minimum / 2 GB recommended RAM — local BGE embedder ~130 MB + MiniLM cross-encoder ~90 MB plus torch/ONNX arenas,
  "idle RSS settles around 0.8–1.0 GB; expect 1.2–1.5 GB under load"; the **slim** image with external
  embeddings/rerankers shrinks "to a few hundred MB of RAM" (`installation.md`). Postgres adds its own footprint unless
  pg0 counts as it.
- **LLM and embedding providers.** Retain extraction, reflect, consolidation and mental-model refresh need an LLM:
  "25+ LLM providers" — hosted (openai, anthropic, gemini, groq, bedrock, …), "fully local (`ollama`, `lmstudio`,
  `llamacpp`)", any OpenAI-compatible endpoint, gateways, and subscription carriers that need no key
  (`openai-codex` from ChatGPT Plus/Pro, `claude-code` from Claude Pro/Max, `cursor`, `github-copilot`)
  (`README.md`; `https://hindsight.vectorize.io/developer/models`). Defaults in code: LLM provider `openai`, model
  `gpt-5-nano` (`hindsight-api-slim/hindsight_api/config.py:1325,1361`); per-operation providers are overridable
  (`HINDSIGHT_API_RETAIN_LLM_PROVIDER` etc., `config.py:481-571`). **Embeddings are local by default**: provider
  "local", model `BAAI/bge-small-en-v1.5` via sentence-transformers (`config.py:1448-1449`), with openai, cohere,
  gemini, nvidia, zeroentropy, TEI, litellm and Hindsight's own `hs-embed-1` as alternatives (`engine/embeddings.py`).
  A reranker is local by default too (cross-encoder; `flashrank`/ONNX on slim), and since 2026-11-03 a **decision
  model** (`hs-decide-1-flash`, 0.8B, Apache 2.0) plus `hs-rerank-1` (114M) and `hs-embed-1` (112M, both MIT) can
  answer Hindsight's internal judgment calls, "so Hindsight sends far fewer of them to your LLM" (`README.md`;
  open weights at `https://huggingface.co/hindsight-ai`).
- **Ingestion paths and SDKs.** REST API; Python, Node/TypeScript, Go clients and a CLI; a LiteLLM wrapper
  (`hindsight-litellm`, `wrap_openai`/`wrap_anthropic`: "memories are then stored and retrieved automatically on
  every call, with no other changes to your code"); a built-in **MCP server** (below); webhooks for
  retain/consolidation/refresh lifecycle events; Prometheus metrics; an admin CLI; "60+ integrations"
  (`README.md`, `https://hindsight.vectorize.io/api-reference`, `/sdks/*`).
- **Multilingual and privacy hygiene.** "Input language is detected and preserved end to end" (`README.md`); banks
  can be created from templates and carry **Memory Defense**, an opt-in per-bank policy that "scrubs secrets and PII
  from retain content using a 45-pattern regex set. Each match is replaced with a `[REDACTED:type]` marker before
  content reaches memory units or the document body. The feature is configured per bank and disabled by default"
  with `redact` or `block` actions (`hindsight-docs/docs/developer/memory-defense/index.md`; OSS per the docs, with
  audit logs/SIEM listed as Enterprise on the pricing page).

## The MCP server

Every API server "ships a built-in Model Context Protocol endpoint, **one per bank, enabled by default**" at
`http://localhost:8888/mcp/{bank_id}/`; auth can be added
(`HINDSIGHT_API_MCP_AUTH_TOKEN`, or the API-key tenant extension) but "the MCP endpoint is **open** (no
authentication required)" by default; it can be disabled with `HINDSIGHT_API_MCP_ENABLED=false`
(`hindsight-docs/docs/developer/mcp-server.md`; `config.py:840-845`). The tool set is large — roughly forty
(`retain`, `sync_retain`, `recall`, `reflect`, plus bank/mental-model/memory/document/page management and
destructive ones like `delete_bank`, `clear_memories`) — and can be narrowed with
`HINDSIGHT_API_MCP_ENABLED_TOOLS` (`mcp_tools.py:72-117`, `config.py:5776-5778`). Read-only annotations mark
`recall`/`reflect` (`mcp_tools.py:611-613,644`), which matters to Outlore's Read/Write tool classes.

## Coding-agent integration (`hindsight-coding-agents`)

This is the angle the owner asked about for Outlore's harness sessions, so it is the deepest part of the read
(`hindsight-integrations/coding-agents/README.md`, `src/`, `hooks/hooks.json`).

- **One package, many harnesses.** "a shared reflect-and-inject core with a thin entry point per agent" — Claude Code,
  Codex CLI, opencode (v1 and v2), Cursor CLI, GitHub Copilot CLI, Kilo, Grok Build, Qwen/Kimi/ZCode/TraeCode, Cline,
  Antigravity, Devin, DeepAgents Dcode, DeepSeek Harness, pi, Prime Agent, WorkBuddy, CodeBuddy, Factory Droid
  (`README.md` of the package). **Vibe is not on the list.** Install: `npx @vectorize-io/hindsight-coding-agents
  install claude-code` (or `install all`); a bare `install` changes nothing.
- **How each target is wired.** Claude Code: "3 hooks in `~/.claude/settings.json` (SessionStart, UserPromptSubmit,
  Stop), MCP via `claude mcp add` (user scope), and the companion skill". Codex: "3 hooks in `~/.codex/hooks.json`
  plus `[mcp_servers]` in `config.toml` (needs `codex_hooks = true`)". opencode: "a plugin entry in
  `~/.config/opencode/opencode.json` — native tools, no MCP needed" (and opencode v2 shares that file). The hooks for
  all of them are 30s/30s/60s `node dist/...-hook.js` command hooks (`hooks/hooks.json`; `src/claude-sessionstart-hook.ts`,
  `src/claude-hook.ts`, `src/claude-stop-hook.ts`).
- **What gets captured, and when.** Automatic; "there is no setup command". Bank is **one per repo**
  (`coding-agent::{gitProject}`), shared by every agent. The `deepen` engine is "spawned by every session start and
  does only the missing work: bank configuration, conversation import (dedup by document id), the one-time gitlog
  seed, the next per-commit diff batch (newest first, bounded per run), then pages once extraction has drained".
  Live sessions write their transcript back on the **Stop** hook ("Claude Code `Stop` hook: writes the session
  transcript back to memory", `src/claude-stop-hook.ts`), via `POST /memories` and a bank manifest `POST /import`
  (`src/core/hindsight.ts:517,541,722`). Injection: an **auto-inject once per session on the first prompt** — by
  default a `reflect` ("agentic synthesis over the bank returning the root-cause decision with exact values") with
  cheaper `pages` or `recall` alternatives — "PAGES every turn: the page set is fetched on a cadence and matched
  LOCALLY against the prompt (section-level lexical scoring — no server/LLM call)" (`src/core/hook.ts` docstring).
  Past conversations can be re-imported from local transcripts (`--import-conversations`), strictly: a session is
  imported "only when the session itself records the directory it ran in — never inferred"; harnesses keeping history
  in unversioned SQLite (opencode, Kilo, Cursor, Cline, Copilot, Devin) are skipped.
- **Where memory lives (three modes, asked once at install; `--server cloud|self-hosted|daemon`)**: `cloud`
  (Hindsight Cloud, default, needs an API token), `self-hosted` (a server you run), `daemon` — "a local
  `hindsight-embed` on this machine… starts on demand at `127.0.0.1:9077`… It keeps running until you stop it. There is
  deliberately no stop-on-exit". Daemon mode "needs `uv` on PATH + an LLM key for extraction"
  (`HINDSIGHT_API_LLM_PROVIDER` wins, else the first of OPENAI/ANTHROPIC/GEMINI/GROQ keys, else the Claude Code CLI
  subscription), and "**macOS additionally needs a current Rust toolchain**: `litellm`… publishes wheels only for
  Linux and Windows, so a Mac compiles it from source" (`hindsight-integrations/coding-agents/README.md`).
- **Does it help?** Their own numbers, agent-memorybenchmark.ai sdebench (61 repo tasks, 3 runs, mean per task —
  self-reported, not verified here): corrections Claude Code 0.85 → 0.36, Codex 1.34 → 0.47, opencode 1.20 → 0.80;
  cost $0.445 → $0.338 / $0.577 → $0.276 / $0.634 → $0.553. Same README's own read: "Accuracy is not what moves…
  What memory changes is how much it costs you".
- **Skills.** The repo also ships five agent skills (`skills/hindsight-docs|local|self-hosted|cloud|architect`) —
  the memory ones tell a coding agent to "proactively store learnings and recall context" via the client CLI, and
  `hindsight-docs` is a docs dump for agents (`skills/*/SKILL.md`).

## Privacy and data flow

- **Self-hosted, local providers chosen**: nothing leaves the machine; pg0 holds the data locally, embeddings and
  reranking default to local models, and the LLM can be `ollama`/`lmstudio`/`llamacpp` (`README.md`,
  `installation.md`, `config.py`). **Self-hosted, hosted LLM chosen (the default is `openai`)**: every retain sends
  its content to the LLM provider for fact extraction — the transcripts being remembered go to that provider, and
  reflect/consolidation/page refresh call it again. Hindsight itself "no telemetry" (`https://vectorize.io/pricing`).
- **Hindsight Cloud**: memory content and conversations go to Vectorize's service. The coding-agents installer
  defaults there and its own docs flag the stakes: "defaulting to Cloud instead would quietly send your prompts
  somewhere else" (`hindsight-integrations/coding-agents/README.md`).
- **Cost of Cloud** (`https://vectorize.io/pricing`, fetched 2026-11-21; $5 free credit, no fixed fee): retain
  **$10.00 per million tokens**, recall $0.75/M, reflect $0.05/call, Iris Extract $7.50/M, mental-model retrieve
  $0.25/M and refresh $0.05/call, storage $0.25/M tokens per month after the first 30 days ("your memories are never
  deleted"). Hindsight Inference (the three models) is billed per million input tokens from the same balance
  ($0.02 decide, $0.015 rerank, $0.005 embed).
- **Memory Defense** (above) is the PII/secrets hygiene; it is opt-in per bank, regex-based (45 patterns), and never
  retroactive.

## Use for Outlore

Outlore's memory today is deliberate and small: lore entries of "one fact per lore entry, at most 200 tokens" saved at
thread/mission/workspace/global scope, each with a kind (rule, preference, decision, fact, temporary) that sets "how
fast it fades when unused" — out of the starting context below a strength of 0.15, out of search below 0.05
(`documentation/glossary.md:312-321`); lore reading is "each thread's lookup scope and recall (scoped lore in full,
global lore as an index)" with ranked, counted uses in `loreStore.ts`
(`documentation/architecture.md:77`). Each quest keeps a shared briefing and an append-only journal; handoffs keep
session state. Nothing semantic searches across quests' history: recall is by id (`search_intel`) or by reading a
known journal, and lore no one reads fades. Hindsight's differentiators map onto
exactly that gap — consolidated, evidence-backed observations; reflect-style synthesis; pages that persist a standing
answer (architecture, conventions, in-flight work); semantic + keyword + graph + temporal recall over everything ever
retained.

**(a) Backing or complementing Outlore's lore system — plausible, at the service layer.**

- The fit: Outlore's service (not the harness) calls Hindsight's REST API. A bank per realm (Hindsight's own bank
  naming for repos would even line up with Outlore's realm-attached folders — bank_id from the realm or its git
  project). Outlore already owns the two ends: it could write journal entries, lore saves, and handoff summaries with
  `retain` as they happen (the transcript content Outlore already holds), and give threads a read-only `recall`
  through Outlore's own tool server — the same shape as `search_intel`, backed by semantics plus evidence. Mental
  models/pages could even be produced from the lore the way lore-from-handoffs works, but that risks two competing
  "brains" for the same purpose (open question 3).
- The obstacle set is Outlore's own wiring, verified in the computer-use research: Outlore harness sessions receive
  only Outlore's MCP server — Claude Code runs `-p --strict-mcp-config --setting-sources ""` with an `mcp-config`
  holding only Outlore's tool server; OpenCode gets `mcpServers: []` (`documentation/research/cua-computer-use.md`;
  `packages/service/src/harness/claudeArgs.ts`), and Outlore-managed external MCP configuration is explicitly
  "not built" (`documentation/capabilities/tool-and-skill-loading/specifications.md`). Any per-harness install
  (below) is therefore out of reach until that capability exists; the service-layer route does not wait for it.
- If exposed to threads directly, whitelist `HINDSIGHT_API_MCP_ENABLED_TOOLS` to `recall,reflect` (read-only)
  and set `HINDSIGHT_API_MCP_AUTH_TOKEN`; the endpoint is otherwise open, and the full tool set includes
  `delete_bank`/`clear_memories`.

**(b) Memory for the harness sessions Outlore spawns — the drop-in path does not land today.**

- The `hindsight-coding-agents` installers are the drop-in wiring: for Claude Code they write user-scope
  `~/.claude/settings.json` hooks, and the value ("a per-repo bank built automatically from git history and past
  sessions, injected into the agent as it starts working, plus curated pages covering architecture, conventions and
  in-flight work") is precisely the memory a thread's sandbox session lacks. Vibe is not among the wired harnesses;
  Claude Code, Codex, and OpenCode are.
- But Outlore's harness launches neutralize it by design: `--setting-sources ""` means Claude Code ignores the user
  settings holding those hooks, and `--strict-mcp-config` discards their MCP entry; the specification says so
  (sources above). Making the drop-in work would mean passing harness settings through — a capability Outlore has
  consciously deferred.
- The workable substitute is (a) inverted: write each thread session's transcript back with `retain` when Outlore
  captures the harness result, and inject a page/recall at `thread/start` alongside the briefing. That reproduces the
  reflect-and-inject loop inside Outlore, where permission classes (Read vs Write), lore scope, and logging already
  live.
- **Docker server or daemon?** The daemon mode (always-on `hindsight-embed` at 127.0.0.1:9077) wants `uv` plus a Rust
  toolchain on macOS to compile litellm, and runs indefinitely; the Docker server is a one-command alternative with
  full-image RAM ~0.8-1.5 GB. Both put a permanent new service on the owner's machine with a database to fill the
  APFS volume that previously ran out of space — not an argument against, but a plant/cost decision, ideally a user-
  controlled realm attachment; Outlore could equally start it only when a realm opts into memory.

**Top recommendation.** Do not install `hindsight-coding-agents` for Outlore's harnesses — its hooks and MCP cannot
fire through Outlore's strict wiring, and the installed user-scope config would leak memory of non-Outlore projects
into the same machine's banks. The promising use is as a privately-run service behind Outlore's own tool layer: a
single self-hosted Hindsight (Docker; local ollama for extraction or one hosted key; Memory Defense on; banks per
realm or per repo), Outlore's service retaining journal entries and session transcripts and offering threads a
read-only `recall`/`reflect` tool next to `search_intel`. Before any of that, the honest comparison to make is
narrower: if the only felt gap is finding things in Outlore's accumulated lore/journals/handoffs, semantic search
over existing artifacts inside Outlore's own store may be the reachable first note on Hindsight's learning layers
(observations, mental models, reflect) added only if that proves insufficient.

**Open questions for the owner.**

1. Is the goal recall of what Outlore already keeps (semantic/keyword search over lore, journals, handoffs —
   possibly inside Outlore's own store), or learning (evidence-backed observations, standing pages) that Outlore does
   not have? The first is a smaller feature in Outlore; the second is Hindsight's real subject.
2. If Hindsight runs: which LLM does retain call — a local ollama (code and conversations never leave, plausibly
   slower) or a hosted key (the default `openai` provider inherits the Cloud-adjacent data flow)? And who owns that
   key — Outlore's key model may want it in the Vault.
3. Divided memory: does lore stay the source of truth with recall as an index, or do observations and pages become
   a second brain the threads also follow? Outlore's fading/replacement governance has no analogue in Hindsight
   (nothing forgets automatically).
4. Cost shape: Cloud retain is $10/M tokens (a long thread transcript is tens of thousands of tokens — real money at
   quest volume); the alternative on-machine (Docker image, models, Postgres) is disk and ~1 GB resident RAM on the
   G-DRIVE machine, plus the daemon's Rust toolchain requirement on macOS.
5. Provenance and provenance only: Outlore lore entries carry scope and fade when unused; would a Hindsight recall
   held to the same rule (bank per realm, never cross-realm), and does anything need the git-history ingestion, or is
   that redundant with Outlore's own changelogs and ADRs?
