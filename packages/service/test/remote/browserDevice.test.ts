import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import {
  createPairedHosts,
  type KeyValueStorage,
  type OpenTransport,
  openBrowserTransport,
  pairFromBrowser,
} from "@outlore/controller";
import { startNodeRelay } from "@outlore/relay";
import { fakeHarnessLayer, Service, serviceLayer } from "@outlore/service";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";

// A browser on its own, with nothing but a pairing code: it pairs with a running host through a real local relay,
// keeps the pairing in its storage, and speaks to the host's service through the transport the app's client uses
// (browser access, CHG-0286). The host is a whole service over its own database.

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const memoryStorage = (): KeyValueStorage & { readonly values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
    values,
  };
};

const until = <A>(check: () => A | undefined | Promise<A | undefined>) =>
  Effect.gen(function* () {
    for (let i = 0; i < 300; i++) {
      const value = yield* Effect.promise(async () => check());
      if (value !== undefined) return value;
      yield* Effect.sleep("20 millis");
    }
    return yield* Effect.fail(new Error("timed out waiting"));
  });

const hostRelease = "0.1.4-Prototype";

interface Frame {
  readonly _tag: string;
  readonly id?: string;
  readonly value?: unknown;
}

/** A transport as the app's client holds it: what it received, how it ended, and a request with its answer. */
const driven = (openTransport: OpenTransport) => {
  const state = { closed: null as { code: number; reason: string } | null, frames: [] as Frame[], isOpened: false };
  const transport = openTransport({
    onClose: (code, reason) => {
      state.closed = { code, reason };
    },
    onError: () => {},
    onOpen: () => {
      state.isOpened = true;
    },
    onText: (data) => state.frames.push(JSON.parse(String(data)) as Frame),
  });
  let next = 0;
  return {
    ask: (request: object) =>
      Effect.gen(function* () {
        const id = String(++next);
        transport.send(JSON.stringify({ id, request }));
        return yield* until(() => state.frames.find((frame) => frame.id === id));
      }),
    close: () => transport.close(),
    get closed() {
      return state.closed;
    },
    get frames() {
      return state.frames;
    },
    get isOpened() {
      return state.isOpened;
    },
  };
};

const makeWorld = () =>
  Effect.gen(function* () {
    const relay = yield* startNodeRelay();
    const relayOrigin = `http://127.0.0.1:${relay.port}`;
    const directory = mkdtempSync(join(tmpdir(), "outlore-browser-"));
    directories.push(directory);
    const hostContext = yield* Layer.build(
      serviceLayer({
        computerName: "Host Mac",
        filename: join(directory, "outlore.sqlite"),
        harness: fakeHarnessLayer("10 millis"),
        homeFolder: directory,
        relayOrigin,
        release: hostRelease,
        scratchRoot: join(directory, "missions"),
      }),
    );
    const host = (request: object) =>
      Effect.gen(function* () {
        const service = yield* Service;
        return yield* service.handle(request as never);
      }).pipe(Effect.provideContext(hostContext));
    const allowPairing = Effect.gen(function* () {
      // The host's runtime listens for the switch only once it has read its settings, said it is off and gone to wait:
      // a switch turned on in the instant between is not heard until its next look (half a minute).
      yield* until(() =>
        Effect.runPromise(host({ _tag: "ReadRemoteAccess" })).then((view) =>
          (view as { status: string }).status === "Off" ? view : undefined,
        ),
      );
      yield* Effect.sleep("150 millis");
      yield* host({ _tag: "SetRemoteAccess", isEnabled: true });
      yield* until(() =>
        Effect.runPromise(host({ _tag: "ReadRemoteAccess" })).then((view) =>
          (view as { status: string }).status === "Connected" ? view : undefined,
        ),
      );
    });
    const newCode = () =>
      host({ _tag: "CreatePairingCode" }).pipe(Effect.map((made) => (made as { code: string }).code));
    /** One browser: its own storage, and the settings of the page it runs on. */
    const browser = (settings: { release?: string; storage?: ReturnType<typeof memoryStorage> } = {}) => {
      const storage = settings.storage ?? memoryStorage();
      const hosts = createPairedHosts(storage);
      const page = { allowLocalRelay: true, release: settings.release ?? hostRelease };
      return {
        hosts,
        link: (hostId: string) => driven(openBrowserTransport(hosts, hostId, page)),
        pair: (code: string, name = "Firefox") => pairFromBrowser(code, name, hosts, page),
        reloaded: () => browser({ ...settings, storage }),
        storage,
      };
    };
    const hostSql = <A, E>(work: (sql: SqlClient.SqlClient) => Effect.Effect<A, E>) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        return yield* work(sql);
      }).pipe(Effect.provideContext(hostContext));
    return { allowPairing, browser, directory, host, hostSql, newCode, relayOrigin };
  });

const world = makeWorld();

describe("a browser pairing with a running host and using it", () => {
  it.live("pairs with a code, keeps the pairing across a reload, and steers the host", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const browser = w.browser();
        const host = yield* Effect.promise(async () => browser.pair(await Effect.runPromise(w.newCode())));
        expect(host).toMatchObject({ name: "Host Mac" });
        expect(yield* w.host({ _tag: "ReadRemoteAccess" })).toMatchObject({ devices: [{ kind: "browser" }] });
        expect(browser.hosts.known()).toMatchObject([{ id: host.id, name: "Host Mac" }]);

        // A reload: a new page over the same storage still knows the host and resumes without a new code.
        const link = browser.reloaded().link(host.id);
        // The host announces itself right behind its answer; the announcement must not be lost on the way.
        yield* until(() => link.frames.find((frame) => frame._tag === "Changed"));
        expect(link.isOpened).toBe(true);
        expect(yield* link.ask({ _tag: "ReadHostName" })).toMatchObject({ _tag: "Success", value: "Host Mac" });
        const started = yield* link.ask({
          _tag: "StartMission",
          effort: "default",
          model: "default",
          requestId: crypto.randomUUID(),
          text: "Started from a browser",
          workspacePath: null,
        });
        expect(started).toMatchObject({ _tag: "Success", value: { missionId: expect.any(String) } });
        const missions = yield* w.host({
          _tag: "ListMissions",
          isArchived: false,
          search: null,
          state: null,
          workspaceId: null,
        });
        expect(missions).toMatchObject({ missions: [{ title: "Started from a browser" }] });
        link.close();
      }),
    ),
  );

  it.live("pairs from the web link the host shows, as the page does when it opens one, and not twice", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const made = (yield* w.host({ _tag: "CreatePairingCode" })) as { appLink: string; webLink: string };
        // The page hands the browser what the address bar held after the `#`, as a link or a bare code.
        const fragment = new URL(made.webLink).hash;
        expect(fragment).toMatch(/^#outlore1-/);
        const browser = w.browser();
        const host = yield* Effect.promise(() => browser.pair(made.webLink));
        expect(host).toMatchObject({ name: "Host Mac" });
        expect(browser.hosts.known()).toMatchObject([{ id: host.id }]);
        const again = yield* Effect.promise(() =>
          w
            .browser()
            .pair(made.webLink)
            .catch((error: Error) => error),
        );
        expect(String((again as Error).message)).toContain("already used");
        const second = (yield* w.host({ _tag: "CreatePairingCode" })) as { appLink: string };
        expect(yield* Effect.promise(() => w.browser().pair(second.appLink))).toMatchObject({ name: "Host Mac" });
      }),
    ),
  );

  it.live("lets the browser search the host's folders and not its own", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const browser = w.browser();
        const host = yield* Effect.promise(async () => browser.pair(await Effect.runPromise(w.newCode())));
        const link = browser.link(host.id);
        // A folder on the host's computer, under its home folder, the first browsable root.
        mkdirSync(join(w.directory, "Projects"));
        expect(yield* link.ask({ _tag: "SearchFolders", query: "Projects" })).toMatchObject({
          _tag: "Success",
          value: [{ path: join(realpathSync(w.directory), "Projects") }],
        });
        link.close();
      }),
    ),
  );

  it.live("refuses a code used twice, a garbled code, and a local relay from a page elsewhere", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const browser = w.browser();
        const code = yield* w.newCode();
        yield* Effect.promise(() => browser.pair(code));
        const again = yield* Effect.promise(() =>
          w
            .browser()
            .pair(code)
            .catch((error: Error) => error),
        );
        expect(String((again as Error).message)).toContain("already used");
        const garbled = yield* Effect.promise(() => browser.pair(`${code.slice(0, -4)}AAAA`).catch((e: Error) => e));
        expect(String((garbled as Error).message)).toContain("not valid");
        const fresh = yield* w.newCode();
        const elsewhere = createPairedHosts(memoryStorage());
        const refused = yield* Effect.promise(() =>
          pairFromBrowser(fresh, "Firefox", elsewhere, { allowLocalRelay: false, release: hostRelease }).catch(
            (e: Error) => e,
          ),
        );
        expect(String((refused as Error).message)).toContain("relay on this computer");
        expect(elsewhere.known()).toEqual([]);
      }),
    ),
  );

  it.live("refuses an expired code", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const code = yield* w.newCode();
        yield* w.hostSql((sql) => sql`UPDATE pairing_codes SET expires_at = 1 WHERE used_at IS NULL`);
        const expired = yield* Effect.promise(() =>
          w
            .browser()
            .pair(code)
            .catch((error: Error) => error),
        );
        expect(String((expired as Error).message)).toContain("expired");
      }),
    ),
  );

  it.live("refuses a host of another release, at pairing and later, and says which releases", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const mismatched = w.browser({ release: "0.1.9-Prototype" });
        const refused = yield* Effect.promise(async () =>
          mismatched.pair(await Effect.runPromise(w.newCode())).catch((error: Error) => error),
        );
        expect(String((refused as Error).message)).toContain("0.1.9-Prototype");
        expect(String((refused as Error).message)).toContain(hostRelease);
        expect(mismatched.hosts.known()).toEqual([]);
        // The host turned it away before keeping a device: nothing is listed there either.
        expect(((yield* w.host({ _tag: "ReadRemoteAccess" })) as { devices: unknown[] }).devices).toEqual([]);

        // A pairing made by a web app of the right release, opened by one of another release.
        const matching = w.browser();
        const host = yield* Effect.promise(async () => matching.pair(await Effect.runPromise(w.newCode())));
        const link = driven(
          openBrowserTransport(createPairedHosts(matching.storage), host.id, {
            allowLocalRelay: true,
            release: "0.1.9-Prototype",
          }),
        );
        const closed = yield* until(() => link.closed ?? undefined);
        // 4003: trying again cannot help, and pairing again cannot either.
        expect(closed.code).toBe(4003);
        expect(closed.reason).toContain("0.1.9-Prototype");
      }),
    ),
  );

  it.live("tells an offline host from a disconnected browser, and uses the same pairing when the host is back", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const browser = w.browser();
        const host = yield* Effect.promise(async () => browser.pair(await Effect.runPromise(w.newCode())));
        const link = browser.link(host.id);
        expect(yield* link.ask({ _tag: "ReadHostName" })).toMatchObject({ value: "Host Mac" });

        // The host stops accepting devices: the link ends, and a new try says the host is not reachable (4000).
        yield* w.host({ _tag: "SetRemoteAccess", isEnabled: false });
        expect((yield* until(() => link.closed ?? undefined)).code).toBe(4001);
        const offline = browser.link(host.id);
        const notReached = yield* until(() => offline.closed ?? undefined);
        expect(notReached.code).toBe(4000);
        expect(notReached.reason).toContain("not connected");
        expect(browser.hosts.known()).toHaveLength(1);

        yield* w.allowPairing;
        const back = browser.link(host.id);
        expect(yield* back.ask({ _tag: "ReadHostName" })).toMatchObject({ value: "Host Mac" });

        // The host disconnects this browser: it refuses for good (4002).
        const access = (yield* w.host({ _tag: "ReadRemoteAccess" })) as { devices: Array<{ id: string }> };
        yield* w.host({ _tag: "DisconnectDevice", deviceId: access.devices[0]?.id });
        const refused = browser.link(host.id);
        const closed = yield* until(() => refused.closed ?? undefined);
        expect(closed.code).toBe(4002);
        expect(closed.reason).toContain("no longer knows");
        back.close();
      }),
    ),
  );
});
