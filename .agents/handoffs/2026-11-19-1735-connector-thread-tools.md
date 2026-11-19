# Handoff: Connector Charter and thread tools

Supersedes: `2026-11-19-1725-connectors-charter.md`
Workspace: Outlore, branch `mission/connectors-composio-and-apple-apps-2aaf91f7`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review and integrate the connector Charter, thread panel and live checks.

## State

- Verified by tests: the Charter choices read and controls are built (CHG-0543); the thread panel lists Outlore's tools and usable connectors' cached tools, marking off tools (CHG-0544). It uses the quest's placement for errands and follows moves; unchosen Apple apps and unnamed Apple tools are absent. See the verification note for test results.
- The tool list uses the last in-memory server listing. After a service restart or failed listing, no connector tools are shown until a successful listing; the panel does not contact a server itself. The list reflects current choices, while a turn's admitted snapshot can be narrower until the next turn.
- Not checked: a desktop window, phone, screen reader, real Composio, the macOS Automation prompt, live Claude denial, or a real Keychain. The Charter explains Always allow through approval questions and Permissions but does not show individual grants; Apple permission reports are held only in the open screen.

## Decisions

- Tools live in the Knows group, collapsed behind a row, following the existing Skills row; the specification left the group open. The panel distinguishes current choices from turn timing and names the cached listing's limitation.
- The panel is read-only and never starts a connector server. A connector must be usable for this thread before its tools, including switched-off ones, appear.

## Next

1. Review the screens in a desktop window and on a phone, including the new tools row.
2. Review and merge the errand branch into the connector quest branch; do not push without the owner's approval.
3. Run the owner checks in `2026-11-19-1630-connectors-merged.md`: live Claude denial, real Composio key and Apple permission on a Mac. Confirm the stricter Vault rule.

## Open questions

- Whether the owner accepts the controls, the Knows grouping and the Always allow explanation.
- Whether the real Composio endpoint accepts stateless `tools/list`, and how macOS names the program asking for Automation.

## Sources

- `documentation/capabilities/connectors/specifications.md`, `documentation/capabilities/connectors/blueprint.md`, `documentation/verification/2026-11-19-connector-charter.md`, `documentation/changelog/0.1.12-Prototype.md` (CHG-0543 and CHG-0544).
- `packages/service/src/connectors/connectors.ts`, `packages/service/src/work/threadPanel.ts`, `packages/service/test/connectors/threadPanelTools.test.ts`, `apps/app/src/conversation/threadPanel.tsx`.
