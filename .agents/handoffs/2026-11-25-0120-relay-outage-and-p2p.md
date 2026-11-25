# Handoff: Relay outage, GCP options, and verified direct WebRTC path

Supersedes: `2026-11-25-0105-direct-p2p-path-verified.md`
Workspace: outlore, branch `mission/relay-outage-and-p2p-f17b60d0` (rebased onto `origin/main` `de1191d1`), worktree `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS/.worktrees/relay-outage-and-p2p-f17b60d0`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Land the verified direct WebRTC data-channel upgrade for paired devices (`CHG-0717`, `CHG-0718`, ADR 0026) on `origin/main`, resolve the shared Cloudflare Durable Objects free-tier outage, and decide whether to add a GCP `nodeRelay.ts` relay alongside Cloudflare with mutual fallback.

## State

- **Direct WebRTC path implemented, rebased onto `origin/main` (`de1191d1`), verified, and committed on `mission/relay-outage-and-p2p-f17b60d0`** (verified via `git log`, `bun run typecheck`, `bun run check`, `CI=1 bun run test`, and `bun build`):
  - `cb49b945`: `Add the path link and the direct channel upgrade to the channel package (CHG-0717)`
  - `1e1654bf`: `Let paired devices and hosts move their link onto a direct channel (CHG-0718)`
  - `9a3ec2a4`: `Document the direct WebRTC path, ADR 0026, and changelog entries (CHG-0717, CHG-0718)` (`CHG-0717` and `CHG-0718` verified free on `origin/main`)
  - `889cd465`: `Write the direct WebRTC path handoff`
  - `3110a349`: `Verify the direct WebRTC path and update the handoff` (`documentation/verification/2026-11-25-direct-p2p-path.md`, 7/9 claims proven, C8 real-NAT unproven, C9 Workshop visual check awaiting human judgment)
  - All gates green on the rebased tip: `bun run typecheck` (7/7 packages), `bun run check` (0 errors), `CI=1 bun run test` (387 passed, 3 skipped files; 3,170 passed, 24 skipped, 0 failed in 133.63 s), service bundle 5.64 MB pure JS (+1.19 MB over `de1191d1`), browser link bundle 0.35 MB with zero `werift`.
- **Cloudflare relay outage still active past 00:00 UTC** (verified via live `curl --http1.1` and `wrangler tail outlore` at 2026-11-25 00:18:45 UTC):
  - `/r/probe-reset-check?role=client` still returns HTTP 500 `error code: 1101` with `Error: Exceeded allowed volume of requests in Durable Objects free tier` at `src/worker.ts:123:60`.
  - Zero other requests arrived during the tail window (no active request flood); likely post-00:00 UTC reset propagation lag or another free-tier counter in Cloudflare Dashboard → Workers & Pages → `outlore` → Metrics.
  - Static web assets (`/`) remain up (do not touch Durable Objects).
- **GCP $10/mo credit research completed** (verified via file in main checkout `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`, uncommitted):
  - `documentation/research/gcp-relay-options-2026-11-25.md`: recommends one Always Free `us-east1` `e2-micro` VM on Standard Network Service Tier running `packages/relay/src/nodeRelay.ts` behind Caddy (~$3.65/mo for IPv4, 200 GiB/mo free egress; keep static web app on Cloudflare; skip Cloud Run and separate `coturn` TURN; add `vnstat` local 180 GiB cutoff + $8/mo budget kill-switch because GCP has no native hard spend cap).
  - `documentation/research/illustrate-p2p-direct-path.html`: uncommitted visual diagram of the direct P2P flow.
- **Not exercised in the sandbox:**
  - Real-network NAT traversal from a phone browser on 5G or a second Wi-Fi network.
  - Live visual check of Workshop → Remote access showing `"connected now, direct"`.
  - Native Android app (`apps/app` on Hermes) intentionally stays on the relay.

## Decisions

- **`werift` (`^0.28.0`, MIT) in Node/Electron, browser `RTCPeerConnection` on web, mobile stays on relay** (ADR 0026).
- **Fresh Noise NK handshake inside the WebRTC data channel** bound to `outlore-direct/1 <room> <attempt>` so DTLS is not the end-to-end layer (ADR 0026).
- **Default public STUN `stun:stun.cloudflare.com:3478`**, no TURN server, overridable via `OUTLORE_STUN_SERVERS` and disableable via `OUTLORE_DIRECT=false` (ADR 0026).
- **Max 16 concurrent direct peers per host** (`maxDirectPeers = 16`); cross-release update links stay unframed on the relay.
- **No IaC needed for the initial GCP trial** (2026-11-25 discussion): keep `wrangler.jsonc` for Cloudflare and use `gcloud` + `cloud-init` for a 7-day `e2-micro` trial; revisit Alchemy (`alchemy.run`) only if managing Cloudflare + GCP + DNS + billing kill-switch together permanently.

## Next

1. Push `mission/relay-outage-and-p2p-f17b60d0` to `origin/main` (after fetching fresh `origin/main`, verifying `git merge-base --is-ancestor origin/main HEAD`, and getting owner approval for `git push --no-verify origin mission/relay-outage-and-p2p-f17b60d0:main`).
2. Check whether the Cloudflare relay recovered after reset propagation, and inspect Cloudflare Dashboard → Workers & Pages → `outlore` → Metrics (Durable Object requests & duration) to see what burned 100k requests on 2026-11-24.
3. After building/running the landed P2P code, test a real direct connection from a phone browser (5G or separate Wi-Fi) or second desktop to the host Mac, confirm Workshop shows `"connected now, direct"`, and confirm relay requests stay flat.
4. Check Google Cloud Console → Billing → Credits to verify whether the $10/mo credit covers Compute Engine + Networking/IPv4 SKUs; if yes, decide whether to trial the `us-east1` `e2-micro` relay and whether to add multi-relay failover (`[primary, backup]` between GCP and Cloudflare).

## Open questions

- **Cloudflare 100k/day cause:** what burned the Durable Objects daily request quota on 2026-11-24 (requires the Cloudflare dashboard Metrics graph).
- **Default STUN server:** confirm `stun:stun.cloudflare.com:3478` (or choose another list).
- **Android mobile app WebRTC:** decide whether to add `react-native-webrtc` in a later batch or keep mobile on the relay.
- **GCP credit SKU eligibility & multi-relay failover:** confirm Compute + IPv4 eligibility in GCP Billing → Credits, and decide between failover-only vs. active-active if GCP and Cloudflare co-exist.

## Sources

- `documentation/verification/2026-11-25-direct-p2p-path.md`
- `documentation/architecture-decision-record/0026-direct-webrtc-channels-with-werift-and-relay-fallback.md`
- `documentation/capabilities/device-pairing/specifications.md`
- `documentation/changelog/0.2.6-Pre-Alpha.md` (`CHG-0717`, `CHG-0718`)
- `documentation/research/gcp-relay-options-2026-11-25.md` (uncommitted in main checkout)
- `documentation/research/illustrate-p2p-direct-path.html` (uncommitted in main checkout)
- Commits `cb49b945`, `1e1654bf`, `9a3ec2a4`, `889cd465`, `3110a349` on `mission/relay-outage-and-p2p-f17b60d0`
