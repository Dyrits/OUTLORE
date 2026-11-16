import {
  isLocalOrigin,
  type LinkFailure,
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

const failureOf = (failure: LinkFailure) =>
  new ServiceFailure({
    kind: (
      {
        couldNotOpen: "ExecutionFailure",
        invalid: "InvalidInput",
        noSuchHost: "NotFound",
        otherRelease: "AccessRefused",
        refused: "AccessRefused",
      } as const
    )[failure.kind],
    message: failure.message,
  });

/** The link settings both controller calls send: this desktop's release, local relay left to the origin. */
const linkOptionsOf = (config: RemoteSettings): LinkSettings => ({
  allowLocalRelay: isLocalOrigin(config.relayOrigin),
  kind: "desktop",
  release: config.release,
});

/** Pairs this desktop app through the shared controller protocol and the SQLite store. */
export const pairWithHost = Effect.fn("pairWithHost")(function* (code: string, deviceName: string) {
  const config = yield* RemoteConfig;
  const store = yield* storedHosts;
  return yield* pairWithCode(code, deviceName, store, linkOptionsOf(config)).pipe(Effect.mapError(failureOf));
});

/** Resumes a desktop link, retaining host frames until the loopback bridge listens. */
export const openHostChannel = Effect.fn("openHostChannel")(function* (hostId: string) {
  const config = yield* RemoteConfig;
  const store = yield* storedHosts;
  const opened = yield* resumeHost(store, hostId, linkOptionsOf(config));
  return {
    close: () => opened.channel.close(),
    hostName: opened.hostName,
    onClose: (listener) => opened.channel.onClose(listener),
    onText: opened.listen,
    sendText: (text) => opened.channel.sendText(text),
  } satisfies HostChannel;
});
