# Handoff: Thread permission modes

Supersedes: none
Workspace: Outlore, feature commit `9b5631bd` on `worktree/thread-permissions`, with `main` as the delivery branch

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Let the owner choose how a thread handles tool approvals. Full access should stop repeated Mistral Vibe tool prompts when the owner selects it.

## State

- Verified against Git and the implementation. Feature commit `9b5631bd` adds the composer picker, host-only mode changes between turns, a nullable persisted override, and automatic approval history.
- Verified during implementation. Biome, typecheck, desktop build and web export passed. The full suite had 2,665 passes and 64 skips. The ACP stand-in received `allow_once` in Full access and prompted after switching back to Default permissions. The commit hook also passed.
- Window interaction and live Vibe remain unverified. The attempted Chromium run failed at macOS Mach service registration before opening the app.

## Decisions

- Default permissions follows the Workshop. Each thread starts with that setting. The owner can choose Supervised, Auto-accept edits, Auto or Full access from the host composer.
- Auto uses Outlore's containment policy. Full access automatically answers individual harness tool requests. Separate Outlore approvals and requests to widen the sandbox for a turn still ask.

## Next

1. Check the composer in a host window. Verify that selecting Full access persists after reopening the thread and that Default permissions restores the Workshop policy.
2. In a live Vibe thread, run a harmless command such as `git status` under Default permissions and Full access. Check the question and the automatic entry in Permissions history.

## Open questions

The host-window interaction and live Vibe behavior still need direct observation.

## Sources

- [Approval specification](../../documentation/capabilities/action-approval/specifications.md#thread-permission-modes) and [delivery record](../../documentation/changelog/0.2.1-Pre-Alpha.md)
- [Vibe stand-in test](../../packages/service/test/harness/vibe.test.ts) and [approval policy tests](../../packages/service/test/work/approvalsSandbox.test.ts)
- Feature commit `9b5631bd`, based on `42449116`
