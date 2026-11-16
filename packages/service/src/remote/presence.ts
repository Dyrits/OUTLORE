import { encodePairingCode } from "@outlore/channel";
import type { RelayStatus } from "@outlore/contracts";
import type { HostConnection } from "@outlore/relay";
import { Clock, Context, Effect, Layer, type Stream, SubscriptionRef } from "effect";
import type { SqlClient, SqlError } from "effect/sql";
import { Changes, invalid, ServiceFailure } from "../core/index.ts";
import { RemoteConfig } from "./config.ts";
import {
  ensureHostRecord,
  forgetDevice,
  type HostRecord,
  isDevicePaired,
  makePairingSecret,
  readHostRecord,
  relayOriginOf,
  remoteAccessView,
  setRelayOrigin,
  setRemoteAccess,
} from "./hostAccess.ts";

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
      admitDevice: (deviceId: string, close: () => void) =>
        Effect.gen(function* () {
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
      refresh: (defaultRelayOrigin: string) =>
        Effect.gen(function* () {
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

/** Runs storage work as one command, announcing the change; the service's own runner is handed in. */
export type StoreChange = <Value, Error, Requirements>(
  work: Effect.Effect<Value, Error, Requirements>,
) => Effect.Effect<Value, Error | SqlError.SqlError, Exclude<Requirements, SqlClient.SqlClient>>;

/**
 * Host access: whether paired devices may reach this host, which relay it uses, and which devices it has paired. It
 * owns the order the pieces need (write the stored record, tell the running host, read the view back), so callers
 * ask for the outcome and never poke the runtime themselves; "off, or moved to another relay" is settled here.
 */
export const makeHostControl = (dependencies: {
  readonly change: StoreChange;
  readonly config: RemoteConfig["Service"];
  readonly state: HostPresence["Service"];
}) => {
  const { change, config, state } = dependencies;
  const withConfig = <Value, Error>(work: Effect.Effect<Value, Error, SqlClient.SqlClient | RemoteConfig>) =>
    Effect.provideService(work, RemoteConfig, config);
  /** Charter's remote access section as it stands. */
  const view = Effect.flatMap(state.status, (status) => withConfig(remoteAccessView(status, state.connectedDevices())));
  /**
   * Uses the relay at `origin` (the shared one when null). When the address changes, devices are disconnected and the
   * host reconnects through the new relay if pairing is on; the same address means a relay updated where it stands,
   * which changes nothing.
   */
  const useRelay = (origin: string | null) =>
    Effect.gen(function* () {
      yield* change(setRelayOrigin(origin));
      yield* state.refresh(config.relayOrigin);
    });
  return {
    /** Makes a pairing code that works once, for ten minutes, naming this host's room on the relay. */
    createPairingCode: withConfig(
      Effect.gen(function* () {
        const record = yield* ensureHostRecord;
        const { expiresAt, secret } = yield* makePairingSecret(yield* Clock.currentTimeMillis);
        const code = encodePairingCode({
          hostPublicKey: record.publicKey,
          relayOrigin: yield* relayOriginOf(record),
          room: record.room,
          secret,
        });
        return { code, expiresAt };
      }),
    ),
    /** Forgets a paired device and ends its connection, then shows the section. */
    disconnectDevice: (deviceId: string) =>
      change(forgetDevice(deviceId)).pipe(
        Effect.tap(() => Effect.sync(() => state.closeDevice(deviceId))),
        Effect.andThen(view),
      ),
    /** Persists the access switch, then updates presence before returning the view. */
    setAccess: (isEnabled: boolean) =>
      change(setRemoteAccess(isEnabled)).pipe(
        Effect.tap(() => state.refresh(config.relayOrigin)),
        Effect.andThen(view),
      ),
    /** Deploys the relay to the user's own Cloudflare account and uses it. The token is used once and kept nowhere. */
    useOwnRelay: (token: string) =>
      Effect.gen(function* () {
        const trimmed = token.trim();
        if (trimmed === "") return yield* invalid("Paste the Cloudflare API token first.");
        const result = yield* Effect.promise(() => config.deployOwnRelay(trimmed));
        if (!result.ok) return yield* new ServiceFailure({ kind: "ExecutionFailure", message: result.message });
        yield* useRelay(result.origin);
        return yield* view;
      }),
    /** Goes back to the shared relay. */
    useSharedRelay: () => useRelay(null).pipe(Effect.andThen(view)),
    view,
  };
};
