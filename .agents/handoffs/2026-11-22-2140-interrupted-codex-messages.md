# Handoff: Interrupted Codex messages

Supersedes: none
Workspace: Outlore, `mission/outlore-next-batch-3e6266c7`, starting revision `7026ce87`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep the owner's earlier messages and images available to Codex when the owner interrupts and follows up.

## State

- Verified against the original Outlore transcript and Codex rollout. Outlore stored the opening text and image, but Codex's aborted turn and its continuation lacked both. See the verification record for the read-only evidence and the regression command.
- Verified at the Codex app-server request boundary. The regression exercises an interrupted opening turn and a queued follow-up in the same session.

## Decisions

Restore the stored owner input as context on the next turn in the existing Codex session. Existing new-session history rules still apply.

## Next

In a disposable desktop quest, start a Codex turn with a distinctive phrase and image. Queue a follow-up that refers to both and interrupt the first turn before it answers. Verify the follow-up can use both.

## Open questions

The original outbound request was unavailable. The rollout confirms what Codex recorded and leaves open whether the original input reached the model before cancellation.

## Sources

- [Verification](../../documentation/verification/2026-11-22-interrupted-codex-messages.md)
- [Thread messaging](../../documentation/capabilities/thread-messaging/specifications.md#interruptions)
- [Codex regression](../../packages/service/test/harness/codex.test.ts)
