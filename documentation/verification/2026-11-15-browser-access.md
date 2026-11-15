# Browser access, first batch

## Verdict

A plain browser page with no desktop bridge pairs with a running desktop host through a real local relay, keeps the pairing across a reload, and uses the host's quests, messages and folder picker; the failure states read as agreed. Checked headlessly and in Chromium (inside Electron, no preload). The owner's look at the pairing dialog, the banners and the host menu is pending, and the relay does not serve the web build yet. Agreement: [CHG-0286](../changelog/0.1.4-Prototype.md).

## Scope

- Starting revision `1d664b3`; nothing committed.
- Behavior: [device pairing](../capabilities/device-pairing/specifications.md) (A browser as a paired device; Releases). Trust: [0019](../architecture-decision-record/0019-browsers-use-the-relay-served-web-app.md).
- Changed: the host's pairing replies carry `release` (`packages/channel/src/protocol.ts`, `service/src/remote/hostSession.ts`, `OUTLORE_RELEASE`); a new workspace package `packages/controller`; `@outlore/relay/browser`; `ServiceClient` over a transport; `useHostConnection` and `App.tsx` have a browser mode; the pairing dialog, host menu and banner follow it.

## Checks

Run from the repository root with Bun 1.4.3, after `bun install`:

```sh
bun run check
bun run typecheck      # seven workspaces
env -u CLAUDE_CONFIG_DIR CI=1 bun run test --maxWorkers=4
```

- New or changed tests, each seen failing before the code that satisfies it: `packages/channel/test/protocol.test.ts` (release in a reply, optional, validated); `apps/app/test/foundation/hosts.test.ts` (a release mismatch is final and is not a refusal); `packages/controller/test/browserDevice.test.ts` (6 tests: a whole host service over its own database and a real relay; pairing, reload, steering, folders, a code used twice or garbled or expired, a local relay from a page elsewhere, a host of another release at pairing and at resume, a host that stops accepting devices and returns, a disconnected browser). A defect it found: the host's first announcement, sent right behind its answer, was swallowed by the reader of the answer; the link now buffers it.
- Web export: `bunx expo export --platform web` bundles `@outlore/controller` and the relay's `./browser` entry (one 3.2 MB bundle).
- Full suite, outside Claude Code's sandbox: 1,612 passed, 18 skipped (157 files passed, 1 skipped). It ran on the tree just before the last wording change to the pairing dialog ("Name this browser") and the mismatch close code was re-run on its own (app, channel and controller tests: 502 passed, 8 skipped); Biome and the typecheck ran on the final tree.

## Checks shown able to fail

Each break was made in a separate worktree of the end state (never in the checkout) and each was caught; the unbroken worktree passed again afterwards (11 tests in the controller and `hosts` files):

- The web app's release check always passing: "refuses a host of another release" fails.
- The frames behind the host's reply thrown away: "pairs with a code, keeps the pairing across a reload, and steers the host" fails.
- The host sending no release in its resumed reply: three controller tests fail.
- A release mismatch not ending the retries: the `hosts.test.ts` case fails.
- The pairing not stored: four controller tests fail.

The first runs of the new protocol, `hosts` and controller tests also failed for the expected reason before their code existed. The drive's checks read the page text and the host's own state, so they fail when the page or host differs; they were not each mutated.

## Browser drive

[`drive.mjs`](2026-11-15-browser-access/drive.mjs) starts a relay on this computer ([`relay.mjs`](2026-11-15-browser-access/relay.mjs)), a host ([`host.mjs`](2026-11-15-browser-access/host.mjs): the whole service, fake harness, its own data folder), the exported web build over plain HTTP ([`serve.mjs`](2026-11-15-browser-access/serve.mjs)) and Chromium without a preload ([`browser.cjs`](2026-11-15-browser-access/browser.cjs)), and reads and drives the page through the debugging port. Build the exported page and the two bundles first:

```sh
(cd apps/app && CI=1 bunx expo export --platform web --output-dir /tmp/outlore-web)
ln -sfn ../../../packages/service/node_modules documentation/verification/2026-11-15-browser-access/node_modules
bun build documentation/verification/2026-11-15-browser-access/host.mjs --target=node --format=esm --outfile /tmp/outlore-drive/host.js
bun build documentation/verification/2026-11-15-browser-access/relay.mjs --target=node --format=esm --outfile /tmp/outlore-drive/relay.js
node documentation/verification/2026-11-15-browser-access/drive.mjs /tmp/outlore-web documentation/verification/2026-11-15-browser-access/screens
```

(The `node_modules` link is only for bundling `host.mjs` and `relay.mjs`; remove it afterwards, it is not for the repository.) Result: 24 of 24 checks pass; `screens/results.json` has them. They cover: no bridge, and a pairing dialog with no Cancel; pairing, the host listing this browser, the pairing in storage; a quest made on the host appearing in the browser; a reload resuming with no dialog; a message typed in the browser answered by the host; searching a folder on the host, choosing it and creating a realm from it; the host going away (banner, "Trying again…") and returning (reconnected by itself); the host disconnecting this browser (the words, no retries, **Pair again**, pairing again replacing the old pairing, one kept); a host of another release (both named, no retries, no Pair again).

Screens in [`2026-11-15-browser-access/screens`](2026-11-15-browser-access/screens/): the dialog, the paired page, after reload, steering, the folder search and chosen folder, the banners.

## Not checked

- Chrome, Firefox and Safari (Chromium inside Electron only), a phone browser, a browser on another computer or network, the deployed shared relay, and a packaged desktop host. The relay does not serve the web build, so none of this ran from a published address; the build was served from this computer.
- The owner's look: the dialog (light look only seen), the banners, the host menu with no "This computer", narrow windows.
- A real provider turn from a browser (the fake harness answered), approvals, terminals (off in a browser by design), Windows and Linux.
- An independent review of the diff; only my own read.
- The stored device token in `localStorage` is readable by the site's code (0019 records that trust).
