import {
  hostLinkCodes,
  isLocalOrigin,
  LinkFailure,
  type LinkSettings,
  type PairedHostStore,
  pairWithCode,
  resumeHost,
} from "@outlore/controller";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { ServiceFailure } from "../core/index.ts";
import { RemoteConfig, type RemoteSettings } from "./config.ts";
import { readHostLink, saveHost, touchHost } from "./knownHosts.ts";

/** What an open link to a host offers the loopback bridge. */
export interface HostChannel {
  close(): void;
  readonly hostName: string;
  onClose(listener: () => void): void;
  onText(listener: (text: string) => void): void;
  sendText(text: string): void;
}

const storedHosts = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const runStored = <Value, Error>(work: Effect.Effect<Value, Error, SqlClient.SqlClient>) =>
    Effect.runPromise(work.pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie));
  return {
    link: (id) => runStored(readHostLink(id)),
    save: (host, now) => runStored(saveHost(host, now)),
    touch: (id, name, now) => runStored(touchHost(id, name, now)),
  } satisfies PairedHostStore;
});

class ControllerFailure extends ServiceFailure {
  readonly closeCode: number;
  constructor(cause: unknown) {
    super({
      kind:
        cause instanceof LinkFailure
          ? (
              {
                couldNotOpen: "ExecutionFailure",
                invalid: "InvalidInput",
                noSuchHost: "NotFound",
                otherRelease: "AccessRefused",
                refused: "AccessRefused",
              } as const
            )[cause.kind]
          : "ExecutionFailure",
      message: cause instanceof Error ? cause.message : "Could not reach the relay. Check your internet connection.",
    });
    // The transport's close codes (linkCodeOf in @outlore/controller maps each LinkFailure kind to one of these).
    this.closeCode =
      cause instanceof LinkFailure && cause.kind === "otherRelease"
        ? hostLinkCodes.otherRelease
        : cause instanceof LinkFailure && (cause.kind === "noSuchHost" || cause.kind === "refused")
          ? hostLinkCodes.refused
          : hostLinkCodes.couldNotOpen;
  }
}
const failureOf = (cause: unknown) => new ControllerFailure(cause);

/** The link settings both controller calls send: this desktop's release, local relay left to the origin. */
const linkOptionsOf = (config: RemoteSettings, signal: AbortSignal): LinkSettings => ({
  allowLocalRelay: isLocalOrigin(config.relayOrigin),
  kind: "desktop",
  release: config.release,
  signal,
});

/** Pairs this desktop app through the shared controller protocol and the SQLite store. */
export const pairWithHost = Effect.fn("pairWithHost")(function* (code: string, deviceName: string) {
  const config = yield* RemoteConfig;
  const store = yield* storedHosts;
  return yield* Effect.tryPromise({
    catch: failureOf,
    try: (signal) => pairWithCode(code, deviceName, store, linkOptionsOf(config, signal)),
  });
});

/** Resumes a desktop link, retaining host frames until the loopback bridge listens. */
export const openHostChannel = Effect.fn("openHostChannel")(function* (hostId: string) {
  const config = yield* RemoteConfig;
  const store = yield* storedHosts;
  const opened = yield* Effect.tryPromise({
    catch: failureOf,
    try: (signal) => resumeHost(store, hostId, linkOptionsOf(config, signal)),
  });
  return {
    close: () => opened.channel.close(),
    hostName: opened.hostName,
    onClose: (listener) => opened.channel.onClose(listener),
    onText: opened.listen,
    sendText: (text) => opened.channel.sendText(text),
  } satisfies HostChannel;
});
