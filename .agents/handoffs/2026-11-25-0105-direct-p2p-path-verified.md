# Handoff: Direct WebRTC path verified and ready for real-NAT check

Supersedes: `2026-11-25-0059-direct-p2p-path.md`
Workspace: outlore, branch `mission/relay-outage-and-p2p-f17b60d0` (rebased onto `origin/main` `de1191d1`), worktree `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS/.worktrees/relay-outage-and-p2p-f17b60d0`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Land the verified direct WebRTC data-channel upgrade for paired devices (CHG-0717, CHG-0718, ADR 0026) on `origin/main` so paired desktop and web devices move steady-state traffic off the shared Cloudflare relay once a direct channel is up, then confirm real-network NAT traversal and the Workshop UI on the owner's devices.

## State

- **Rebased cleanly onto `origin/main` (`de1191d1`)** (verified via `git rebase origin/main`, `git merge-base --is-ancestor origin/main HEAD`, and `git log`):
  - `cb49b945`: `Add the path link and the direct channel upgrade to the channel package (CHG-0717)`
  - `1e1654bf`: `Let paired devices and hosts move their link onto a direct channel (CHG-0718)`
  - `9a3ec2a4`: `Document the direct WebRTC path, ADR 0026, and changelog entries (CHG-0717, CHG-0718)` (`CHG-0717` and `CHG-0718` verified free against `origin/main`; `0.2.6-Pre-Alpha.md` cleanly carries `CHG-0711` through `CHG-0718`)
  - `889cd465`: `Write the direct WebRTC path handoff`
- **Verification proof written** (verified via command runs on `889cd465` and recorded in `documentation/verification/2026-11-25-direct-p2p-path.md`):
  - `bun run typecheck`: passed across all 7 workspace packages (0 errors).
  - `bun run check` (Biome): exited 0 (0 errors; 3 pre-existing warnings in untouched files).
  - Direct-path & Workshop tests (`pathLink.test.ts`, `directUpgrade.test.ts`, `directPath.test.ts`, `remoteAccess.test.ts`): 4/4 files, 39/39 tests passed in 9.97 s (and shown able to fail against starting commit `de1191d1`).
  - Full test suite (`CI=1 bun run test` with space-free `TMPDIR`): 387 passed, 3 skipped (390 files); 3,170 passed, 24 skipped, 0 failed in 133.63 s.
  - Service bundle (`bun build packages/service/src/main.ts --target=node --format=esm --external node-pty`): 5.64 MB / 825 modules (+1.19 MB pure JS over `de1191d1`'s 4.45 MB / 809 modules, no native addons).
  - Browser bundle (`bun build packages/controller/src/browserLink.ts --target=browser --format=esm`): 0.35 MB / 296 modules, confirmed zero `werift` references.
- **Uncommitted in the main checkout (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`)** (verified via `git status`, intentionally untouched):
  - `documentation/research/illustrate-p2p-direct-path.html` (P2P flow diagram)
  - `documentation/research/gcp-relay-options-2026-11-25.md` (GCP $10/mo credit research recommending a US Always Free `e2-micro` + Standard Tier running `nodeRelay.ts` behind Caddy at ~$3.65/mo, pending SKU eligibility check)
- **Not exercised in the sandbox:**
  - Real-network NAT traversal from a phone browser on 5G or a second Wi-Fi network.
  - Visual check of Workshop → Remote access showing `"connected now, direct"` in a running desktop/web window.
  - Native Android app (`apps/app` on Hermes) intentionally stays on the relay.

## Decisions

- **`werift` (`^0.28.0`, MIT) in Node/Electron, browser `RTCPeerConnection` on web, mobile stays on relay** (ADR 0026).
- **Fresh Noise NK handshake inside the WebRTC data channel** bound to `outlore-direct/1 <room> <attempt>` so DTLS is not the end-to-end layer (ADR 0026).
- **Default public STUN `stun:stun.cloudflare.com:3478`**, no TURN server, overridable via `OUTLORE_STUN_SERVERS` and disableable via `OUTLORE_DIRECT=false` (ADR 0026).
- **Max 16 concurrent direct peers per host** (`maxDirectPeers = 16`); cross-release update links stay unframed on the relay.

## Next

1. Test a real direct connection after landing: pair a phone browser (on 5G or a second Wi-Fi) or a second desktop to the host Mac, check that Workshop → Remote access shows `"connected now, direct"`, and confirm Cloudflare Durable Object requests stay flat while sending messages.
2. Check the Cloudflare dashboard (Workers & Pages → `outlore` → Metrics → Durable Object requests) to identify what burned the 100,000/day free-tier cap on 2026-11-24.
3. Decide whether to trial the GCP `us-east1` `e2-micro` relay option from `documentation/research/gcp-relay-options-2026-11-25.md` after checking Billing → Credits SKU eligibility (and commit the two research files in the main checkout if keeping them).

## Open questions

- **Default STUN server:** confirm `stun:stun.cloudflare.com:3478` as the default (or choose another list).
- **Android mobile app WebRTC:** decide whether to add `react-native-webrtc` in a later batch or keep the mobile app on the relay.
- **Optional TURN / GCP relay:** decide after real-NAT measurements and checking whether the $10/mo GCP credit covers Compute Engine + Networking/IPv4 SKUs.

## Sources

- `documentation/verification/2026-11-25-direct-p2p-path.md`
- `documentation/architecture-decision-record/0026-direct-webrtc-channels-with-werift-and-relay-fallback.md`
- `documentation/capabilities/device-pairing/specifications.md`
- `documentation/changelog/0.2.6-Pre-Alpha.md` (`CHG-0717`, `CHG-0718`)
- `documentation/research/gcp-relay-options-2026-11-25.md` (uncommitted in main checkout)
- Commits `cb49b945` (CHG-0717), `1e1654bf` (CHG-0718), `9a3ec2a4` (docs/ADR/changelog), `889cd465` (previous handoff) on `mission/relay-outage-and-p2p-f17b60d0`
