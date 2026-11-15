# Handoff: browser access built; commit, push to main, and publish the web page online

Supersedes: `2026-11-14-1953-host-browser-architecture.md`
Workspace: ISKIOS (GitHub `Dyrits/OUTLORE`), branch `main`, worktree `.delta/worktrees/ya3tzdq4yd70/ISKIOS`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants to open an Outlore web page online, enter the pairing code shown by their Mac's running Outlore (the host), and control it from any browser. Done means: the work is committed and pushed to `main`, the web build is published at a public HTTPS address on the owner's Cloudflare account, and a pairing from a browser on another network to the owner's real Mac was seen working.

## State

- **Verified now (git):** HEAD and `origin/main` are both `1d664b3`; the whole browser-access batch is uncommitted in the working tree (modified files plus the untracked `packages/controller/`, `apps/app/src/foundation/browser/`, `apps/app/src/foundation/transport.ts`, `packages/relay/src/browser.ts`, and the `documentation/verification/2026-11-15-browser-access*` files).
- **Verified now (commands):** `bun run check` passes (680 files); the channel, controller and `hosts.test.ts` tests pass (94 tests).
- **Verified earlier in this session, not rerun:** `bun run typecheck` passes for all seven workspaces; the full suite (`env -u CLAUDE_CONFIG_DIR CI=1 bun run test --maxWorkers=4`, outside Claude Code's sandbox) passed 1,612 with 18 skipped, before the last small dialog-wording and close-code edits (the app, channel and controller tests were rerun after them: 502 passed); `bunx expo export --platform web` bundles; a 24-check drive of a plain Chromium page (Electron, no preload) against a real host and a local relay passes (pairing, reload, steering, folder picker, host restart, disconnect, release mismatch).
- **What was built** (agreement CHG-0286 in `documentation/changelog/0.1.4-Prototype.md`): a new package `packages/controller` (`@outlore/controller`: pairings in `localStorage`, pairing with a code, the encrypted link as a transport); `ServiceClient` talks through a transport; a browser mode in `useHostConnection` and `App.tsx` (no local service, a required pairing dialog, no "This computer" in the host menu, a "Pair again" banner link); hosts tell their release in pairing replies (`OUTLORE_RELEASE`, set from `app.getVersion()`); a web app of another release is refused with a message and its own close code (4003); `@outlore/relay/browser` exports the relay client without Node.
- **Not done, and the reason this handoff exists:** nothing is published. The web build has only been served from this computer. The relay Worker (`packages/relay`, name `outlore-relay`, `https://outlore-relay.dyrits.workers.dev`) does not serve static files yet. The owner asked for this ("when done, I want to be able to go on the page online and control my hosted version on my Mac"), and this handoff's argument asks to commit, push and publish.
- **Assumed, not run:** serving the build from the relay Worker with static assets, and any real deploy; pairing against the real Mac or the deployed relay; Chrome, Firefox, Safari, a phone, a second network; a real provider turn from a browser.
- No independent review of the diff has run; the owner was asked and has not answered.

## Decisions

- Browser trust (owner, 2026-11-15; ADR 0019): the browser trusts the HTTPS site serving the build; that trust is separate from the encrypted relay transport; no claim of protection against malicious code served by that site. Recorded in `documentation/architecture-decision-record/0019-browsers-use-the-relay-served-web-app.md`.
- First batch (owner, 2026-11-15): a desktop browser pairs with an already-running desktop host and uses the shared interface; the desktop host stays open for now (CHG-0286).
- The owner suggested a Cloudflare page where the user enters the pairing code; I recommended serving the build from the existing `outlore-relay` Worker as static assets (one address, nothing new to configure) over a separate Pages project. The owner has not chosen between them; either gives the same experience.
- My choices within the batch, recorded in `documentation/work-in-progress.md` ("Browser access"): `localStorage` for pairings; the host's `release` is optional in the reply parser but a host that sends none is refused; the browser's device kind is `desktop`; a local relay is accepted only by a page served from this computer; the web app's release is `apps/app/package.json`'s `version`.
- The Mac must run this code: an installed Iskios 0.1.3 does not tell its release and would be refused, so the owner runs `bun run dev` from this tree (its release is the desktop package's version, `0.1.3-Prototype`, equal to the app's) or a build of the release that is published.
- Pushing to `main` needs `git push --no-verify` (the pre-push hook refuses protected branches). An agent needs the owner's approval before bypassing the hook; the owner's argument to this handoff ("commit and push on main, and publish it online") is the instruction, but a tag or release is a separate approval (`0.1.4-Prototype` is still untagged; see the previous handoff).
- Publishing makes the page public on the owner's Cloudflare account: deploy only with the owner's approval of that step and use their own credentials (`wrangler` login or API token; never write a token into a file or a commit).

## Next

1. Run `bun run check`, `bun run typecheck` and the full suite once more on the tree as it stands; commit the whole batch on `main` (message names CHG-0286; the pre-commit hook runs Biome and the typecheck); push with `git push --no-verify` as the owner instructed.
2. Add static-asset serving of the exported web build (`bunx expo export --platform web` from `apps/app`) to the relay Worker (`packages/relay/src/worker.ts`, `wrangler.jsonc`; the bundle `workerBundle.generated.ts` and its hash test must be regenerated with `bun run bundle` in `packages/relay`), keeping `/r/<room>` for rooms and serving the page for every other path. Tests first (a request for `/` returns the page, `/r/...` still reaches rooms). Keep the free-plan limits in mind (static asset requests are free; room traffic is what binds, see ADR 0016).
3. Decide with the owner how the page learns its relay: a pairing code carries its relay address, so a page served from `outlore-relay.dyrits.workers.dev` can pair with a code naming it; check the page accepts that origin (a code naming a local relay is accepted only from a local page).
4. Deploy to the owner's Cloudflare account with the owner's approval; read the deployed address back.
5. Run the real check: on the owner's Mac run the app from this tree, turn on Allow paired devices in the Charter, make a pairing code, open the deployed page from another network (or phone browser), paste the code, and see the quests; record it in `documentation/verification/` and a Delivery in the changelog only after the owner accepts the look.
6. Update `documentation/work-in-progress.md`, the backlog and the README with what is published; write a new handoff for the state after.

## Open questions

- Static assets on the relay Worker or a separate Pages project: the owner's choice (recommended: the Worker).
- Whether the owner wants an independent review of the diff before the commit (asked, unanswered); the next agent can run one over `git diff` against `1d664b3`.
- Whether the first public page may be on the shared relay's address now, or should wait for the `0.1.4-Prototype` release so the page and the Mac's installed app match by release. Only the owner can say.
- The Windows and Linux updaters, the new Outlore icon, and the open `0.1.4-Prototype` tag remain as in `2026-11-15-1458-outlore-rename.md`.

## Sources

- `documentation/changelog/0.1.4-Prototype.md` (CHG-0282 to CHG-0286)
- `documentation/work-in-progress.md` ("Browser access" entry)
- `documentation/verification/2026-11-15-browser-access.md` and its folder (drive scripts, screens, `results.json`)
- `documentation/capabilities/device-pairing/specifications.md` (A browser as a paired device; Releases)
- `documentation/architecture-decision-record/0019-browsers-use-the-relay-served-web-app.md`, `0016-shared-relay-on-the-owners-free-cloudflare-account.md`
- `documentation/backlog.md` (browser access entries; two small host races found)
- `packages/controller/`, `apps/app/src/foundation/useHostConnection.ts`, `apps/app/src/foundation/client.ts`, `packages/relay/src/worker.ts`, `packages/relay/wrangler.jsonc`
- Previous handoffs: `2026-11-14-1953-host-browser-architecture.md`, `2026-11-15-1458-outlore-rename.md`
- Starting revision `1d664b3`
