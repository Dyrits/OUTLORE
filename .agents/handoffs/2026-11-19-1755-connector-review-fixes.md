# Handoff: Connector review fixes

Supersedes: `2026-11-19-1735-connector-thread-tools.md`
Workspace: Outlore, branch `mission/connectors-composio-and-apple-apps-2aaf91f7`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review and integrate the connector quest, including its Charter screens, then perform the owner's live checks.

## State

- Verified by tests: four review findings at `5dbbef92` were fixed: credential-bearing listing metadata, concurrent backend and child startup, child cleanup after failed or interrupted initialize, and HTTP SSE streams that remain open. See the verification note for reproductions and exact results.
- The Charter and thread panel controls are on this branch (CHG-0538 and CHG-0539). The thread panel shows the last cached connector listing; after a restart or failure it stays empty until a successful listing. Its choices may be broader than an active turn's snapshot.
- Not verified: desktop and phone appearance, screen-reader interaction, real Composio, the macOS Automation prompt, live Claude denial, real Keychain and packaged-app launch. Always allow is granted in the existing approval question and managed in Permissions; the Charter does not list individual grants.

## Decisions

- Credential metadata is redacted recursively, including object keys and tool names, before caching while the Vault still lends the secret. The catalog's name check may drop a redacted tool name.
- HTTP waits at most 60 seconds for a response by default, treats a matching SSE reply as complete even while the stream stays open, and closes the reader. Backend acquisition and child lifecycle use separate serialization; a failed or interrupted initialize closes the unowned child and its drain.

## Next

1. Review this branch's fixes and integrate it into the connector quest branch; do not push without the owner's approval.
2. Inspect the screens in a desktop window and on a phone.
3. Run the owner checks in `2026-11-19-1630-connectors-merged.md`: live Claude denial, real Composio key and Apple permission on a Mac. Confirm the stricter Vault rule.

## Open questions

- Whether the real Composio endpoint accepts stateless `tools/list`; how macOS names the program asking for Automation; and whether the owner accepts the controls and Always allow explanation.

## Sources

- `documentation/verification/2026-11-19-connector-review-fixes.md`, `documentation/verification/2026-11-19-connector-charter.md`, `documentation/changelog/0.1.12-Prototype.md` (CHG-0538 to CHG-0540).
- `packages/service/src/connectors/toolListing.ts`, `packages/service/src/connectors/backends/httpMcp.ts`, `packages/service/src/connectors/backends/stdioMcp.ts` and their tests in `packages/service/test/connectors/`.
