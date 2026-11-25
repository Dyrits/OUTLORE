# Proof: Idle host traffic per connected screen (CHG-0719)

- **Verdict:** partly proven (the byte loop is proven on the release tip; the live host with a page connected is unmeasured and needs the owner)
- **Work:** `10d8a2ae` and `09c23498` (CHG-0719), checked on `a8416f70` (Release 0.2.6-Pre-Alpha)
- **Date:** 2026-11-25
- **Environment:** macOS, Vitest 5.1.1 through `bunx vitest` inside the thread sandbox; live counters read with `nettop`, `lsof` and `ps` outside the sandbox, read-only.

## Claims

| # | Claim | Verdict |
| --- | --- | --- |
| C1 | A 6,000-character reply written in 3-character deltas costs a small multiple of its length, not about 1,000 times | proven |
| C2 | A burst of 50 commits sends 2 `Changed` frames, not 50 | proven |
| C3 | The installed 0.2.6 app carries the fix | proven (the bundle holds `draftAfter`) |
| C4 | With a page paired over the direct channel the host no longer sends megabytes a second | **not measured** |
| C5 | The relay's request count stays far below 100,000 a day | **not measured** (Cloudflare dashboard, owner) |

## Evidence

### C1 and C2: the byte loop on the release tip

- **Check:** `CI=1 bunx vitest run packages/service/test/core/idleTraffic.test.ts packages/service/test/core/sessions.test.ts apps/app/test/foundation/client.test.ts`
- **Result:** 3 files, 19 tests passed.
- **Numbers:** 6,000 characters in 3-character deltas: `Draft` 41 frames and 9,653 bytes (before the fix: 2,002 frames and 6,155,152 bytes, from the handoff). 50 commits in a burst: 2 `Changed` frames (before: 50).
- **Shown able to fail:** the handoff records the test red on the old code; not re-run here.

### C3 and the live host without a page

The installed `/Applications/Outlore.app` is 0.2.6-Pre-Alpha, up 27 minutes at the time of reading, with the desktop window open and four agents working (so not idle).

| Link | Reading (three 5-second samples) |
| --- | --- |
| UDP (direct channel) | No UDP socket: no page was connected, so the direct path was not exercised |
| Relay socket (TCP to Cloudflare) | 7,879 bytes in and 4,263 out since start; the same in all three samples: flat |
| Loopback to the desktop window | 4.9, 4.3 and 4.0 MB per 5 s sample (about 0.8 to 1 MB/s) out; 1.44 GB out since start (about 0.9 MB/s average) |

What this shows: with the fix, an idle host holding the relay costs nothing on the relay. The window's loopback link still runs near 1 MB/s while agents work, the same figure as before the fix. The fix cut the `Draft` and `Changed` frames, so the remainder is most likely the refetches a `Changed` frame triggers (next section); this was not separated by frame kind on the live host, because the packaged app has no frame counter.

### Why the loopback is still heavy: what each refetch returns

Throwaway test (deleted), a fresh service with 30 quests each holding a 2,000-character reply, every query encoded as the wire does:

| Query | Bytes | Grows with | App call sites |
| --- | --- | --- | --- |
| `ReadChronicle` | 18,091 (1,810 with 3 quests) | quests | 3 |
| `ListConnectors` | 7,277 | connectors | 2 |
| `ReadAccountBudgets` | 4,738 | accounts | 5 |
| `ReadUsage` (30 days) | 2,843 | days with use | 1 |
| `ReadMission` (one thread) | 2,583 | messages | 4 |
| `ReadSettings` | 780 | settings | 12 |
| `ReadThreadPanel` | 779 | nothing | 4 |
| `ReadThreadTree`, `ReadBudget`, `ReadRemoteAccess`, `ReadVault`, others | 12 to 386 | | |

`ListSkills`, `ListIntel` and `ReadConnectorChoices` failed in the fixture (arguments guessed); `ReadRitual` and `BrowseFolders` were not sized.

The client sends one request per call site per `Changed` frame (`useServiceQuery`; `ServiceClient.request` shares nothing), so the same `ReadSettings` goes out up to 12 times. All call sites mounted at once would cost about 120 KB per `Changed` frame; a real window mounts a subset. At the cap of four frames a second that is up to about 0.5 MB/s, the same order as the 0.9 MB/s seen live. This is an estimate from code and fixture sizes, not a live count.

## Assessment: should `Changed` get a scope?

`Changed` carries only a sequence. About 40% of the full-window cost is queries a message commit never changes (`ReadSettings`, `ReadAccountBudgets`, `ListConnectors`, `ReadUsage`); about 45% is `ReadChronicle`, which does change with commits. So a table scope helps, but less than expected, and it needs every writer (about 25 publish sites) to name what it changed, with a stale screen as the cost of a missed name.

Recommendation: do the cheaper step first, no wire change. Make `ServiceClient` share one request per identical query (same request, same moment) between call sites, which would cut roughly two thirds of the refetch bytes (12 `ReadSettings` become 1, 3 `ReadChronicle` become 1). Measure again. Build a scope only if the rest still matters; a scope also cannot shrink `ReadChronicle`, which needs its own change (return only what is new).

## For the owner: what only you can do

**A. Measure the live host with a page connected (10 minutes, nothing to install).**
1. Quit Outlore, reopen it from `/Applications` (it is 0.2.6, with the fix), and leave the agents idle if you can.
2. Pair a browser or phone page over the direct channel, as on 2026-11-25, and leave it open and untouched.
3. In a terminal, find the host: `ps -axo pid,command | grep "Outlore Helper.*node.mojom.NodeService"` (the first number is the pid).
4. Sample the pid for 10 seconds: `nettop -x -P -p <pid> -L 3 -s 5 -J bytes_in,bytes_out`, and the sockets: `nettop -x -m tcp -p <pid> -L 3 -s 5 -J bytes_in,bytes_out` and `lsof -nP -p <pid> -iUDP`.
5. Report: bytes out per second on the UDP socket, on the `127.0.0.1` link, and on the `104.x.x.x:443` relay link, once with the page open and once with it closed.
Before the fix the page open cost about 4.4 MB/s UDP and about 1 MB/s loopback.

**B. Find what used the 100,000 Durable Object requests on 2026-11-24 (the dashboard labels are from memory and may differ).**
1. Open `https://dash.cloudflare.com` and sign in with the account that owns the Worker `outlore`.
2. In the left menu open **Workers & Pages** (shown as **Compute (Workers)** in newer layouts) and click **outlore**.
3. Open the **Metrics** tab and set the time range to a custom range, 2026-11-24 00:00 to 2026-11-25 00:00 UTC.
4. Note the **Requests** graph and its total, and when it peaks. Then open **Workers & Pages**, **Durable Objects**, the `Room` namespace, **Metrics**, and note requests, WebSocket connections and the peak time.
5. Report: the total for the day, the peak hours, and whether requests rise in steps (a page reconnecting) or steadily (a page left open). Also report the same graph for 2026-11-25 to see the day after the fix; the Worker was down for part of 11-25, so read it with that in mind.
