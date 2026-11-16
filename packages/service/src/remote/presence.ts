import type { RelayStatus } from "@outlore/contracts";
import type { HostConnection } from "@outlore/relay";
import { Context, Effect, Layer, type Stream, SubscriptionRef } from "effect";
import type { SqlClient, SqlError } from "effect/sql";
import { Changes } from "../core/index.ts";
import { type HostRecord, isDevicePaired, readHostRecord } from "./hostAccess.ts";

/**
 * What the host runtime shows the rest of the service: how its relay connection stands, which devices are
 * connected, and the two ways to reach it (to disconnect a device, and to say "look at the settings again").
 */
export class HostPresence extends Context.Service<
  HostPresence,
  {
    /** The last committed host access record; refreshed by access and relay commands. */
    readonly record: () => HostRecord | null;
    /** Changes whenever access or the effective relay changes, invalidating pending connections. */
    readonly generation: () => number;
    /** Applies committed settings, ending stale connections and waking the loop. */
    readonly refresh: (defaultRelayOrigin: string) => Effect.Effect<void, SqlError.SqlError, SqlClient.SqlClient>;
    /** Adopts a relay only if its settings are still current. */
    readonly attachRelay: (connection: HostConnection, generation: number) => boolean;
    /** Registers and rechecks an authenticated device within the current access generation. */
    readonly admitDevice: (
      deviceId: string,
      close: () => void,
    ) => Effect.Effect<(() => void) | null, SqlError.SqlError, SqlClient.SqlClient>;
    /** Current status followed by later transitions, without polling. */
    readonly statusChanges: Stream.Stream<RelayStatus>;
    /** Ends one device's connection, if it has one. */
    readonly closeDevice: (deviceId: string) => void;
    /** The devices connected now. */
    readonly connectedDevices: () => ReadonlySet<string>;
    /** Closes every device's connection, as turning "Allow paired devices" off does. */
    readonly closeAll: () => void;
    /** Subscribes to committed access or relay changes, waking the connection loop. */
    readonly onPoke: (listener: () => void) => () => void;
    readonly setStatus: (status: RelayStatus) => Effect.Effect<void>;
    readonly status: Effect.Effect<RelayStatus>;
  }
>()("outlore/HostPresence") {}

/** Live host access and connection registry, initialized from stored settings. */
export const hostPresenceLayer = Layer.effect(
  HostPresence,
  Effect.gen(function* () {
    const changes = yield* Changes;
    const status = yield* SubscriptionRef.make<RelayStatus>("Off");
    let record = yield* readHostRecord;
    let generation = 0;
    let relay: HostConnection | null = null;
    const devices = new Map<string, () => void>();
    const pokes = new Set<() => void>();
    const closeAll = () => {
      for (const close of [...devices.values()]) close();
    };
    const connected = (deviceId: string, close: () => void) => {
      devices.get(deviceId)?.();
      devices.set(deviceId, close);
      return () => {
        if (devices.get(deviceId) === close) devices.delete(deviceId);
      };
    };
    const setStatus = (next: RelayStatus) =>
      SubscriptionRef.getAndSet(status, record?.isEnabled ? next : "Off").pipe(
        Effect.flatMap((before) => (before === (record?.isEnabled ? next : "Off") ? Effect.void : changes.publish)),
      );
    return {
      admitDevice: Effect.fnUntraced(function* (deviceId: string, close: () => void) {
        if (!record?.isEnabled) return null;
        const expected = generation;
        const remove = connected(deviceId, close);
        const isPaired = yield* isDevicePaired(deviceId).pipe(
          Effect.onError(() =>
            Effect.sync(() => {
              remove();
              close();
            }),
          ),
        );
        if (!isPaired || !record?.isEnabled || generation !== expected) {
          remove();
          close();
          return null;
        }
        return remove;
      }),
      attachRelay: (connection: HostConnection, expected: number) => {
        if (!record?.isEnabled || generation !== expected) {
          connection.close();
          return false;
        }
        relay = connection;
        return true;
      },
      closeAll,
      closeDevice: (deviceId: string) => devices.get(deviceId)?.(),
      connectedDevices: () => new Set(devices.keys()),
      generation: () => generation,
      onPoke: (listener: () => void) => {
        pokes.add(listener);
        return () => void pokes.delete(listener);
      },
      record: () => record,
      refresh: Effect.fnUntraced(function* (defaultRelayOrigin: string) {
        const next = yield* readHostRecord;
        const hasChanged =
          next?.isEnabled !== record?.isEnabled ||
          (next?.relayOrigin ?? defaultRelayOrigin) !== (record?.relayOrigin ?? defaultRelayOrigin);
        record = next;
        if (!hasChanged) return;
        generation += 1;
        closeAll();
        relay?.close();
        relay = null;
        yield* setStatus(record?.isEnabled ? "Connecting" : "Off");
        for (const listener of [...pokes]) listener();
      }),
      setStatus,
      status: SubscriptionRef.get(status),
      statusChanges: SubscriptionRef.changes(status),
    };
  }),
);
