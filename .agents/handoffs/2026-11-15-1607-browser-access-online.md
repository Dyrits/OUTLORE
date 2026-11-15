# Handoff: browser access is online; the real pairing from another network is the open check

Supersedes: `2026-11-15-1556-browser-access-publish.md`
Workspace: ISKIOS (GitHub `Dyrits/OUTLORE`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner can open the Outlore web page online, enter the pairing code shown by their Mac's running Outlore (the host), and control it from any browser. Done means a browser on another network was seen pairing with the owner's real Mac through the deployed relay, and the owner accepted the look.

## State

- **Verified by `git` and `gh`-free commands:** the browser-access batch is committed and pushed to `main` as `8cee410` (CHG-0286). The deployment work that follows it (relay static assets, docs, this handoff) is committed in the next commit on `main`; check `git log origin/main` for its hash.
- **Verified by live requests (`curl`, a WebSocket):** `https://outlore-relay.dyrits.workers.dev/` and any deep path return the page (200, `text/html`, title Outlore); the script bundle returns 200; `/r/<room>?role=client` without an upgrade returns 426; `/r/x` returns 404; a host connection to a random room answers `ping` with `pong`. Worker version `08b135fa-b1d4-47e2-b19f-09ad5481c25e`, deployed with `wrangler deploy` to the owner's single account.
- **Verified by tests and a drive:** `bun run check`, `bun run typecheck` (seven workspaces), the full suite (1,612 passed, 18 skipped, before the relay config test was added; the relay and remote tests were rerun after: 143 passed), and a 24-check drive of a Chromium page against a host, both with a local relay and with `wrangler dev` as page and relay. Mutations of five key behaviors were each caught. See the verification record.
- **Not run:** a browser on another network or a phone pairing with the owner's real Mac through the deployed address; Chrome, Firefox, Safari; a real provider turn from a browser; an independent review of the diff; a fresh-context reproduction of the proof.
- **How the site is served:** `packages/relay/wrangler.jsonc` has `assets` (`./public`, `/r/*` to the Worker, single-page fallback); `bun run deploy` in `packages/relay` exports the web build into the ignored `public/` and runs `wrangler deploy`. An owner's own relay (deployed by the app with the bundled Worker) does not get the page.
- The page's release is `0.1.3-Prototype` (`apps/app/package.json`); the host must report the same one. The Mac's installed Iskios 0.1.3 reports none and would be refused, so the Mac must run this tree (`bun run dev`, which reports the desktop package's `0.1.3-Prototype`) or a build of a later release with both package versions bumped together.

## Decisions

- Trust (owner): the browser trusts the HTTPS site serving the build, separate from the encrypted transport (0019, CHG-0286).
- The shared relay serves the page as static assets, one build, the last deployed, not one per release (CHG-0287); the owner said "publish it online" and "deploy it".
- Pushing to `main` used `git push --no-verify` on the owner's instruction; a tag or release remains a separate approval (`0.1.4-Prototype` is still untagged, see `2026-11-15-1458-outlore-rename.md`).
- Do not write Cloudflare credentials into any file; wrangler is logged in through OAuth on the owner's Mac.

## Next

1. With the owner: on the Mac run `bun run dev` from this tree, open the Charter, turn on Allow paired devices, make a pairing code (it names `https://outlore-relay.dyrits.workers.dev`), then open that address from a browser on another network (a phone's mobile data works), paste the code, and see the quests. Record the result in the verification record and, after the owner accepts the look, add a Delivery to the changelog.
2. If a pairing fails, read the banner's wording and `documentation/verification/2026-11-15-browser-access.md`; check the Mac's Charter status says Connected and the release shown on both sides.
3. Later batches, each needing the owner's approval: a web build per release (so an updated Mac and the page can differ), a background host, remote terminals, host-side updates, phone layouts, and the two small host races in the backlog.

## Open questions

- Whether the owner wants an independent review of the browser-access diff (asked twice, unanswered).
- Whether to tag `0.1.4-Prototype` so the Mac's installed app and the page match by release without running from the source tree.

## Sources

- `documentation/changelog/0.1.4-Prototype.md` (CHG-0286, CHG-0287)
- `documentation/verification/2026-11-15-browser-access.md` and its folder
- `documentation/work-in-progress.md` ("Browser access")
- `packages/relay/wrangler.jsonc`, `packages/relay/package.json` (`site`, `deploy`), `packages/relay/test/siteConfig.test.ts`
- `documentation/architecture-decision-record/0019-browsers-use-the-relay-served-web-app.md`
- Commit `8cee410`; previous handoffs `2026-11-15-1556-browser-access-publish.md`, `2026-11-15-1458-outlore-rename.md`
