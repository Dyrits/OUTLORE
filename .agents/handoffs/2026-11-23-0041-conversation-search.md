# Handoff: find in conversation

Supersedes: none
Workspace: OUTLORE, `worktree/conversation-search`, based on `d37d7b77`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Let the owner find a message anywhere in the open conversation's history and read it in context.

## State

- Verified by source review. The shared message feed provides Find in quest, errand, and Chronicler conversations. It uses messages already returned by the host and shares the feed's jump and retry behavior.
- Automated checks and the desktop and phone acceptance steps are in the [verification record](../../documentation/verification/2026-11-23-conversation-search.md).

## Decisions

The owner was open to either search scope. The first batch searches one conversation and counts matching messages. Cross-conversation search remains a possible follow-up.

## Next

Run the acceptance steps in the desktop window and on a paired phone.

## Open questions

Whether search across realms, quests, and errands is needed after using Find.

## Sources

- [Conversation panes specification](../../documentation/capabilities/conversation-panes/specifications.md#find-in-conversation)
- [Conversation feed](../../apps/app/src/conversation/conversationFeed.tsx)
- [Search tests](../../apps/app/test/conversation/conversationSearch.test.ts)
