# Verification: Updating a host from a paired device

- **Work:** CHG-0517 (agreement) and CHG-0518 (delivery), on `mission/remote-update-of-hosts-33903a26`, rebased onto `32e1ae7`.
- **Environment:** macOS, this thread's sandbox, Electron 45 as Node for the suite. Whole services over real SQLite databases and a real local relay (`startNodeRelay`); the desktop updater is replaced by a stand-in. No Electron window, no packaged app, no phone.
- **Verdict:** every check an agent can make passed. A real phone and a packaged macOS host updating itself remain with the owner.

| Claim | Check | Result |
| --- | --- | --- |
| The service reads and arms the update, waits while turns run, installs once at zero, ignores a second ask, refuses when unsupported, reports a failed check or install, and keeps the install when the device is gone | `packages/service/test/update/hostUpdate.test.ts`, fake `HostUpdater`, turns written as `running` rows, `TestClock` | passed |
| The service reaches the updater through the parent port, one answer per call identifier, no answer is unsupported (state) or the host going away (install) | `packages/service/test/update/parentPortUpdater.test.ts` | passed |
| A device of a later release is refused on the plain link (close code 4003) and served on the update link; the host installs; a restarted host on the same database accepts the stored pairing with no new code and the device list still holds the one device | `packages/service/test/update/deviceUpdate.test.ts`, browser device, real relay | passed |
| The same through a desktop device's own service: the plain loopback path closes with 4003, `/host/<id>/update` serves `ReadHostUpdate` and `UpdateHost`, and the plain path works after the restart | same file, third test | passed |
| A host that does not know the request answers with an `InvalidInput` failure | same file; an unknown tag stands in for an older host, which decodes none of the new tags | passed (stand-in, not a real old host) |
| The main process answers state, check and install from the updater controller, waits for the updates to be set up, ignores other messages, and a forced check ignores the owner's switch | `apps/desktop/test/serviceUpdates.test.ts`, `apps/desktop/test/updates/controller.test.ts` | passed |
| The update link keeps trying for ten minutes after the host quits and gives up only when the host no longer knows the device; its path ends in `/update` | `apps/app/test/foundation/client.test.ts`, `hosts.test.ts`, fake sockets and timers | passed |
| The offer appears only for an older host that can update; a newer host and an unsupported host keep today's text; an old host reads as too old; the steps and their words; done on the device's release | `apps/app/test/foundation/hostUpdate.test.ts` | passed |

## Commands run

- `bun run check`: clean.
- `bun run typecheck`: clean on all seven workspaces.
- `CI=1 bun run test`: 270 files (266 passed, 4 skipped); 2,222 tests (2,167 passed, 55 skipped), run on the tip rebased onto `32e1ae7`. The skipped ones are the suite's existing live-harness and process-table tests.

## Not checked

- A real phone updated one release ahead of a packaged macOS host: the tap, the question, the progress text, the host quitting and returning, and the phone reconnecting by itself.
- A packaged macOS host installing through `UpdateController.install()` after this request (the swap script is the existing one, covered by `swap.test.ts`; the call from the service is covered only with a stand-in).
- The look of the banner, the **Update host** button and its question, on a phone and in a window.
- Retry timing against the shared relay's allowance over a real multi-minute install; the test uses fake timers and the existing back-off (a second, doubling to half a minute).
- A browser device on the deployed web build; the code path is the controller's, shared with the phone, and tested with a browser device.
