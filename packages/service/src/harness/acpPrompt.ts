import { Deferred, Effect, Option, Queue, type Result } from "effect";
import type { HarnessFailure } from "../core/index.ts";
import type { RpcIncoming, RpcProcess } from "./lineProcess.ts";

/** Sends one ACP prompt and drains updates before returning the response to its harness. */
export const readAcpPrompt = Effect.fnUntraced(function* (
  rpc: RpcProcess,
  sessionId: string,
  text: string,
  images: ReadonlyArray<{ readonly data: string; readonly mediaType: string }>,
  read: (incoming: RpcIncoming) => Effect.Effect<void, HarnessFailure>,
) {
  const answer = yield* Deferred.make<Result.Result<unknown, HarnessFailure>>();
  yield* Effect.forkChild(
    rpc
      .request("session/prompt", {
        prompt: [
          { text, type: "text" },
          ...images.map((image) => ({ data: image.data, mimeType: image.mediaType, type: "image" })),
        ],
        sessionId,
      })
      .pipe(
        Effect.result,
        Effect.flatMap((result) => Deferred.succeed(answer, result)),
      ),
  );
  for (;;) {
    const next = yield* Effect.raceFirst(
      Queue.take(rpc.incoming).pipe(Effect.map(Option.some)),
      Deferred.await(answer).pipe(Effect.as(Option.none<RpcIncoming>())),
    );
    if (Option.isSome(next)) {
      yield* read(next.value);
      continue;
    }
    // ACP sends the updates before the response, but the reader may still have them queued.
    for (const incoming of yield* Queue.clear(rpc.incoming)) yield* read(incoming);
    return yield* Deferred.await(answer);
  }
});
