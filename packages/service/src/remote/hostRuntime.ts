import { closeCodes, connectHost, type HostConnection } from "@outlore/relay";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { Changes, Sessions } from "../core/index.ts";
import { Service } from "../serviceTag.ts";
import { RemoteConfig } from "./config.ts";
import { answerText } from "./frames.ts";
import { type HostRecord, relayOriginOf } from "./hostAccess.ts";
import { createDeviceServer, type RunWork, reportFailure } from "./hostSession.ts";
import { HostPresence } from "./presence.ts";

const firstRetryMillis = 1_000;
const longestRetryMillis = 30_000;

/** Whether "Allow paired devices" is off, or the host has never been asked to pair. */
const isOff = (record: HostRecord | null) => record === null || !record.isEnabled;

/**
 * Keeps this installation's connection to its room on the relay for as long as "Allow paired devices" is on, and
 * serves each paired device through its own end-to-end encrypted channel exactly as the owner's window is served,
 * except for what only the host may do (device-pairing, Behavior).
 */
export const remoteHostLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const service = yield* Service;
    const state = yield* HostPresence;
    const sessions = yield* Sessions;
    const changes = yield* Changes;
    const sql = yield* SqlClient.SqlClient;
    const config = yield* RemoteConfig;
    const context = yield* Effect.context<never>();
    const runPlain = Effect.runPromiseWith(context);
    const withParts = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient | RemoteConfig>) =>
      effect.pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.provideService(RemoteConfig, config));
    const run: RunWork = (effect) => runPlain(withParts(effect));
    const runInTransaction: RunWork = (effect) => runPlain(withParts(sql.withTransaction(effect)));

    const devices = createDeviceServer({
      addSession: (send) => sessions.add(send),
      admitDevice: (id, close) =>
        runPlain(state.admitDevice(id, close).pipe(Effect.provideService(SqlClient.SqlClient, sql))),
      announce: () => void runPlain(changes.publish).catch(reportFailure),
      answer: (message, send) =>
        void runPlain(answerText(service.handle, message, send, { isPairedDevice: true })).catch(reportFailure),
      isAccepting: () => state.record()?.isEnabled ?? false,
      run,
      runInTransaction,
    });

    let isStopped = false;
    let current: HostConnection | null = null;
    let wake: (() => void) | null = null;
    const pause = (millis: number, generation: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(done, millis);
        function done() {
          clearTimeout(timer);
          wake = null;
          resolve();
        }
        wake = done;
        if (state.generation() !== generation || isStopped) done();
      });
    const stopListening = state.onPoke(() => wake?.());

    /** Holds one connection to `relayOrigin` until it ends; the code it ended with. */
    const hold = (connection: HostConnection, record: HostRecord) =>
      new Promise<number>((resolve) => {
        connection.onClientJoined((clientId) => devices.serve(connection, record, clientId));
        connection.onClientData(devices.deliver);
        connection.onClientLeft(devices.left);
        connection.onClose((code) => {
          devices.endAll();
          resolve(code);
        });
        void runPlain(state.setStatus("Connected")).catch(reportFailure);
      });

    const keepConnected = async () => {
      let retry = firstRetryMillis;
      while (!isStopped) {
        const generation = state.generation();
        try {
          const record = state.record();
          if (record === null || isOff(record)) {
            await runPlain(state.setStatus("Off"));
            await pause(longestRetryMillis, generation);
            retry = firstRetryMillis;
            continue;
          }
          await runPlain(state.setStatus("Connecting"));
          const relayOrigin = await run(relayOriginOf(record));
          const connected = await connectHost({ claim: record.claimSecret, relayOrigin, room: record.room });
          if (!connected.ok) {
            await runPlain(state.setStatus("Unreachable"));
            await pause(retry, generation);
            retry = Math.min(retry * 2, longestRetryMillis);
            continue;
          }
          retry = firstRetryMillis;
          const connection = connected.value;
          current = connection;
          // The switch may have gone off while the relay was answering; a connection made then must not serve anyone.
          if (isStopped || !state.attachRelay(connection, generation)) {
            connection.close();
            current = null;
            continue;
          }
          const code = await hold(connection, record);
          current = null;
          if (isStopped) break;
          // Claimed by another host: wait longer than for a dropped connection. Switched off: say so at once.
          const isRefused = code === closeCodes.claimMismatch;
          const isNowOff = isOff(state.record());
          await runPlain(state.setStatus(isNowOff ? "Off" : isRefused ? "Unreachable" : "Connecting"));
          await pause(isRefused ? longestRetryMillis : isNowOff ? 0 : firstRetryMillis, generation);
        } catch (reason) {
          current?.close();
          current = null;
          devices.endAll();
          if (isStopped) break;
          reportFailure(reason);
          await runPlain(state.setStatus("Unreachable")).catch(reportFailure);
          await pause(longestRetryMillis, generation);
        }
      }
    };

    yield* Effect.acquireRelease(
      Effect.sync(() => void keepConnected().catch(reportFailure)),
      () =>
        Effect.sync(() => {
          isStopped = true;
          stopListening();
          state.closeAll();
          current?.close();
          wake?.();
        }),
    );
  }),
);
