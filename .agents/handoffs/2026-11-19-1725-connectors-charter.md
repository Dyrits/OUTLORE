# Handoff: Connector Charter controls

Supersedes: none (forked from `2026-11-19-1630-connectors-merged.md`)
Workspace: Outlore, branch `mission/connectors-composio-and-apple-apps-2aaf91f7`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish and review the connector Charter, placement controls and live checks, then integrate the connector quest.

## State

- Verified by test: `fe740ae4` adds `ReadConnectorChoices` for the Borderlands, realm and quest; five service tests pass. The app draws the catalog, Vault and placement controls; four pure app tests pass. See the [verification](../../documentation/verification/2026-11-19-connector-charter.md) for commands and limits.
- Verified by command: Biome and typecheck passed; the full suite passed 2,428 tests, 62 skipped before the final explicit refresh adjustments. The commit hook on `fe740ae4` also passed its affected suite.
- Not verified: the appearance or interaction in a window or on a phone, screen-reader behavior, real Composio, macOS Automation, the live Claude denial check, or a real Keychain. Apple permission results are shown for the current request and are not persisted by the UI.
- The thread panel's connector tools line remains unbuilt. The tool list explains Always allow through the existing question and Permissions page; it does not show individual grants.

## Decisions

- Install confirmation includes the catalog notice and Apple app choices; the host window requests Apple permissions after install. A paired device is told to request them on the host. Permissions are managed through the existing approval flow, not independently granted by a tool switch.
- Inherited placement choices show the inherited value and offer Reset when explicit. A global Off disables the placement switch but leaves Reset available.

## Next

1. Review the implementation and its unverified interface in a desktop window and on a phone; address the missing thread panel tools line if required for the agreed slice.
2. Merge the errand branch into the connector quest branch after review; do not push without the owner's approval.
3. Perform the owner-run checks in the merged connector handoff: live Claude denial, real Composio key and Apple permission on a Mac. Confirm the stricter Vault rule.

## Open questions

- Whether the owner accepts the screens and the placement of the Always allow explanation.
- Whether the real Composio endpoint accepts stateless `tools/list`, and how macOS names the program asking for Automation.

## Sources

- `documentation/capabilities/connectors/specifications.md`, `documentation/capabilities/connectors/blueprint.md`, `documentation/verification/2026-11-19-connector-charter.md`, `documentation/changelog/0.1.12-Prototype.md` (CHG-0543).
- `apps/app/src/connectors/`, `apps/app/src/settings/connectorsCard.tsx`, `apps/app/src/settings/vaultCard.tsx`, `apps/app/src/quests/questPanel.tsx`, `packages/service/src/connectors/connectorChoiceCards.ts`.
