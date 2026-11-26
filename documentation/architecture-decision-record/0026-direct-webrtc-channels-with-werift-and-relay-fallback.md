---
status: accepted
---

# Paired devices upgrade to direct WebRTC data channels with werift and relay fallback

Authorized by the owner on 2026-11-25 in the quest "Relay outage and P2P", after the shared Cloudflare relay hit the free-tier Durable Objects daily request cap (100,000 requests/day) on 2026-11-24. Amends [0016](0016-shared-relay-on-the-owners-free-cloudflare-account.md) for the transport of paired-device sessions once established.

## Why

- **Relieving the shared relay.** Under [0016](0016-shared-relay-on-the-owners-free-cloudflare-account.md), every frame between a host and a paired device crossed the shared Cloudflare Worker's Durable Object. Moving steady-state traffic off the relay reduces Durable Object requests and active duration, and lowers round-trip latency (60–75 ms direct against 95–110 ms through the relay in the 2026-11-12 lab).
- **Keeping pairing zero-setup and universal.** Direct hole punching does not succeed on every network (symmetric NATs fail; published studies put success around 70%, and the 2026-11-12 lab had 3 successes against 2 failures across 3 setups). The relay must remain the universal carrier for pairing, signaling, and automatic fallback—with no TURN server cost.
- **No native WebRTC addon in the host.** The host service runs in Node (inside Electron's utility process, and standalone under [0018](0018-host-service-runs-on-its-own.md)), which has no built-in `RTCPeerConnection`. Native C++ WebRTC bindings (`node-datachannel`, `wrtc`) add per-platform prebuilds and packaging risk to the Electron desktop release and headless host. `werift` (`^0.28.0`) is pure TypeScript under the MIT license, has no native modules, and passed the 2026-11-12 lab across IPv6 and IPv4 NAT.
- **End-to-end encryption stays in Noise NK.** WebRTC's DTLS terminates at the WebRTC stack and is not tied to Outlore's pairing keys. Running Outlore's own Noise NK handshake inside the data channel keeps the same trust model across both paths.

## Decision

- **Relay for signaling and fallback, direct channel for traffic.** After a paired device and its host establish their Noise NK session over the relay (and agree on the same release), they switch the session to sequenced framing (`PathLink` in `packages/channel/src/pathLink.ts`) and attempt a direct WebRTC data channel (`packages/channel/src/directUpgrade.ts`).
- **Encrypted, non-trickle signaling.** The device gathers ICE candidates up to `gatherMillis` (4 s), sends one `DirectOffer` inside the relay's Noise NK session, and receives one `DirectAnswer` or `DirectRefusal` (`busy` or `off`). The relay forwards ciphertext only and sees two small control frames per attempt, regardless of candidate count.
- **Second Noise NK handshake inside the data channel.** Once the data channel opens, both peers run a fresh Noise NK handshake inside it with prologue `outlore-direct/1 <room> <attempt>`, binding the channel to the room and the random attempt identifier exchanged over the encrypted relay session. No plaintext crosses the data channel.
- **Ordered delivery, replay, and fallback.** `PathLink` sequences application frames (`DATA`), acknowledges progress (`ACK`), replays unacknowledged frames over the relay if the direct channel closes or misses 3 heartbeats (10 s each), and drops duplicates. Failed upgrade attempts back off exponentially from 30 s up to 15 min; a dropped direct channel retries after 5 s. A host caps concurrent direct peers at 16 (`maxDirectPeers`).
- **Cross-release compatibility.** Only same-release peers enable framing and attempt direct upgrades; cross-release update links (`acceptOtherRelease`) stay unframed on the relay.
- **WebRTC runtimes.**
  - Host service and desktop controller: `werift` (`^0.28.0`, MIT, lazy-loaded on the first direct channel, with `iceUseDefaultStunServer: false` so werift's built-in STUN server is never queried).
  - Web app: the browser's built-in `RTCPeerConnection`.
  - Mobile app (Android/Hermes): `react-native-webrtc` (MIT, over Jitsi's build of WebRTC M155, `org.jitsi:webrtc`; data channels only; no Expo module offers WebRTC; amended 2026-11-26, CHG-0754). Hermes has no `RTCPeerConnection`, so the app loads the library's class on the first try and hands it to the same adapter as a browser. A build without the native module (Expo Go) stays on the relay. It adds about 12.5 MB of native code to the arm64 APK and one R8 rule (`apps/app/plugins/withWebRtcRules.js`). The library's manifest also declares a `MediaProjectionService` the app never starts; it adds no permission.
- **Public STUN only, no TURN.** Default STUN server is `stun:stun.cloudflare.com:3478`—chosen because the shared relay already runs on Cloudflare, so no additional provider learns the owner's IP address (to confirm with the owner). Configurable via `OUTLORE_STUN_SERVERS` (comma-separated `stun:` URIs) and disableable via `OUTLORE_DIRECT=false`.

## Consequences

- Once a direct channel is up, the relay forwards zero application frames for that session; the Workshop shows the device as `connected now, direct`.
- Packaging for Electron and a future standalone host adds no native C++ binaries or platform-specific build steps.
- Sessions behind symmetric NATs, or on a phone build without the native module, continue working transparently over the relay, with no lost state on fallback.
- Real-network NAT traversal from a phone or separate network could not be exercised in the sandbox; only in-process loopback WebRTC (real `werift` peers + real local relay + full host service) and Effect `TestClock` timer tests are verified so far.
