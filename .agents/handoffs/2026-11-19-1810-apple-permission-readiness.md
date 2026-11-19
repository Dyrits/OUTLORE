# Handoff: Apple app permission readiness

Supersedes: `2026-11-19-1755-connector-review-fixes.md`
Workspace: Outlore, branch `mission/connectors-composio-and-apple-apps-2aaf91f7`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Integrate the connector quest and verify the Apple permission flow on the owner's Mac.

## State

- CHG-0541 addresses both Apple permission findings. The host tracks selected apps' observed outcomes across screens and returns them to paired devices. The gateway withdraws a denied app's tools and warns without exposing the server's words. See the verification note for the checks run.
- Desktop and paired screen appearance, real Composio, the real Automation prompt, live Claude denial and a real Keychain remain unchecked.

## Decisions

- Permission observations live only for the current host service run. A host restart requires a fresh explicit check. That check and tool calls are the points at which OS access changes are observed.
- An app can be unavailable while other approved apps remain usable. Messages uses the vendored server's `imsg` helper and needs its own Full Disk Access.

## Next

1. Review the branch changes and integrate them into the connector quest branch.
2. Check the Charter on the host and a paired device. Verify a grant, revocation, restart and regrant on macOS with the packaged app.
3. Follow the prior handoff for the remaining live connector and Vault checks.

## Open questions

- What program macOS names in the packaged app's Automation prompt and how localized refusals appear on the installed system.

## Sources

- `documentation/verification/2026-11-19-apple-permission-readiness.md`
- `documentation/capabilities/connectors/specifications.md`
- `packages/service/test/connectors/appleReadiness.test.ts`
- `packages/service/vendor/mcp-icloud.cjs`
