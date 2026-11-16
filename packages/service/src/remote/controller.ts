import { isLocalOrigin, LinkFailure, type PairedHostStore, pairWithCode, resumeHost } from "@outlore/controller";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { ServiceFailure } from "../core/index.ts";
import { RemoteConfig } from "./config.ts";
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
  return {
    link: (id) =>
      Effect.runPromise(readHostLink(id).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie)),
    save: (host, now) =>
      Effect.runPromise(saveHost(host, now).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie)),
    touch: (id, name, now) =>
      Effect.runPromise(touchHost(id, name, now).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie)),
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
    this.closeCode =
      cause instanceof LinkFailure && cause.kind === "otherRelease"
        ? 4003
        : cause instanceof LinkFailure && (cause.kind === "noSuchHost" || cause.kind === "refused")
          ? 4002
          : 4000;
  }
}
const failureOf = (cause: unknown) => new ControllerFailure(cause);

/** Pairs this desktop app through the shared controller protocol and the SQLite store. */
export const pairWithHost = Effect.fn("pairWithHost")(function* (code: string, deviceName: string) {
  const config = yield* RemoteConfig;
  const store = yield* storedHosts;
  return yield* Effect.tryPromise({
    catch: failureOf,
    try: (signal) =>
      pairWithCode(code, deviceName, store, {
        allowLocalRelay: isLocalOrigin(config.relayOrigin),
        kind: "desktop",
        release: config.release,
        signal,
      }),
  });
});

/** Resumes a desktop link, retaining host frames until the loopback bridge listens. */
export const openHostChannel = Effect.fn("openHostChannel")(function* (hostId: string) {
  const config = yield* RemoteConfig;
  const store = yield* storedHosts;
  const opened = yield* Effect.tryPromise({
    catch: failureOf,
    try: (signal) =>
      resumeHost(store, hostId, {
        allowLocalRelay: isLocalOrigin(config.relayOrigin),
        kind: "desktop",
        release: config.release,
        signal,
      }),
  });
  return {
    close: () => opened.channel.close(),
    hostName: opened.hostName,
    onClose: (listener) => opened.channel.onClose(listener),
    onText: opened.listen,
    sendText: (text) => opened.channel.sendText(text),
  } satisfies HostChannel;
});
