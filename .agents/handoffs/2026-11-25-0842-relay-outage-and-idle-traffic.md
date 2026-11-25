# Handoff: Relay outage, direct path in use, and idle host traffic

Supersedes: `2026-11-25-0120-relay-outage-and-p2p.md`
Workspace: outlore, branch `mission/relay-outage-and-p2p-6f3be08b` (base `c8bc9f5d` = `origin/main`), worktree `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS/.worktrees/relay-outage-and-p2p-6f3be08b`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep the shared relay inside Cloudflare's free tier by cutting what a connected screen costs the host (the 2026-11-24 outage was the 100,000 Durable Object requests a day cap), prove the direct WebRTC path on real networks, and decide whether a GCP relay joins Cloudflare. Done looks like: the live host measured again with a page open and cheap, the direct path seen working from a phone off the home network, and the relay's request graph explained.

## State

- **Direct WebRTC path** (`CHG-0717`, `CHG-0718`, ADR 0026) is on `origin/main` (`c8bc9f5d`). Its own handoff chain ends at `2026-11-25-0120-relay-outage-and-p2p.md`.
  - A real Chromium (Electron 45) as the device against `werift` on the host connected in about 1 s over nine runs (STUN none and Cloudflare STUN), with Noise NK inside the channel (quest journal entry 15; throwaway loop in `/tmp/claude-501/direct-loop`, not in the repository).
  - On the owner's Mac, with the web page at `localhost:8081` paired, the host held a UDP socket (the data channel) and its relay connection stayed flat. Closing the page closed the socket (verified 2026-11-25 with read-only `netstat`/`ps`, outside the sandbox).
  - Not exercised: a real NAT or 5G phone, the Workshop label "connected now, direct" on screen, the deployed Worker's web build (it is still the old build until the Worker is redeployed).
- **The relay is back** (verified 2026-11-25 06:29 UTC: `HTTP/1.1 101 Switching Protocols` on `/r/probe-after-reset?role=client` of `https://outlore.dyrits.workers.dev`). What used the 100,000 requests is still unknown (needs Cloudflare dashboard → Workers & Pages → `outlore` → Metrics).
- **Idle host traffic measured** (2026-11-25, dev host, read-only counters): with a page open over the direct channel the host sent about 4.4 MB/s over UDP and about 1 MB/s on the desktop's loopback link; with the page closed about 25 KB/s; an idle link alone carries 0 bytes (throwaway test, removed). Cause found by reading the code: whole-text Draft frames on every delta, and a Changed frame per commit with no delay.
- **Fix built by the errand `6f3be08b-d2ba-4a41-acbd-be0fc38f6d72`, verified here, being landed with this handoff** (`CHG-0719`, commits `10d8a2ae` and `09c23498`; details in `2026-11-25-0800-idle-host-traffic.md`). Verified by me on the branch: typecheck 7/7, Biome 0 errors (3 old warnings), `CI=1 bun run test` 386 files passed and 6 skipped, 3,132 tests passed, 74 skipped, 0 failed; the byte loop gave Draft 39 frames and 9,474 bytes for a 6,000-character reply (2,002 frames and 6,155,152 bytes before), and 2 Changed frames for 50 commits (50 before).
- **GCP research** is in `documentation/research/gcp-relay-options-2026-11-25.md` and `documentation/research/illustrate-p2p-direct-path.html`, both still uncommitted in the main checkout (committing them there would block `git pull --ff-only` there if they were also pushed).
- **Not measured:** the effect of `CHG-0719` on the live host or on the relay's request count (the dev host still ran the old code), the phone app, and the cost of each refetch by query.

## Decisions

- Owner, 2026-11-25: build the direct path for real, no prototype (ADR 0026); fix the idle traffic ("Just do that"), then land it with `/hand-off`, commit and push to `origin/main`.
- Owner, 2026-11-25: request-reduction beyond this waits for the planned design where a companion must be tagged to answer.
- No IaC for a first GCP trial (`gcloud` plus `cloud-init`); Alchemy only if Cloudflare and GCP are managed together permanently. Skip separate TURN for now.
- `CHG-0719` is an additive wire change (`Draft.offset`), so no ADR; the two window constants (250 ms Changed, 100 ms Draft) are in `packages/service/src/core/sessions.ts`.

## Next

1. After landing, the owner pulls `main` (`git pull --ff-only` in the main checkout, which holds unrelated uncommitted files) and restarts `bun dev`; then measure the live host again: a page open for 10 s, bytes per second by frame kind and on UDP, loopback and the relay socket.
2. Read the Cloudflare Metrics graph for 2026-11-24 to see what used the requests; if it was this traffic, the next day should stay far below 100,000.
3. If refetches still dominate, give `Changed` a scope (which tables changed) and refetch only the matching queries.
4. Test the direct path from a phone on 5G or another Wi-Fi: this needs the web build deployed to the Worker (an owner decision) or a reachable dev server; check Workshop shows "connected now, direct".
5. Check Google Cloud Console → Billing → Credits (Compute Engine and external IPv4 SKUs) before any GCP trial; decide failover-only or active-active if GCP and Cloudflare share the work.

## Open questions

- What burned the 100,000 requests on 2026-11-24? The dashboard graph answers it.
- Are 250 ms and 100 ms the right windows for Changed and Draft?
- Default STUN `stun:stun.cloudflare.com:3478`: keep it?
- Add `react-native-webrtc` for Android later, or keep the phone app on the relay?
- Deploy the Worker with the new web build, and when?

## Sources

- `.agents/handoffs/2026-11-25-0800-idle-host-traffic.md`, `.agents/handoffs/2026-11-25-0120-relay-outage-and-p2p.md`
- `documentation/verification/2026-11-25-direct-p2p-path.md`, `documentation/architecture-decision-record/0026-direct-webrtc-channels-with-werift-and-relay-fallback.md`
- `documentation/changelog/0.2.6-Pre-Alpha.md` (`CHG-0717`, `CHG-0718`, `CHG-0719`)
- `packages/service/src/core/sessions.ts`, `packages/contracts/src/frames.ts`, `apps/app/src/foundation/client.ts`, `packages/service/test/core/idleTraffic.test.ts`
- `documentation/research/gcp-relay-options-2026-11-25.md` (uncommitted in the main checkout)
- Commits `10d8a2ae`, `09c23498` on `mission/relay-outage-and-p2p-6f3be08b`
