# Handoff: Hindsight research for Outlore and its lore follow-ups

Supersedes: `2026-11-21-1521-hindsight-research.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked to research https://hindsight.vectorize.io/ (Vectorize's agent memory) and whether it could be used for Outlore, then — after reading the research — asked how memory handling holds up, whether the lore/context each turn uses can be optimized, and how lore naming, panel display, and pinning work. Done looks like: the research note delivered and pushed, the owner's decisions recorded, the follow-up candidates backlogged, and this session's state committed and pushed to main.

## State

- Research delivered and verified: `documentation/research/hindsight-vectorize-2026-11-21.md` (commit `f4fd1116`, pushed). Load-bearing claims spot-checked against the docs site, the coding-agents page, `packages/service/src/harness/claudeArgs.ts:43-44`, and `documentation/research/cua-computer-use.md`. (Verified by reading the note in full and re-fetching two of its sources, 2026-11-21.)
- Owner decisions after reading it (2026-11-21): current lore/journal/handoff handling is sufficient for now; no Hindsight adoption yet; the smaller in-Outlore step is backlogged — "A leaner turn preamble and finding past work" added to `documentation/backlog.md`, commit `e4367b90`, pushed. Revisit Hindsight only when finding past work is felt as missing. Also approved: deleting the superseded lore entry `f0e584c6` (done, via `forget_intel`).
- Follow-up questions answered this session (2026-11-21), each evidenced in the repo:
  - **`intel` → `lore` rename in code**: already done in living names; `intel` survives only where in-code comments say it is pinned for existing data and agents — thread tool names (`save_intel`, …, `packages/service/src/work/loreTools.ts`), stored names (`intels` table, `intel_history`, `packages/service/src/lore/loreStore.ts`), and the `scoped-intel` capability slug cited by hundreds of `(scoped-intel, …)` spec anchors in code comments. Advised against extending the rename. (Verified by grep, 2026-11-21.)
  - **Lore panel density**: card-per-entry idea added to the "Intel, staged from batch 12" backlog item, commit `503fd7` → `503ddfd7`, local until this handoff's push.
  - **Pinning**: explained — it holds an entry's strength against fading so it stays in every thread's starting context, at standing context-meter cost (the panel's meter read 2653 tokens for this quest's lore).
- Realm lore carries the session's conclusions: `d5b4276e` (the Hindsight evaluation fact), `8f23307d` (the owner's "sufficient for now" decision).

## Decisions

- No Hindsight server, account, key, or installer: research only. The note's five open questions (recall-only vs learning; LLM provider and who holds the key; whether lore stays the source of truth; Cloud vs on-machine cost; bank/realm attribution) stay open and precede any adoption work.
- Leaner lore habits going forward (owner-approved): consolidate duplicates, save at the narrowest scope, rely on lore only when it truly guided the work.
- Do not extend the `intel` → `lore` rename into stored or wire names.
- Quest journal is the record for this quest (entries 1–5); this handoff supersedes the first handoff of this thread.

## Next

1. Nothing in flight that changes files: the quest awaits the owner's answers to the five open questions in the research note before any Hindsight adoption proposal.
2. If adoption is wanted, propose it as a capability (outline → specification → ADR if hard to reverse), starting from the note's "Use for Outlore" section.
3. Backlog items seeded by this session, to schedule when the owner chooses: "A leaner turn preamble and finding past work" and the card-per-entry lore panel under "Intel, staged from batch 12".

## Open questions

- The five in `documentation/research/hindsight-vectorize-2026-11-21.md`'s final section, for the owner.
- Which (if any) of the backlog items above to build next is the owner's scheduling call.
- Repo-state drift: the Hindsight note reflects `vectorize-io/hindsight` at commit `62a03bfc` and the docs site on 2026-11-21; re-check before relying on maturity or pricing claims dated later.

## Sources

- `documentation/research/hindsight-vectorize-2026-11-21.md` — the research note (the deliverable).
- `documentation/backlog.md` — "A leaner turn preamble and finding past work" and "Intel, staged from batch 12" (card idea).
- `documentation/glossary.md:304-305` — lore is the term; avoid "Memory, note, knowledge, intel".
- `packages/service/src/work/loreTools.ts`, `packages/service/src/lore/loreStore.ts`, `packages/contracts/src/lore.ts` — the in-code "stored and wire names keep `intel`" pins.
- `documentation/research/cua-computer-use.md`, `packages/service/src/harness/claudeArgs.ts` — the strict harness wiring that blocks drop-in coding-agent memory.
- Hindsight primary sources as cited in the research note (repo `vectorize-io/hindsight` at `62a03bfc`, docs site `https://hindsight.vectorize.io/`, `https://vectorize.io/pricing`).
