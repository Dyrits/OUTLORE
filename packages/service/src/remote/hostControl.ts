import { encodePairingCode } from "@outlore/channel";
import { Clock, Effect } from "effect";
import type { SqlClient, SqlError } from "effect/sql";
import { invalid, ServiceFailure } from "../core/index.ts";
import { RemoteConfig } from "./config.ts";
import {
  ensureHostRecord,
  forgetDevice,
  makePairingSecret,
  relayOriginOf,
  remoteAccessView,
  setRelayOrigin,
  setRemoteAccess,
} from "./hostAccess.ts";
import type { HostPresence } from "./presence.ts";

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
  const useRelay = Effect.fnUntraced(function* (origin: string | null) {
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
    useOwnRelay: Effect.fnUntraced(function* (token: string) {
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
