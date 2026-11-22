# Handoff: Ritual creation and editing from conversations

Supersedes: none (forked from `2026-11-21-2108-rituals-as-realm-entities.md`)
Workspace: Outlore at /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS on `main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Create Rituals from realm conversations, quests, and errands, and edit them from quests and errands with owner approval. Keep the plus clear of the crescent in the Add Ritual icon.

## State

- Verified in the local Git history on 2026-11-22: `main` contains `ded8830e` (conversation tools) and `d4eab017` (icon), fast-forwarded from `worktree/ritual-tools`.
- The changelog records lint, typecheck, 2,703 full-suite passes and 64 skips for the tools, and five related test passes for the icon. Live-harness approval and a desktop check of the icon are pending.

## Decisions

- Creation uses the calling realm and links to the quest when called from a quest or errand. Edits from an ordinary quest or errand target a Ritual in that quest's realm.
- Each agent proposal requires a one-time approval for its exact target and configuration. The owner manages the Ritual's reviewed scope in its form.

## Next

1. From a live realm or quest conversation, propose a Ritual with a supported preset. Approve it and check its realm placement and origin link. Propose an edit from the quest or an errand and verify the saved fields after approval.
2. Check the gap around the plus at normal size in the realm sidebar.

## Open questions

- Whether to build sub-hour schedules with daily windows for cases like the mail recap is a separate product decision.

## Sources

- [Rituals specification](../../documentation/capabilities/rituals/specifications.md)
- [Release changelog](../../documentation/changelog/0.2.2-Pre-Alpha.md), CHG-0626 through CHG-0628
- [Conversation tool integration tests](../../packages/service/test/work/guildmasterRituals.test.ts)
- [Sidebar icon](../../apps/app/src/shell/railActions.tsx)
