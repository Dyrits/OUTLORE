import { closeCodes, connectHost, type HostConnection } from "@outlore/relay";
import { Clock, Deferred, Effect, Layer, Schedule, Schema } from "effect";
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
/** A connection that held this long was healthy: what ended it starts the backoff over. */
const steadyMillis = 30_000;

/** Why a pass ended: the relay could not be reached, dropped the connection, held it for another host, or failed. */
class Disconnected extends Schema.TaggedError<Disconnected>()("Disconnected", {
  reason: Schema.Literals(["claimed", "dropped", "failed", "unreachable"]),
}) {}

/**
 * How long to wait between passes: 1 s, doubling to 30 s while connections keep ending, and 30 s at once when another
 * host holds the room or the service itself failed, so two installations sharing an identity do not take turns.
 */
const backoff = Schedule.min([Schedule.exponential(firstRetryMillis), Schedule.spaced(longestRetryMillis)]).pipe(
  Schedule.setInputType<Disconnected>(),
  Schedule.modifyDelay(({ duration, input }) =>
    Effect.succeed(input.reason === "claimed" || input.reason === "failed" ? longestRetryMillis : duration),
  ),
);

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
    const runFork = Effect.runForkWith(context);
    const withParts = <Value, Error>(effect: Effect.Effect<Value, Error, SqlClient.SqlClient | RemoteConfig>) =>
      effect.pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.provideService(RemoteConfig, config));
    const run: RunWork = (effect) => runPlain(withParts(effect));
    const runInTransaction: RunWork = (effect) => runPlain(withParts(sql.withTransaction(effect)));

    const devices = createDeviceServer({
      addSession: (send) => sessions.add(send),
      admitDevice: (id, close) =>
        runPlain(state.admitDevice(id, close).pipe(Effect.provideService(SqlClient.SqlClient, sql))),
      announce: () => void runPlain(changes.publish).catch(reportFailure),
      answer: (message, send, deviceId) =>
        void runPlain(answerText(service.handle, message, send, { deviceId, isPairedDevice: true })).catch(
          reportFailure,
        ),
      isAccepting: () => state.record()?.isEnabled ?? false,
      run,
      runInTransaction,
    });

    /** Holds one connection to the relay until it ends; the code it ended with. Interrupting it closes everything. */
    const hold = (connection: HostConnection, record: HostRecord) =>
      Effect.gen(function* () {
        const ended = Deferred.makeUnsafe<number>();
        connection.onClientJoined((clientId) => void runFork(devices.serve(connection, record, clientId)));
        connection.onClientData(devices.deliver);
        connection.onClientLeft(devices.left);
        connection.onClose((code) => {
          devices.endAll();
          Deferred.doneUnsafe(ended, Effect.succeed(code));
        });
        yield* state.setStatus("Connected");
        return yield* Deferred.await(ended).pipe(
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              connection.close();
              devices.endAll();
            }),
          ),
        );
      });

    /** Anything this loop did not foresee is reported and waited out like a refusal. */
    const unforeseen = (reason: unknown) =>
      Effect.sync(() => reportFailure(reason)).pipe(
        Effect.andThen(state.setStatus("Unreachable")),
        Effect.andThen(Effect.fail(new Disconnected({ reason: "failed" }))),
      );

    /**
     * One pass: connect, hold the connection until it ends, then fail with why, so that the retry schedule waits.
     * Returns instead when the switch went off, or the connection had held long enough to count as a fresh start.
     */
    const connectedSession = (record: HostRecord, generation: number) =>
      Effect.gen(function* () {
        yield* state.setStatus("Connecting");
        const relayOrigin = yield* withParts(relayOriginOf(record));
        return yield* Effect.acquireUseRelease(
          connectHost({ claim: record.claimSecret, relayOrigin, room: record.room }).pipe(
            Effect.tapError(() => state.setStatus("Unreachable")),
            Effect.mapError(() => new Disconnected({ reason: "unreachable" })),
          ),
          Effect.fnUntraced(function* (connection) {
            // The switch may have gone off while the relay was answering; a connection made then must not serve anyone.
            if (!state.attachRelay(connection, generation)) return;
            const startedAt = yield* Clock.currentTimeMillis;
            const code = yield* hold(connection, record);
            // Claimed by another host, replaced by one, or limited by the relay: wait longer than for a dropped
            // connection (the relay's limits count a minute; its own limit must not be fed by this retry). Switched
            // off: say so at once.
            const isClaimed =
              code === closeCodes.claimMismatch || code === closeCodes.replaced || code === closeCodes.rateLimited;
            const isNowOff = isOff(state.record());
            yield* state.setStatus(isNowOff ? "Off" : isClaimed ? "Unreachable" : "Connecting");
            if (isNowOff) return;
            const heldMillis = (yield* Clock.currentTimeMillis) - startedAt;
            if (heldMillis >= steadyMillis && !isClaimed) return yield* Effect.sleep(firstRetryMillis);
            return yield* new Disconnected({ reason: isClaimed ? "claimed" : "dropped" });
          }),
          (connection) => Effect.sync(() => connection.close()),
        );
      }).pipe(
        Effect.catch((error) => (error instanceof Disconnected ? Effect.fail(error) : unforeseen(error))),
        Effect.catchDefect(unforeseen),
      );

    /** Resolves when the host's settings changed since `generation`: a new pass starts at once, with a fresh backoff. */
    const settingsChanged = (generation: number) =>
      Effect.callback<void>((resume) => {
        if (state.generation() !== generation) {
          resume(Effect.void);
          return;
        }
        const stop = state.onPoke(() => {
          if (state.generation() !== generation) resume(Effect.void);
        });
        return Effect.sync(stop);
      });

    const keepConnected = Effect.suspend(() => {
      const generation = state.generation();
      const record = state.record();
      const pass =
        record === null || isOff(record)
          ? // Nothing to keep up: wait, without a timer, for the settings to change.
            state.setStatus("Off").pipe(Effect.andThen(Effect.never))
          : connectedSession(record, generation).pipe(Effect.retry(backoff), Effect.ignore);
      return pass.pipe(Effect.raceFirst(settingsChanged(generation)));
    }).pipe(Effect.forever);

    yield* Effect.forkScoped(keepConnected);
    yield* Effect.addFinalizer(() => Effect.sync(() => state.closeAll()));
  }),
);
