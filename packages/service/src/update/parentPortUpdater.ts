import { type UpdaterCall, UpdaterReply, type UpdaterStatus } from "@outlore/contracts";
import { Deferred, type Duration, Effect, Layer, Schema } from "effect";
import { HostUpdater, type InstallOutcome } from "./hostUpdater.ts";

/** What the service holds of the utility process's parent port: it posts calls and hears the main process's answers. */
export interface UpdaterPort {
  /** Hears each message the main process sends; one listener. */
  onMessage(listener: (message: unknown) => void): void;
  postMessage(message: unknown): void;
}

const decodeReply = Schema.decodeUnknownOption(UpdaterReply);

/** How long the main process has to say where the update stands before the host reports that it cannot update. */
const stateSeconds = 5;
/** A check downloads a release, which takes minutes on a slow line. */
const checkMinutes = 30;
/** An install that is answered with nothing is the host quitting: the main process ends the service as it swaps. */
const installSeconds = 8;

/**
 * The host's updater when the service runs as the desktop app's utility process: each call goes to the main process,
 * which owns the updater, and its answer comes back on the same identifier.
 */
export const parentPortUpdaterLayer = (port: UpdaterPort) =>
  Layer.sync(HostUpdater, () => {
    const waiting = new Map<string, (reply: UpdaterReply) => void>();
    port.onMessage((message) => {
      const reply = decodeReply(message);
      if (reply._tag === "None") return;
      waiting.get(reply.value.id)?.(reply.value);
    });
    /** Posts a call and waits for its answer; null when none comes in time. */
    const ask = (call: UpdaterCall["call"], timeout: Duration.Input) =>
      Effect.gen(function* () {
        const id = crypto.randomUUID();
        const answered = yield* Deferred.make<UpdaterReply>();
        waiting.set(id, (reply) => Deferred.doneUnsafe(answered, Effect.succeed(reply)));
        yield* Effect.sync(() => port.postMessage({ call, id, type: "updater" } satisfies UpdaterCall));
        return yield* Deferred.await(answered).pipe(
          Effect.timeoutOption(timeout),
          Effect.map((reply) => (reply._tag === "Some" ? reply.value : null)),
          Effect.ensuring(Effect.sync(() => waiting.delete(id))),
        );
      });
    const statusOf = (call: UpdaterCall["call"], timeout: Duration.Input) =>
      ask(call, timeout).pipe(
        Effect.map((reply): UpdaterStatus => {
          if (reply === null) return { _tag: "Unsupported", reason: "The desktop app did not answer about updates." };
          if (reply.error !== null) return { _tag: "Failed", message: reply.error };
          return reply.status ?? { _tag: "Unsupported", reason: "The desktop app gave no update state." };
        }),
      );
    return {
      check: statusOf("check", `${checkMinutes} minutes`),
      install: ask("install", `${installSeconds} seconds`).pipe(
        Effect.map((reply): InstallOutcome => ({ failure: reply?.error ?? null })),
      ),
      state: statusOf("state", `${stateSeconds} seconds`),
    };
  });
