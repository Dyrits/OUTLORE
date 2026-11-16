import { describe, expect, it } from "@effect/vitest";
import {
  type Carrier,
  decodePairingCode,
  encodeBase64Url,
  encodeClientHello,
  openInitiator,
  roomPrologue,
} from "@outlore/channel";
import type { HostConnection } from "@outlore/relay";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { readHostRecord } from "../../src/remote/hostAccess.ts";
import { createDeviceServer, type RunWork } from "../../src/remote/hostSession.ts";
import { makeWorld, until } from "./fixtures/pairingWorld.ts";

type DropPoint = "admission" | "answer";

/** Where the connection drops: while the host admits the device, or while it gathers its answer (after the last check). */
const droppedPairing = (dropAt: DropPoint) =>
  Effect.scoped(
    Effect.gen(function* () {
      const world = yield* makeWorld();
      yield* world.allowPairing;
      const codeText = yield* world.newCode();
      const code = decodePairingCode(codeText);
      if (!code.ok) throw new Error("invalid test code");
      const record = yield* world.hostSql((sql) =>
        readHostRecord.pipe(Effect.provideService(SqlClient.SqlClient, sql)),
      );
      if (record === null) throw new Error("host not started");
      const sql = yield* SqlClient.SqlClient.pipe(Effect.provideContext(world.hostContext));
      const runWork: RunWork = (work) => Effect.runPromise(work.pipe(Effect.provideContext(world.hostContext)));
      // After admission the host reads its record, its name and its release; the connection drops after the release.
      let readsAfterAdmission = 0;
      const run: RunWork = async (work) => {
        const result = await runWork(work);
        if (dropAt === "answer" && admitted && ++readsAfterAdmission === 3) server.left("client");
        return result;
      };
      const runInTransaction: RunWork = (work) => runWork(sql.withTransaction(work));
      let admitted = false;
      const server = createDeviceServer({
        addSession: () => () => {},
        admitDevice: async () => {
          admitted = true;
          if (dropAt === "admission") server.left("client");
          return () => {};
        },
        announce: () => {},
        answer: () => {},
        isAccepting: () => true,
        run,
        runInTransaction,
      });
      const listeners: Array<(data: Uint8Array) => void> = [];
      const closes: Array<() => void> = [];
      const connection: HostConnection = {
        close: () => {},
        closeClient: () => {},
        onClientData: () => {},
        onClientJoined: () => {},
        onClientLeft: () => {},
        onClose: () => {},
        sendToClient: (_id, data) =>
          queueMicrotask(() =>
            listeners.forEach((listener) => {
              listener(data);
            }),
          ),
        usesLegacyClaim: false,
      };
      const carrier: Carrier = {
        close: () => server.left("client"),
        onClose: (listener) => closes.push(listener),
        onMessage: (listener) => listeners.push(listener),
        send: (data) => queueMicrotask(() => server.deliver("client", data)),
      };
      yield* Effect.forkChild(server.serve(connection, record, "client"), { startImmediately: true });
      const opened = yield* openInitiator(carrier, record.publicKey, roomPrologue(record.room));
      opened.sendText(
        encodeClientHello({
          deviceKind: "desktop",
          deviceName: "Dropped",
          secret: encodeBase64Url(code.value.secret),
          t: "pair",
        }),
      );
      yield* until(() => (admitted ? true : undefined));
      // The cleanup runs after the drop; wait for it to finish.
      yield* until(() =>
        Effect.runPromise(world.accessOf()).then((view) => (view.devices.length === 0 ? true : undefined)),
      );
      expect((yield* world.accessOf()).devices).toEqual([]);
      expect((yield* world.pair(codeText)).name).toBe("Host Mac");
      expect((yield* world.accessOf()).devices.map((device) => device.name)).toEqual(["Laptop"]);
      server.endAll();
      closes.forEach((close) => {
        close();
      });
    }),
  );

describe("pairing interrupted after a code is redeemed", () => {
  it.live("does not leave a device that never received its token", () => droppedPairing("admission"));
  it.live("does not leave a device when the connection drops while the answer is gathered", () =>
    droppedPairing("answer"),
  );
});
