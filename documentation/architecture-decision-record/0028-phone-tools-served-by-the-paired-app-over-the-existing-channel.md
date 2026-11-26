---
status: proposed
---

# Threads use the phone through Outlore's `phone_*` tools, which the paired app executes over the existing channel

Drafted on 2026-11-26 for the owner's review.
The owner asked for "an MCP on the APK side" to control the phone and chose, on 2026-11-26: capabilities in two steps (the app's own capabilities first, whole-screen control later), Outlore's own `phone_*` tools as the agents' interface, and no extra network path beyond the paired P2P and relay link.
Not built.
The behavior is in the [phone control specification](../capabilities/phone-control/specifications.md) and the design in its [blueprint](../capabilities/phone-control/blueprint.md).

## Decision

- **Agents see MCP, the phone speaks the paired channel.**
  Threads reach the phone through `phone_*` tools in Outlore's own MCP tool server, defined once in the thread tool catalogue like `computer_*` ([0005](0005-thread-tools-over-mcp.md), [0021](0021-computer-use-in-the-host-behind-computer-tools.md)).
  The host does not talk MCP to the phone: it sends the call to the phone over the paired link (direct WebRTC, relay as fallback, [0026](0026-direct-webrtc-channels-with-werift-and-relay-fallback.md)), and the phone app executes it and answers.
  The phone runs no server, opens no port, and no tunnel or ADB connection is needed.
- **The link becomes two-way for calls.**
  Today a device asks and the host answers or broadcasts.
  Two additions: a `PhoneCall` server frame (host to one device) and `AnswerPhoneCall` and `SetPhoneTools` requests (device to host).
  A frame the older clients do not know is ignored, and an optional field stays compatible (`packages/contracts/src/frames.ts`).
- **The phone consents, not the host.**
  The phone's own settings hold a switch per capability group, all off by default, changeable only on the phone.
  A call to a group that is off fails at the phone with a plain refusal.
  Android's own permission prompt is the second gate; the host's per-use approval ([action-approval](../capabilities/action-approval/specifications.md)) is the third.
- **Two steps of capability.**
  Step 1 (the app's own capabilities, standard Android permissions, Expo modules): information, location, clipboard, open a link or an app, notification.
  Step 2 (whole-screen control: read the screen, screenshot, tap, type, swipe, global buttons): an Android `AccessibilityService` in a Kotlin Expo module of the APK, enabled by the owner in Android settings.
  Step 2 gets its own record when it is specified, because it is native code and a broad authority.
- **Only a connected phone.**
  A call fails at once with "No phone connected" when no paired phone with the group on is connected.
  Step 1 needs the app to be running and connected; keeping it alive in the background is a later decision.

## Why this reading

- **Harness access forces the host-side tool.** Outlore starts each harness with only its own tool server ([0021](0021-computer-use-in-the-host-behind-computer-tools.md)), so the agent-facing layer must be Outlore's MCP server; the phone's part can then be anything.
- **The channel already exists, encrypted, through NAT.** A server on the phone would need a tunnel; the paired link is already there on mobile data and Wi-Fi alike.
- **Approvals need Outlore's own path.** The owner can answer from the phone or the host with the same attention flow.

## Considered Options

- **ADB from the host**: rejected for the product. It does not use the APK, needs USB or the same network, and does not work for an owner away from the host. It stays a developer tool.
- **An MCP HTTP server inside the APK**: rejected. The host cannot reach it behind mobile NAT without a tunnel, and every harness would still need Outlore in front for approvals.
- **An external MCP endpoint for third-party clients**: not now. It needs the unbuilt external-MCP capability and would step outside Outlore's approvals.
- **Shizuku or root**: rejected. They add a third-party prerequisite for a capability the accessibility service gives.

## Unchecked, to settle before the build

- That a `PhoneCall` frame reaches one chosen device through `Sessions`, including over the relay path and the direct path. `Sessions.add` takes an anonymous sink today, so it needs the device's identity.
- How long an Android app keeps its channel in the background, and whether step 1 needs a foreground service.
- Which phone answers when several are paired: the proposal is the one with a group on, and a refusal if two are.
- Whether Play-style restrictions on accessibility apply: the APK is sideloaded through Outlore's own updater, so not for now.
