# Effect in the service and relay

The local service and the relay Worker are written with Effect 4, stable since October 2026, because supervising harness processes, interruptions, timeouts, budgets, retries, and event streams is what it is built for, and typed errors catch failures at compile time. Code cherry-picked from MausBot is rewritten into Effect services rather than ported as is. The app stays plain React, where Effect adds little and React Native libraries do not expect it.

Amendment (CHG-0025): shared transport records in `packages/contracts` are Effect Schema definitions, so the app imports Schema's decode and encode functions. Components and app state still contain no Effect-style code.

Amendment (CHG-0361): Effect applies to all code that is not UI, which is the service, the relay, and the shared packages `packages/channel`, `packages/relay` and `packages/controller`, not only the two this decision names. The owner decided this on 2026-11-16 (everything server side and backend uses Effect wherever possible). Public operations of those packages return Effects with `Schema.TaggedError` failures, and timers, timeouts, keep-alives and reconnects are Effect fibers and schedules that `TestClock` drives. What stays plain, each for its own reason:

- **`channel/src/noise/*` and `Session`**: synchronous, byte-exact code that follows vendored Paseo vectors, with re-entrant callbacks and keys that must be cleared at once; an Effect runtime around each record adds cost and no supervision.
- **The `Carrier` and `SecureChannel` callback seam**: any carrier (a WebSocket through the relay today, a WebRTC data channel later) is a plain object of callbacks; Effect code wraps it, it is not written in Effect.
- **The browser-facing entry points** (`controller/src/browserLink.ts`, `@outlore/relay/browser`): the web app is plain React, so the edge turns Effects into the promises and callbacks the app expects. The link beneath them is Effect.
- **`pairedHosts.ts`** (the browser's `localStorage` keeping) and **pure helpers** (base64url, tokens, pairing codes, close-code tables): synchronous functions over values with nothing to supervise.
- **`apps/app` may use `Schema` (decode and encode) and `Match`** for shared records and tagged branching; it contains no other Effect code (`crest.tsx` keeps `Match`).

Still to do under this amendment: the relay Worker's `RoomCore` and the node relay move to Effect per call, with no fibers, scopes or timers because a hibernating Durable Object is rebuilt on every wake, and the Worker bundle ceiling is raised for it (lot 4); the `protocol.ts` parsers moving to `Schema` is deferred, because older hosts must keep reading the same wire bytes (lot 5). Until lot 4 the Worker stays plain.
