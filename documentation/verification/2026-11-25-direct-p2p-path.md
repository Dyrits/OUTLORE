# Proof: Direct WebRTC path for paired devices (CHG-0717, CHG-0718)

- **Verdict:** not proven (7 proven, 1 unproven, 1 awaiting human judgment)
- **Work:** `de1191d1..889cd465` on branch `mission/relay-outage-and-p2p-f17b60d0` (rebased onto `origin/main` `de1191d1`)
- **Agreement:** Owner authorization (2026-11-25, quest "Relay outage and P2P"), [Device pairing specifications](../capabilities/device-pairing/specifications.md#behavior), [ADR 0026](../architecture-decision-record/0026-direct-webrtc-channels-with-werift-and-relay-fallback.md), and commits `cb49b945` (CHG-0717) and `1e1654bf` (CHG-0718)
- **Environment:** macOS 26.6.2 (Apple silicon), Bun 1.4.4, Node v26.13.1, Vitest 5.1.1 via `ELECTRON_RUN_AS_NODE=1 electron`, `TMPDIR=/var/folders/j1/jv_1mmzs4w94x4fbzz1c8hhh0000gn/T/`, run inside Outlore thread sandbox
- **Date:** 2026-11-25

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | `PathLink` sequences frames across relay and direct paths, preserves order, drops duplicates, replays unacked frames on drop, and falls back after 3 missed 10 s beats | CHG-0717, Device pairing specs | proven |
| C2 | Direct upgrade exchanges one encrypted offer and answer through the relay, honors configured STUN servers, caps host peers at 16, backs off exponentially (30 s to 15 min), and rejects a wrong-host Noise handshake | CHG-0717, ADR 0026 | proven |
| C3 | End-to-end with a real local relay, full host service, and `werift` on both sides, steady-state traffic moves onto the direct channel and the relay forwards zero frames afterward | CHG-0718, Device pairing specs | proven |
| C4 | A fresh Noise NK handshake (two 48-byte messages) runs inside the data channel and no plaintext crosses it | CHG-0718, ADR 0026 | proven |
| C5 | When the direct channel closes or never opens, the session stays alive over the relay (re-upgrading after a drop), and cross-release update links stay unframed on the relay | CHG-0718, Device pairing specs | proven |
| C6 | Workshop Remote access labels a connected direct device as `"connected now, direct"` (and never direct when disconnected) | CHG-0718, `apps/app/src/settings/remoteAccess.ts` | proven |
| C7 | Host service bundles cleanly with `werift` as pure JS (no native addon), and the browser/mobile link bundle excludes `werift` | ADR 0026, `packages/service/src/remote/directPeers.ts`, `apps/app/src/foundation/browser/page.ts` | proven |
| C8 | Real-network NAT traversal connects directly from a phone browser or second network across real routers | Device pairing acceptance, owner request | unproven |
| C9 | Workshop `"connected now, direct"` label renders cleanly in the running desktop and web app | CHG-0718, `apps/app/src/settings/remoteAccess.ts` | awaiting human judgment |

## Evidence

### C1: `PathLink` sequenced framing, ordering, replay, and silent-beat fallback

- **Check:** `bunx vitest run packages/channel/test/pathLink.test.ts`
- **Shown able to fail:** Before-and-after on starting commit `de1191d1`: `packages/channel/test/pathLink.test.ts` and `packages/channel/src/pathLink.ts` do not exist (`vitest` exits 1 with `No test files found`).
- **Result:** Exit 0 — 14/14 tests passed (`pathLink.test.ts`).
- **Reproduced:** Re-run in a clean shell from `.worktrees/relay-outage-and-p2p-f17b60d0`; matched (14/14 passed).

### C2: `directUpgrade` signaling, STUN pass-through, backoff, refusal, and Noise binding

- **Check:** `bunx vitest run packages/channel/test/directUpgrade.test.ts`
- **Shown able to fail:** Before-and-after on starting commit `de1191d1`: `packages/channel/test/directUpgrade.test.ts` and `packages/channel/src/directUpgrade.ts` do not exist (`vitest` exits 1 with `No test files found`).
- **Result:** Exit 0 — 10/10 Effect `TestClock` tests passed (`directUpgrade.test.ts`).
- **Reproduced:** Re-run in a clean shell; matched (10/10 passed).

### C3, C4, C5: End-to-end local relay + full host service + `werift` peers (zero relay frames, Noise NK inside channel, fallback/re-upgrade, never-opens, cross-release unframed)

- **Check:** `bunx vitest run packages/service/test/remote/directPath.test.ts`
- **Shown able to fail:** Before-and-after on starting commit `de1191d1`: `packages/service/test/remote/directPath.test.ts` and `packages/service/src/remote/directPeers.ts` do not exist (`vitest` exits 1 with `No test files found`).
- **Result:** Exit 0 — 5/5 live tests passed in 8.51 s:
  - `moves the link onto a direct channel and sends nothing more through the relay` (20 `ReadHostName` calls with `framesForwarded()` unchanged)
  - `runs the Noise handshake inside the channel and writes nothing readable on it` (first sent and received messages are 48 bytes; raw bytes contain neither `ReadHostName` nor `Host Mac`)
  - `falls back to the relay without losing the link when the channel closes, and upgrades again` (`link.paths` equals `["direct", "relay", "direct"]`)
  - `stays on the relay when the direct channel never opens` (`isDirect === false`, `link.closed === null`, traffic continues over relay)
  - `keeps a link to a host of another release on the relay, unframed, as the update link needs` (`peers` length 0 on both sides, `link.paths` empty)
- **Reproduced:** Re-run in a clean shell; matched (5/5 passed).

### C6: Workshop `"connected now, direct"` wording

- **Check:** `bunx vitest run apps/app/test/settings/remoteAccess.test.ts`
- **Shown able to fail:** Before-and-after on starting commit `de1191d1`: running `deviceLineOf({ id: "d", isConnected: true, isDirect: true, kind: "desktop", lastActiveAt: null, name: "Laptop", pairedAt: 0 }, 1_000_000)` printed `"Desktop · connected now"` instead of `"Desktop · connected now, direct"`.
- **Result:** Exit 0 — 10/10 tests passed (`remoteAccess.test.ts`), including `isConnected: true, isDirect: true` → `"Desktop · connected now, direct"` and `isConnected: false, isDirect: true` → `"Desktop · never connected"`.
- **Reproduced:** Re-run in a clean shell; matched (10/10 passed).

### C7: Service bundle with `werift` and browser bundle excluding `werift`

- **Check:**
  1. `bun build packages/service/src/main.ts --target=node --format=esm --external node-pty --outfile "$TMPDIR/outlore-service-bundle-check.mjs"`
  2. `bun build packages/controller/src/browserLink.ts --target=browser --format=esm --outfile "$TMPDIR/outlore-browser-link-check.mjs" && ! grep -q werift "$TMPDIR/outlore-browser-link-check.mjs"`
- **Shown able to fail:** Before-and-after bundle size comparison against `de1191d1` (4.45 MB / 809 modules vs. 5.64 MB / 825 modules on `889cd465`, +1.19 MB pure JS for `werift` + channel code).
- **Result:** Both commands exited 0; service bundled 825 modules (5.64 MB) in 159 ms with no native addons; browser bundle (296 modules, 0.35 MB) printed `NO_WERIFT_IN_BROWSER`.
- **Reproduced:** Re-run in a clean shell; matched.

## Regressions

| Check | Command | Starting commit (`de1191d1`) | End state (`889cd465`) |
| --- | --- | --- | --- |
| Workspace typecheck (7 packages) | `bun run typecheck` | not run | pass (0 errors) |
| Biome lint & format | `bun run check` | not run | pass (0 errors; 3 pre-existing warnings in untouched files) |
| Full test suite | `CI=1 bun run test` | not run | pass (387 passed, 3 skipped files; 3,170 passed, 24 skipped, 0 failed in 133.63 s) |
| Direct-path & Workshop tests | `bunx vitest run packages/channel/test/pathLink.test.ts packages/channel/test/directUpgrade.test.ts packages/service/test/remote/directPath.test.ts apps/app/test/settings/remoteAccess.test.ts` | fail (3 new test files absent; `deviceLineOf` omits `, direct`) | pass (4/4 files, 39/39 tests in 9.97 s) |

## Not proven

- **C8 (Real-network NAT traversal) — unproven:** The sandbox has no access to a second network or a real phone browser across NAT. Only loopback in-process WebRTC (`werift` ↔ `werift` through a real local relay and full host service) was exercised. **What would prove it:** Pair a phone browser over 5G or a second Wi-Fi network to the owner's Mac running this release, confirm Workshop shows `"connected now, direct"`, and confirm relay Durable Object requests stay flat while sending messages.
- **C9 (Workshop visual rendering) — awaiting human judgment:** `remoteAccess.test.ts` verifies the string `"Desktop · connected now, direct"`, but no desktop or browser window was opened in the sandbox. **What would prove it:** Open Workshop → Remote access while a paired desktop or browser device is connected directly and inspect the row.
- **Scope note (not a failure):** The native Android mobile app (`apps/app` on Hermes) intentionally stays on the relay per ADR 0026 because Hermes has no built-in `RTCPeerConnection`.

## Reproduce

```sh
bun run typecheck
bun run check
bunx vitest run \
  packages/channel/test/pathLink.test.ts \
  packages/channel/test/directUpgrade.test.ts \
  packages/service/test/remote/directPath.test.ts \
  apps/app/test/settings/remoteAccess.test.ts
CI=1 bun run test
bun build packages/service/src/main.ts --target=node --format=esm --external node-pty --outfile "$TMPDIR/outlore-service-bundle-check.mjs" && rm -f "$TMPDIR/outlore-service-bundle-check.mjs"
bun build packages/controller/src/browserLink.ts --target=browser --format=esm --outfile "$TMPDIR/outlore-browser-link-check.mjs" && ! grep -q werift "$TMPDIR/outlore-browser-link-check.mjs" && rm -f "$TMPDIR/outlore-browser-link-check.mjs"
```

## New files

- `documentation/verification/2026-11-25-direct-p2p-path.md` (this proof; to be committed with the handoff per the owner's instruction)
