# Handoff: relay renamed `outlore` in code, web address shown in the app; the deploy is the open step

Supersedes: `2026-11-15-1607-browser-access-online.md`
Workspace: ISKIOS (GitHub `Dyrits/OUTLORE`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The shared relay answers at `https://outlore.dyrits.workers.dev` and serves the web app there; the app shows where the web app opens. Done means the new Worker is deployed and verified, the work is on `main`, and the 0.1.4-Prototype release thread was told.

## State

- **Verified by `git` (before this commit):** `main` and `origin/main` were at `6f61706` (the release fix pushed earlier). The work below is committed locally in the next commit and **not pushed**; check `git log origin/main`.
- **Verified by tests, Biome and typecheck (seven workspaces) on this tree:** the app, remote, relay and controller tests (164 passed) after the change; the two new tests were seen failing first.
- **Done in code (CHG-0289):** `packages/relay/wrangler.jsonc` `name` is `outlore`; `defaultRelayOrigin` in `packages/service/src/remote/config.ts` is `https://outlore.dyrits.workers.dev`; new `webAppOrigin` (the same address) fills `webAppUrl`, a new field of `RemoteAccessView` (contracts) that Charter's Remote access card shows ("Web app: …", and with an own relay that the shared relay serves it) and that the pairing code's help names; the Worker bundle hash was regenerated. The Worker's default name on a user's own Cloudflare account stays `outlore-relay` (`ownRelay.ts`).
- **NOT done: the deploy.** `bun run deploy` in `packages/relay` (builds the site, then `wrangler deploy` as `outlore`) was denied by the session's permission check, so the new Worker does not exist. The old Worker `outlore-relay` (version `08b135fa`) still runs at `outlore-relay.dyrits.workers.dev` and serves the page. Until the new one is deployed, a host built from this tree names a relay that does not answer.
- **Assumed, not run:** that `wrangler deploy` under a new name creates a new Worker with a fresh Durable Object namespace (the old rooms stay on the old Worker, so devices paired through the old address pair again); that the release workflow deploys by the name in `wrangler.jsonc`, as the release thread says.
- Owner reported pairing a browser with their Mac through the page: "It works" (network not stated).

## Decisions

- Worker renamed `outlore` (owner: "I'd like that"); a workers.dev name is one DNS label, so `outlore.relay.…` is impossible (Cloudflare docs, workers.dev routing page). The account subdomain `dyrits` stays.
- The app shows the web address always, from the shared relay's address, because an own relay does not serve the page (CHG-0287/0289). Not verified: that a pairing code naming an own relay works from the shared page (the code reads as if it does; no test used a remote origin).
- The old Worker is left running, not deleted; deleting it is a separate choice for the owner.
- Pushing to `main` needs `git push --no-verify` and the owner's approval each time.

## Next

1. The owner runs `bun run deploy` in `packages/relay` (or approves the agent doing so), then check `https://outlore.dyrits.workers.dev/` (200, page), `/r/x` (404), and a host WebSocket answering `pong`, as in the verification record.
2. Push `main` (`git push --no-verify origin main`, with the owner's approval) and tell the 0.1.4-Prototype release thread: the Worker name is `outlore` in `packages/relay/wrangler.jsonc`, the default relay origin changed, and the web app address is `https://outlore.dyrits.workers.dev`.
3. Record the live checks in `documentation/verification/2026-11-15-browser-access.md` and fix the address in `AGENTS.md` and the work-in-progress note.
4. Optionally verify a code naming an own relay from the shared page, and delete the old Worker if the owner wants it gone.

## Open questions

- Whether to delete the old `outlore-relay` Worker, and when.
- An independent review of the browser-access diff (asked three times, unanswered).

## Sources

- `documentation/changelog/0.1.4-Prototype.md` (CHG-0286 to CHG-0287 and CHG-0289)
- `documentation/work-in-progress.md` ("Browser access")
- `documentation/verification/2026-11-15-browser-access.md`
- `packages/relay/wrangler.jsonc`, `packages/service/src/remote/config.ts`, `apps/app/src/settings/remoteAccess.ts`, `apps/app/src/settings/remoteAccessCard.tsx`
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- Previous handoffs: `2026-11-15-1607-browser-access-online.md`, `2026-11-15-1458-outlore-rename.md`
