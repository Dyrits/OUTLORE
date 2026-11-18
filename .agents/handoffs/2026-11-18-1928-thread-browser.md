# Handoff: A browser for threads (Kitesurf, Playwright, OpenBot research)

Supersedes: none
Workspace: OUTLORE, main checkout, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants threads to browse the web, and asked to build it with Cloudflare's Kitesurf, then for a recommendation. Done means a first batch is agreed and built: a browser tool for threads, with the owner's approvals, that works on a VPS host with no browser installed. Nothing is built yet.

## State

- Verified now (by reading): the app has no routing for its own screens. One reducer holds the location (`apps/app/src/shell/location.ts`, used in `apps/app/App.tsx:43`); only the place is remembered (`rememberPlace`, `apps/app/src/foundation/colorScheme.ts`). There is no `popstate` handler and no history entry per screen, and the only `history.replaceState` call strips a pairing code (`apps/app/src/foundation/useHostConnection.ts:135`). The owner's first question ("browser navigation") was understood this way, then they meant a browser for threads. The app's own Back button is not being built.
- Verified now: no document mentioned Kitesurf. The draft computer-use specification already plans a browser backend as slice 3 and names Playwright MCP (`documentation/capabilities/computer-use/specifications.md`, lines 138 and 207); the alternatives note rates Playwright MCP the best browser option (`documentation/research/computer-use-alternatives.md`, line 158).
- Verified (web search and Cloudflare's open-source post, 2026-11-18): Kitesurf is Cloudflare's agent browser, open source (Apache 2.0) since 2026-11-13, a Rust engine compiled to WebAssembly (Blitz, Stylo, Boa as last resort) driven over CDP, "under heavy development". Its post shows Puppeteer, not Playwright. Running it on Cloudflare needs a Workers Paid plan; locally it needs a Rust build. Its repository was not read. Claims from news sites (no WebGL, no video, no real TLS fingerprint) are unverified.
- Verified: the OpenBot browser research is written and cited, from `nightly-labs/openbot` at commit `67d0a82`, release 0.73.0: `documentation/research/openbot-browser-2026-11-18.md`, with one dated line in `documentation/inspirations.md`.
- Assumed (not tested): Playwright MCP runs headless on a VPS with no unlocked screen; a Playwright browser container works as the VPS route; Playwright MCP over a remote Chromium cannot give OpenBot's wait-during-take-over or secret lock without a layer of our own.
- Nothing is implemented. The working tree holds other sessions' uncommitted changes (a Vibe harness, usage colors, the phone menu); they are not part of this work.

## Decisions

Recommendations the owner has not yet approved as a batch; none is recorded in the changelog.

- Kitesurf is not the default engine: too young, not Chromium, and its self-hosting needs a Rust build or a paid Cloudflare plan. It stays a possible later engine behind the same tool interface (it speaks CDP).
- Leading engine: Playwright MCP on Chromium. On a VPS the browser runs in its own container (a browser-only container, not the whole host), reached over the network and bound to localhost or the container network; on a desktop, a Chromium downloaded as an optional component with a "Browser is not set up yet" status, as for voice. The owner agreed the host may run on a VPS with no browser, so a bundled or installed browser is needed.
- Take from OpenBot: a text snapshot first (screenshot on request), the hold on a tab the owner has taken over (the agent's calls wait, then get a "page changed" answer), secrets kept out of the model, frame streaming for a phone view, many steps in one script. Avoid: its shared default profile, full access as the only boundary, the whole-host container, bot-check evasion.
- For Outlore: a fresh profile per thread, off by default, an approval per site, and a block on private addresses.

## Next

1. Ask the owner to approve the first batch: a view-only browser tool for threads (open a page, read it as text, take a screenshot), engine-neutral, off by default, asking before each site, a fresh profile per thread, a browser address setting for the container route. Ask whether it includes the owner's take-over and tab hold, which Playwright MCP may not give.
2. Once agreed, record an agreement in the changelog (next free CHG number in `documentation/changelog/0.1.10-Prototype.md`) and extend the computer-use specification's slice 3 instead of a new capability.
3. Read Kitesurf's repository (`github.com/cloudflare/kitesurf`) before anyone relies on it, and check whether it can run standalone on a small VPS.
4. Test Playwright MCP headless in a Playwright container and note the memory use per tab.

## Open questions

- Does the first batch include the owner's take-over and the tab hold? The owner answers.
- Docker on the owner's VPS: is it available, and is the desktop to rely on a downloaded Chromium or the container? The owner answers.
- How to block private addresses so a page cannot reach services on the VPS: not designed.
- Whether Playwright MCP can offer wait-during-control and the secret lock, or needs a thin layer of ours: a spike answers it.

## Sources

- `documentation/research/openbot-browser-2026-11-18.md` (OpenBot at `67d0a82`, release 0.73.0) and the earlier `documentation/research/openbot-multiplayer.md`.
- `documentation/capabilities/computer-use/specifications.md` and `documentation/research/computer-use-alternatives.md`.
- Kitesurf: https://blog.cloudflare.com/kitesurf-open-source and https://blog.cloudflare.com/kitesurf/
- The quest journal entries 1 and 2 of this quest.
