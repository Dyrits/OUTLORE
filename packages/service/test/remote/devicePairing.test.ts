import { mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { decodePairingCode } from "@outlore/channel";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { redeemPairingSecret } from "../../src/remote/hostAccess.ts";

// Two whole services, each over its own database, joined by a real local relay: the host accepts paired devices and
// the controller pairs with it and steers it through its own loopback socket (device-pairing).

import { claimedMission, directories, makeWorld, until } from "./fixtures/pairingWorld.ts";

describe("controlling one installation from another through the relay", () => {
  it.live("pairs with a code, then steers the host and sees its changes", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const host = yield* world.pair(yield* world.newCode());
        expect(host.name).toBe("Host Mac");
        expect(yield* world.controller({ _tag: "ListHosts" })).toMatchObject([{ name: "Host Mac" }]);
        // The short channel that paired it closes by itself.
        yield* until(() =>
          Effect.runPromise(world.accessOf()).then((view) =>
            view.devices[0]?.isConnected === false ? view : undefined,
          ),
        );
        expect((yield* world.accessOf()).devices).toMatchObject([{ isConnected: false, name: "Laptop" }]);

        const link = yield* world.bridge(host.id);
        const started = yield* world.ask(link, "1", claimedMission("Steered from another computer"));
        expect(started).toMatchObject({ _tag: "Success", value: { missionId: expect.any(String) } });
        yield* until(() => link.frames.find((frame) => frame._tag === "Changed"));
        const missions = yield* world.host({
          _tag: "ListMissions",
          isArchived: false,
          search: null,
          state: null,
          workspaceId: null,
        });
        expect(missions).toMatchObject({ missions: [{ title: "Steered from another computer" }] });

        expect(yield* world.ask(link, "2", { _tag: "RenameHost", name: "Studio" })).toMatchObject({
          _tag: "Success",
          value: "Studio",
        });
        expect(yield* world.host({ _tag: "ReadHostName" })).toBe("Studio");
        const view = yield* world.accessOf();
        expect(view.devices).toMatchObject([{ isConnected: true, name: "Laptop" }]);
        expect(view.devices[0]?.lastActiveAt).not.toBeNull();
        link.socket.close();
      }),
    ),
  );

  it.live("tells where the web app opens, the same whichever relay the host uses", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        const view = (yield* world.accessOf()) as unknown as { webAppUrl: string };
        expect(view.webAppUrl).toBe("https://outlore.dyrits.workers.dev");
      }),
    ),
  );

  it.live("gives a pairing code with a web link and an app link that carry the same code in their fragment", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const made = (yield* world.host({ _tag: "CreatePairingCode" })) as {
          appLink: string;
          code: string;
          expiresAt: number;
          webLink: string;
        };
        expect(made.webLink).toBe(`https://outlore.dyrits.workers.dev/#${made.code}`);
        expect(made.appLink).toBe(`outlore://pair#${made.code}`);
        expect(made.expiresAt).toBeGreaterThan(Date.now());
        expect(decodePairingCode(made.code).ok).toBe(true);
      }),
    ),
  );

  it.live("pairs with a web link or an app link pasted where a code goes, once only", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const first = (yield* world.host({ _tag: "CreatePairingCode" })) as { appLink: string; webLink: string };
        const host = yield* world.pair(`  ${first.webLink}\n`);
        expect(host.name).toBe("Host Mac");
        const again = yield* Effect.flip(world.pair(first.webLink));
        expect(String((again as { message: string }).message)).toContain("already used");
        const second = (yield* world.host({ _tag: "CreatePairingCode" })) as { appLink: string };
        yield* world.pair(second.appLink, "Second");
        expect((yield* world.accessOf()).devices).toHaveLength(2);
      }),
    ),
  );

  it.live("accepts a pairing code once, and refuses an expired or garbled one", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const code = yield* world.newCode();
        yield* world.pair(code);
        const again = yield* Effect.flip(world.pair(code));
        expect(String((again as { message: string }).message)).toContain("already used");

        const stale = yield* world.newCode();
        yield* world.hostSql((sql) => sql`UPDATE pairing_codes SET expires_at = 1 WHERE used_at IS NULL`);
        const expired = yield* Effect.flip(world.pair(stale));
        expect(String((expired as { message: string }).message)).toContain("expired");

        const garbled = yield* Effect.flip(world.pair(`${code.slice(0, -4)}AAAA`));
        expect(String((garbled as { message: string }).message)).toContain("not valid");
        expect((yield* world.accessOf()).devices).toHaveLength(1);
      }),
    ),
  );

  it.live("refuses a paired device what only the host may do", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const host = yield* world.pair(yield* world.newCode());
        const link = yield* world.bridge(host.id);
        for (const [id, request] of [
          ["a", { _tag: "ReadRemoteAccess" }],
          ["b", { _tag: "CreatePairingCode" }],
          ["c", { _tag: "SetRemoteAccess", isEnabled: false }],
          ["d", { _tag: "DisconnectDevice", deviceId: "anything" }],
          ["e", { _tag: "ListHosts" }],
          ["f", { _tag: "AddBrowsableRoot", path: tmpdir() }],
          ["g", { _tag: "RemoveBrowsableRoot", path: tmpdir() }],
        ] as const) {
          expect(yield* world.ask(link, id, request)).toMatchObject({
            _tag: "Failure",
            error: { kind: "AccessRefused" },
          });
        }
        expect((yield* world.accessOf()).isEnabled).toBe(true);
        link.socket.close();
      }),
    ),
  );

  it.live(
    "lets a paired device look for folders only under the roots the host set, and the host's own window anywhere",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const world = yield* makeWorld();
          yield* world.allowPairing;
          const host = yield* world.pair(yield* world.newCode());
          const link = yield* world.bridge(host.id);
          // Another folder on the host's computer, outside its only root (its home folder).
          const outside = mkdtempSync(join(tmpdir(), "outlore-outside-"));
          directories.push(outside);
          mkdirSync(join(outside, "secrets"));
          const search = (id: string, query: string) => world.ask(link, id, { _tag: "SearchFolders", query });
          expect(yield* search("typed", join(outside, "secrets"))).toMatchObject({ _tag: "Success", value: [] });
          expect(
            yield* world.ask(link, "browse", { _tag: "BrowseFolders", path: outside, shouldIncludeHidden: false }),
          ).toMatchObject({
            _tag: "Failure",
            error: { kind: "InvalidInput" },
          });
          expect(yield* world.ask(link, "make", { _tag: "CreateFolder", name: "x", parent: outside })).toMatchObject({
            _tag: "Failure",
            error: { kind: "InvalidInput" },
          });
          // The host sets the root in its Workshop; the paired device then reaches it.
          yield* world.host({ _tag: "AddBrowsableRoot", path: outside });
          const found = yield* search("added", "secrets");
          expect(found).toMatchObject({ _tag: "Success", value: [{ path: join(realpathSync(outside), "secrets") }] });
          link.socket.close();
        }),
      ),
  );

  it.live("ends a device's connection at once when the host disconnects it, and forgets it", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const host = yield* world.pair(yield* world.newCode());
        const link = yield* world.bridge(host.id);
        yield* world.ask(link, "1", { _tag: "ReadHostName" });
        const [device] = (yield* world.accessOf()).devices as unknown as Array<{ id: string }>;
        yield* world.host({ _tag: "DisconnectDevice", deviceId: device?.id as never });
        yield* until(() => link.closed ?? undefined);
        expect(link.closed?.code).toBe(4001);

        const retry = yield* world.bridge(host.id);
        const closed = yield* until(() => retry.closed ?? undefined);
        // A host that forgot this installation refuses it for good, so the app stops trying.
        expect(closed.code).toBe(4002);
        expect(closed.reason).toContain("no longer knows");
        expect((yield* world.accessOf()).devices).toEqual([]);
      }),
    ),
  );

  it.live(
    "ends every connection when Allow paired devices goes off, and resumes with the same pairing when it is on",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const world = yield* makeWorld();
          yield* world.allowPairing;
          const host = yield* world.pair(yield* world.newCode());
          const link = yield* world.bridge(host.id);
          yield* world.ask(link, "1", { _tag: "ReadHostName" });

          // The answer already shows Off, before the runtime has closed its relay connection.
          const off = yield* world.host({ _tag: "SetRemoteAccess", isEnabled: false });
          expect(off).toMatchObject({ isEnabled: false, status: "Off" });
          yield* until(() => link.closed ?? undefined);
          expect((yield* world.accessOf()).status).toBe("Off");
          const refused = yield* world.bridge(host.id);
          expect((yield* until(() => refused.closed ?? undefined)).code).toBe(4000);
          expect((yield* world.accessOf()).devices).toHaveLength(1);

          yield* world.allowPairing;
          const back = yield* world.bridge(host.id);
          expect(yield* world.ask(back, "2", { _tag: "ReadHostName" })).toMatchObject({
            _tag: "Success",
            value: "Host Mac",
          });
          back.socket.close();
        }),
      ),
  );
  it.live("sends the relay nothing readable: not a quest title, a name, a pairing secret, or a device token", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // Every frame the services send to the relay, as text, whatever its length: the relay forwards them unchanged.
        const seen: string[] = [];
        const Original = globalThis.WebSocket;
        class Spy extends Original {
          readonly isRelay: boolean;
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            this.isRelay = String(url).includes("/r/");
          }
          override send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
            if (this.isRelay && typeof data !== "string" && !(data instanceof Blob)) {
              const bytes = ArrayBuffer.isView(data)
                ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
                : new Uint8Array(data);
              seen.push(Buffer.from(bytes).toString("latin1"));
            }
            super.send(data as string);
          }
        }
        globalThis.WebSocket = Spy as typeof WebSocket;
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            globalThis.WebSocket = Original;
          }),
        );

        const world = yield* makeWorld();
        yield* world.allowPairing;
        const code = yield* world.newCode();
        const host = yield* world.pair(code, "Secret Laptop Name");
        const link = yield* world.bridge(host.id);
        yield* world.ask(link, "1", claimedMission("A very private quest title"));
        yield* world.ask(link, "2", { _tag: "RenameHost", name: "Private Host Name" });
        link.socket.close();

        const [stored] = yield* world.controllerSql(
          (sql) => sql<{ token: string }>`SELECT device_token AS token FROM remote_hosts`,
        );
        const secret = Buffer.from(code.slice("outlore1-".length), "base64url").subarray(48, 64);
        expect(seen.length).toBeGreaterThan(8);
        for (const marker of [
          "A very private quest title",
          "Private Host Name",
          "Secret Laptop Name",
          "StartMission",
          "Success",
          stored?.token ?? "no-token",
          secret.toString("latin1"),
        ]) {
          expect(seen.filter((frame) => frame.includes(marker))).toEqual([]);
        }
      }),
    ),
  );
});

describe("what the owner is told, and what a host refuses, at the edges", () => {
  it.live("refuses an already received secret when access has since been disabled", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const decoded = decodePairingCode(yield* world.newCode());
        if (!decoded.ok) throw new Error("test code did not decode");
        yield* world.host({ _tag: "SetRemoteAccess", isEnabled: false });
        const result = yield* world.hostSql((sql) =>
          redeemPairingSecret(decoded.value.secret, { kind: "desktop", name: "Late laptop" }, Date.now()).pipe(
            Effect.provideService(SqlClient.SqlClient, sql),
          ),
        );
        expect(result).toEqual({ refusal: "disabled" });
        expect((yield* world.accessOf()).devices).toEqual([]);
      }),
    ),
  );

  it.live("says when the host is not connected, instead of blaming the relay", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const code = yield* world.newCode();
        yield* world.host({ _tag: "SetRemoteAccess", isEnabled: false });
        yield* until(() =>
          Effect.runPromise(world.accessOf()).then((view) => (view.status === "Off" ? view : undefined)),
        );
        const failure = yield* Effect.flip(world.pair(code));
        expect(String((failure as { message: string }).message)).toContain("not connected right now");
      }),
    ),
  );

  it.live("does not serve anyone when pairing was switched off while the relay was still answering", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // The relay's answer is held back for a moment, so the switch can go off while the connection is being made.
        type Listening = {
          addEventListener: (type: string, listener: (event: unknown) => void, options?: unknown) => void;
        };
        const target = WebSocket.prototype as unknown as Listening;
        const original = target.addEventListener;
        target.addEventListener = function (this: { url: string }, type, listener, options) {
          const isRelayOpen = type === "open" && this.url.includes("/r/");
          const held = (event: unknown) => void setTimeout(() => listener(event), 400);
          original.call(this, type, isRelayOpen ? held : listener, options);
        };
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            target.addEventListener = original;
          }),
        );
        const world = yield* makeWorld();
        yield* world.host({ _tag: "SetRemoteAccess", isEnabled: true });
        yield* until(() =>
          Effect.runPromise(world.accessOf()).then((view) => (view.status === "Connecting" ? view : undefined)),
        );
        yield* world.host({ _tag: "SetRemoteAccess", isEnabled: false });
        yield* Effect.sleep("1500 millis");
        // The connection that was being made must not come up and serve devices.
        expect((yield* world.accessOf()).status).toBe("Off");
      }),
    ),
  );

  it.live("tells a new pairing the host's name as it is now", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        yield* world.host({ _tag: "RenameHost", name: "Studio" });
        const host = yield* world.pair(yield* world.newCode());
        expect(host.name).toBe("Studio");
      }),
    ),
  );

  it.live("pairs again after a disconnect without leaving the old entry in the menu", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const first = yield* world.pair(yield* world.newCode());
        const [device] = (yield* world.accessOf()).devices as unknown as Array<{ id: string }>;
        yield* world.host({ _tag: "DisconnectDevice", deviceId: device?.id as never });
        const second = yield* world.pair(yield* world.newCode());
        expect(second.id).not.toBe(first.id);
        expect(yield* world.controller({ _tag: "ListHosts" })).toMatchObject([{ id: second.id }]);
      }),
    ),
  );

  it.live("does not bring a code back to life when pairing is switched off and on again", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const code = yield* world.newCode();
        yield* world.host({ _tag: "SetRemoteAccess", isEnabled: false });
        yield* world.allowPairing;
        const failure = yield* Effect.flip(world.pair(code));
        expect(String((failure as { message: string }).message)).toContain("not valid");
      }),
    ),
  );

  it.live(
    "does not accept a code that names a relay on this computer when this installation's relay is elsewhere",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const world = yield* makeWorld({ controllerRelay: "https://relay.example.invalid" });
          yield* world.allowPairing;
          const failure = yield* Effect.flip(world.pair(yield* world.newCode()));
          expect(String((failure as { message: string }).message)).toContain("on this computer");
        }),
      ),
  );

  it.live("keeps only a hash of a device's token on the host, and a code lives ten minutes", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const before = Date.now();
        const code = yield* world.newCode();
        const after = Date.now();
        const [row] = yield* world.hostSql(
          (sql) => sql<{ expiresAt: number }>`SELECT expires_at AS expiresAt FROM pairing_codes`,
        );
        expect(row?.expiresAt).toBeGreaterThanOrEqual(before + 10 * 60_000);
        expect(row?.expiresAt).toBeLessThanOrEqual(after + 10 * 60_000);

        yield* world.pair(code);
        const [kept] = yield* world.controllerSql(
          (sql) => sql<{ token: string }>`SELECT device_token AS token FROM remote_hosts`,
        );
        const [hashed] = yield* world.hostSql(
          (sql) => sql<{ hash: string }>`SELECT token_hash AS hash FROM paired_devices`,
        );
        expect(kept?.token).toBeTruthy();
        expect(hashed?.hash).toBeTruthy();
        expect(hashed?.hash).not.toBe(kept?.token);
        expect(JSON.stringify(yield* world.hostSql((sql) => sql`SELECT * FROM paired_devices`))).not.toContain(
          kept?.token ?? "?",
        );
      }),
    ),
  );
});
