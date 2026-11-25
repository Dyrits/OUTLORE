# Handoff: Beads research and what to borrow for memory and errand ordering

Supersedes: none
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Decide whether `gastownhall/beads` (the `bd` agent issue tracker) is worth using or borrowing from in Outlore, and say what Outlore's own memory management should do next.
Done means the research note is committed and the owner has chosen which borrowed ideas, if any, enter the backlog.

## State

- **Research note written and committed with this handoff (verified: file read, 196 lines):** `documentation/research/beads-2026-11-25.md`, sources pinned to Beads commit `78624109904655d7a4609f27d34eb0982cd8963f`, with a comparison table against Outlore's lore, journal, handoffs and backlog.
- **Inspirations entry added (verified: `git diff` read):** a dated "Beads" section in `documentation/inspirations.md` under the memory and long-running agents group.
- **Recommendation (from the note, not re-derived):** borrow ideas; do not adopt Beads as a connector, a dependency or Outlore's store.
- **Not done:** the changelog and backlog are untouched, because research is not an agreement.
- **Not verified by running anything:** the research read Beads' source and docs only and ran none of its code.
  The clone was shallow (50 commits) and Beads' GitHub issues were not read.
  The parallel-worktree lock claim is inferred from its docs.
- **Chat analysis after the research (assumed, not recorded elsewhere):** `bd remember` is the smallest memory plane of the three compared (Hindsight, Beads, Outlore lore) and adds nothing Outlore lacks.
  Beads' value is its task graph, not its memory.
  The suggested order for Outlore's own memory work, which matches the existing backlog item "A leaner turn preamble and finding past work": (1) list realm lore as a one-line index in the turn preamble, (2) add a Beads-style elision notice (whole-entry cap plus "N more, use `search_intel`"), (3) rank preamble entries against the quest's briefing, (4) defer finding past work by meaning until its absence is felt, (5) journal compression is optional.
  The preamble size figure (about 2 to 3k tokens, 3 of 23 realm entries used) is the Hindsight quest's measurement and was not re-measured.

## Decisions

- **Borrow ideas, do not adopt (research recommendation, not yet confirmed by the owner):** reasons are telemetry on by default, hooks that Outlore's `--setting-sources ""` launch never runs, a fast and still-changing release cadence, and a shared single-writer workspace across worktrees.
- **No item added to the backlog yet:** the owner has not chosen.

## Next

1. Ask the owner which direction they meant: a product feature (errand dependencies with a computed ready set, gates, workflow templates for `workflow-running`) or a development tool for Outlore itself.
2. If memory is the interest, offer one batch for the leaner turn preamble: realm lore as a one-line index plus the elision notice, with a test on the preamble builder, and add the elision rule to the backlog item.
3. If product features are the interest, settle where errand ordering belongs (`mission-tracking`, `thread-tree`, or a new `workflow-running` specification) before any specification text.
4. Optionally run `bd` in a sandboxed scratch folder to check what it writes and whether its opt-outs stop all network calls.

## Open questions

- Product feature or development tool? The owner answers.
- Should errand ordering be edges between errands in one quest, or a separate list of work items? The second would break the glossary's "Avoid: task, ticket" rule; the owner answers.
- If threads ever run `bd`, where does the telemetry opt-out live? The owner answers.
- Beads' open issues for data loss, corruption and lock reports were not read; a later research pass can answer.

## Sources

- `documentation/research/beads-2026-11-25.md`
- `documentation/inspirations.md` (the "Beads" section)
- `documentation/backlog.md` (the item "A leaner turn preamble and finding past work")
- `documentation/research/hindsight-vectorize-2026-11-21.md`
- https://github.com/gastownhall/beads (commit `78624109904655d7a4609f27d34eb0982cd8963f`)
