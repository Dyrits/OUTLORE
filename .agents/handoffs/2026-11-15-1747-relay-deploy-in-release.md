# Handoff: the relay is renamed `outlore`, the app shows the web address, and the release pipeline deploys both

Supersedes: `2026-11-15-1741-relay-outlore-deploy.md`
Workspace: ISKIOS (GitHub `Dyrits/OUTLORE`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The shared relay answers at `https://outlore.dyrits.workers.dev` and serves the web app there, deployed by the release pipeline from the release tag, so a browser's page and the installed app report the same release. Done means a tag was pushed, the `relay` job ran green, and a browser paired with a host through the new address.

## State

- **Verified by `git`:** the work is committed on `main` after `e95c44d` (rebased onto the other thread's CHG-0288, so this thread's records are CHG-0289 and CHG-0290); check `git log origin/main` for whether it was pushed and its hash.
- **Verified by tests, Biome and typecheck (seven workspaces):** the app, remote, relay and controller tests pass (164 before the workflow test; the five workflow tests pass); every new test was seen failing first.
- **In code:** `packages/relay/wrangler.jsonc` name `outlore`; `defaultRelayOrigin` `https://outlore.dyrits.workers.dev`; `RemoteAccessView.webAppUrl` shown by Charter's Remote access card and the pairing code's help (CHG-0289). A new `relay` job in `.github/workflows/package.yml` (CHG-0290): after the `release` job, for a pushed tag only, it stamps the tag into `apps/app/package.json`, runs `bun run site` and `wrangler@4.162.0 deploy` in `packages/relay` with the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (the owner set both in GitHub), then checks the live address with `curl`.
- **Verified by running the fragments locally:** the version stamp (on a copy of the manifest) and the live-check commands (against the old address, which serves the same code). **Not run:** the job itself (it needs a tag; `actionlint` is not installed), any deploy of the new Worker. A manual `bun run deploy` was denied by the session's permission check, so `outlore.dyrits.workers.dev` does not exist until the first tag's job (or a manual deploy) creates it.
- Until then the old Worker `outlore-relay` (version `08b135fa`) keeps serving the page at `outlore-relay.dyrits.workers.dev`, and `main`'s default relay names the new, not yet existing address. Devices paired through the old address pair again.
- The owner reported pairing a browser with their Mac through the page: "It works" (network not stated).

## Decisions

- Worker `outlore` (owner: "I'd like that"); a workers.dev name is one DNS label, so `outlore.relay.…` is not possible. The account subdomain `dyrits` stays. The Worker's default name on a user's own account stays `outlore-relay`.
- The deploy runs from the release tag, after the installers are published; a failed deploy does not undo the release. The web app's release is the tag, as the packaged app's is (`package.ts` strips a leading `v`; the job does too).
- The app shows the shared web address always: an own relay does not serve the page. A pairing code naming an own relay used from the shared page is unverified.
- The old Worker is left running; deleting it is the owner's choice.
- Pushing to `main` needs `git push --no-verify` and the owner's approval each time.

## Next

1. The 0.1.4-Prototype release thread tags the release; watch the `relay` job. If it fails, read its log: a missing or wrong secret, an API token without Workers edit rights, or the first creation of the Worker `outlore` are the likely causes.
2. After the tag: `https://outlore.dyrits.workers.dev/` returns the page, and its release equals the tag; pair a browser with a host running that release and record it in `documentation/verification/2026-11-15-browser-access.md` (and a Delivery in the changelog once the owner accepts the look).
3. Optionally delete the old `outlore-relay` Worker, and verify a code naming an own relay from the shared page.

## Open questions

- Whether to delete the old `outlore-relay` Worker, and when.
- An independent review of the browser-access diff (asked several times, unanswered).

## Sources

- `.github/workflows/package.yml` (the `relay` job), `packages/relay/test/releaseWorkflow.test.ts`
- `documentation/changelog/0.1.4-Prototype.md` (CHG-0286, 0287, 0289, 0290)
- `documentation/work-in-progress.md` ("Browser access"), `documentation/verification/2026-11-15-browser-access.md`
- `packages/relay/wrangler.jsonc`, `packages/service/src/remote/config.ts`, `apps/app/src/settings/remoteAccess.ts`
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- Previous handoffs: `2026-11-15-1741-relay-outlore-deploy.md`, `2026-11-15-1607-browser-access-online.md`
