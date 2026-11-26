# Handoff: phone control (agents use the phone through the paired app)

Supersedes: none
Workspace: OUTLORE repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Let agents (threads and Chronicler, on any harness) control the owner's phone through `phone_*` tools that the Android app executes.
Done means step 1 (the app's own capabilities) is built and checked on an emulator and a real phone; step 2 (whole-screen control) is specified separately.

## State

- Design only, no production code. Verified by reading the files: the specification, the blueprint and the proposed ADR 0028 exist under `documentation/`, and the agreement is recorded as CHG-0767 in `documentation/changelog/0.2.10-Pre-Alpha.md` with a section at the top of `documentation/work-in-progress.md`.
- The documents were written once earlier in the session and found missing from disk at hand-off time (another checkout change removed them while the changelog entry stayed); they were rewritten from the same text this turn.
- Assumed, not checked in code: `Sessions.add` takes an anonymous sink, so a frame to one chosen device needs the device's identity added; a `PhoneCall` frame has not been tried over the relay or the direct path.
- Not decided by the owner (drafts in the specification): the step 1 tool list, consent switches on the phone, per-use approval, the 30 second limit, the several-phones rule.

## Decisions

- Agents call Outlore's own `phone_*` tools in the host's MCP tool server; the host sends each call to the paired phone over the existing P2P and relay link and the app executes it (owner, 2026-11-26; ADR 0028, proposed).
- Two steps: the app's own capabilities first, then control of the whole screen through an accessibility service in the APK (owner, 2026-11-26).
- No server on the phone, no ADB, no tunnel, no external MCP endpoint: reasons in ADR 0028.

## Next

1. The owner reviews the specification, blueprint and ADR 0028 and corrects the drafts; accept the ADR and update `documentation/architecture.md` to match.
2. Build step 1 following the blueprint: wire schemas in `packages/contracts`, `Sessions` targeting, `PhoneLink` and the tool definitions in the service, the executor, device seam and consent card in `apps/app`. Check each Expo API against the installed SDK's docs first.
3. Check on an Android emulator against a disposable host, then on the real phone: foreground-service need, several phones, permission prompts.
4. Specify step 2 (accessibility service in a Kotlin module like `apps/app/modules/outlore-installer`) with its own record.

## Open questions

- Which phone answers when several are paired (owner).
- Whether step 1 needs a foreground service to stay connected (a real-phone measurement).
- Whether `PhoneCall` reaches one device on both the relay and direct paths (a test).

## Sources

- `documentation/capabilities/phone-control/specifications.md`
- `documentation/capabilities/phone-control/blueprint.md`
- `documentation/architecture-decision-record/0028-phone-tools-served-by-the-paired-app-over-the-existing-channel.md`
- `documentation/architecture-decision-record/0021-computer-use-in-the-host-behind-computer-tools.md`, `0026-direct-webrtc-channels-with-werift-and-relay-fallback.md`
- `documentation/changelog/0.2.10-Pre-Alpha.md` (CHG-0767), `documentation/work-in-progress.md`
- `packages/service/src/core/sessions.ts`, `packages/contracts/src/frames.ts`, `packages/service/src/work/threadTools.ts`
