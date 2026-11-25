# Handoff: Idle host traffic per connected screen

Workspace: outlore, branch `mission/relay-outage-and-p2p-6f3be08b` (base `c8bc9f5d`), worktree `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS/.worktrees/relay-outage-and-p2p-6f3be08b`

To resume: read this whole file first and check its claims against the Sources. The previous handoff on the relay outage and the direct path is `2026-11-25-0120-relay-outage-and-p2p.md`.

## Goal

A page paired over the direct channel made the host send about 4.4 MB/s over UDP (and about 1 MB/s on the desktop's loopback link) while idle. Over the Cloudflare relay every frame counts toward the free plan's 100,000 Durable Object requests a day, so this was a strong candidate for the 2026-11-24 outage. Cut it without changing what the owner sees.

## State

- Built and tested on the branch (CHG-0719). Nothing pushed.
- Loop first: `packages/service/test/core/idleTraffic.test.ts` counts the bytes the service sends to a connected screen, by frame kind, through the real thread path with the fake harness (new script line `write <characters> <delta> [pause millis]`). It went red on the old code and is green now.
- Measured (6,000-character reply written in 3-character deltas, 1 ms apart):
  - Before: Draft 2,002 frames, 6,155,152 bytes (about 1,000 times the reply). After: 40 frames, about 9,600 bytes.
  - 50 commits in a burst: Changed 50 frames before, 2 after.
- What changed:
  - `packages/service/src/core/sessions.ts`: Changed frames in a 250 ms window (first at once, a burst is one more frame carrying the latest sequence); Draft frames in a 100 ms window per thread, carrying only the new text with `offset`; the whole text for a screen that joins (`add`) and after 50 appended frames; a draft's end is sent at once and drops what waited.
  - `packages/contracts/src/frames.ts`: `Draft` gains optional `offset` (absent = whole text) and `draftAfter(held, frame)`.
  - `apps/app/src/foundation/client.ts`: `ServiceClient` keeps each thread's reply per connection (`draftOf`), applies frames with `draftAfter`, drops a gapped frame, and on a dropped link clears and tells the listeners; `useDraft` starts from `draftOf`.
  - Tests: `idleTraffic.test.ts`, `sessions.test.ts` (Effect `TestClock`), `apps/app/test/foundation/client.test.ts`.
- Wire compatibility: additive field. A screen of another release (the update link) ignores `offset` and shows the newest piece until the next whole text; a host refuses a pairing from another release, and a device refuses a host of another release on resume. No ADR: the change is reversible.

## Decisions

- Both fixes sit in the service's `Sessions`, so the loopback socket, the relay and the direct channel all gain, and no client has to refetch less to benefit.
- Append frames plus periodic whole text rather than only coalescing whole-text frames: coalescing alone leaves the cost growing with the square of the reply.
- Not done: refetching only the queries a change affects. A `Changed` frame still makes every mounted query refetch its whole result, now at most four times a second.

## Next

1. Verify, then land (fetch `origin/main`, check `git merge-base --is-ancestor origin/main HEAD`, rerun typecheck and Biome on the tip, owner approval for the push).
2. Measure the live host again: page open for 10 s, bytes per second by frame kind, loopback and UDP.
3. If the refetches still dominate (about four a second times the mounted queries), give `Changed` a scope (which tables changed) and refetch only the matching queries.

## Open questions

- Is 250 ms (Changed) and 100 ms (Draft) the right trade between promptness and traffic? Both are constants in `sessions.ts`.
- Does the effect on the Cloudflare request count show up? Not measured; the relay was down for the day.

## Sources

- `packages/service/src/core/sessions.ts`, `packages/contracts/src/frames.ts`, `apps/app/src/foundation/client.ts`
- `packages/service/test/core/idleTraffic.test.ts`, `packages/service/test/core/sessions.test.ts`
- `documentation/changelog/0.2.6-Pre-Alpha.md` (CHG-0719), `documentation/architecture.md` (Keep a screen current)
