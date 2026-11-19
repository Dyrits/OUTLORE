# Conversation panes: open decisions

Unresolved proposals only. Agreed behavior is in the [specifications](specifications.md).

## What the Chronicle records

The owner: it "should log everything happening. When a realm opens, when a quest opens, etc.", describe it, and remind the owner of what waits (an errand from yesterday still waiting for an answer). Open: the full list of events, whether each is a message from Chronicler or a system line, whether the Chronicle holds a quest's results and Summons or only the opening, and whether the owner can filter it. Recommended: system lines for opened, finished, failed, archived and Summons events of realms and quests; results stay in the quest's own thread.

## Channels

- How a channel is opened from the sidebar (a realm's row, its name), and what the Borderlands' row is called now that the heading is only a quiet label.
- Whether the Chronicle shows quests of every realm or only the ones opened from it. Recommended: every quest's opening is logged there, and each quest's reply line stays in its own channel.
- Where the channel's Companion is chosen. Recommended: the same Companion button as in every composer.

## Panes

- **Folding versus the equal share.** With one pane folded, the others share the space (three at a third), or the neighbour alone extends. Recommended: the others share it equally. *Built so in batch 2 (CHG-0561); the owner to redirect.*
- **Reply line content.** A quest's reply line and an errand's card show at least the title and the state; whether they also show latest activity, harness and model, or cost is open. Recommended: title, state and latest activity. *Built in batch 2 with the waiting count too (CHG-0561).*
- **Focus and the details panel.** Which pane the details panel follows; recommended: the pane last pressed.
- **Phone.** Recommended: one pane at a time exactly as today, with reply lines opening the next screen.

## Process

The owner does not want a throwaway prototype of the layout (2026-11-19): it is built directly in a worktree, and the feel is judged on the real thing. The pane details above are settled by building them and iterating.
