# Handoff: Missives and realm panes window review

Supersedes: `2026-11-20-0900-missives-samples-quests-tab.md`
Workspace: Outlore, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review CHG-0571 in a running Outlore window and resolve any layout or wording issues the owner finds. The batch covers Missives, reply-line samples, a realm's Quests tab, and the Chronicle rows.

## State

- Verified in the source diff on `main`. CHG-0571 follows the blank-pane repair at `0f549858`. The owner directed this batch to be committed and pushed on `main`. Check Git for the resulting revision and publication status.
- The verification record holds the previous session's automated results. Desktop and phone appearance, narrow-pane behavior, and live harness samples still need review.

## Decisions

- The realm's Quests tab shares the channel pane with Missives. Selecting a quest opens it in the next pane.
- Samples show the latest owner message and Companion reply, each up to 160 characters. The realm list puts the most recently active quests first. See CHG-0571 for the behavior choices.

## Next

1. Review the Missives tab, the quest and errand reply blocks, the realm Quests tab, and the Chronicle header rule and rows in light and dark themes at wide and narrow widths.
2. Record the owner's feedback and address any issues they find.

## Open questions

- The owner can decide during window review whether to change the speaker labels, group quests by state, or include a queued steer in the sample.

## Sources

- [CHG-0571](../../documentation/changelog/0.1.13-Prototype.md)
- [Conversation panes specification](../../documentation/capabilities/conversation-panes/specifications.md)
- [Verification record](../../documentation/verification/2026-11-20-missives-samples-quests-tab.md)
