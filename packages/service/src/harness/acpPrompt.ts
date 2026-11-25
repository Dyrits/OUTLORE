import { Deferred, Effect, Option, Queue, Result } from "effect";
import type { HarnessFailure, RpcIncoming, RpcProcess } from "../core/index.ts";

type PromptImages = ReadonlyArray<{ readonly data: string; readonly mediaType: string }>;

/** A prompt's answer, by its place in the order the flight sent its prompts. */
type PromptAnswer = { readonly number: number; readonly result: Result.Result<unknown, HarnessFailure> };

/** A prompt asked for while the flight runs, and the signal that tells its asker whether it was sent. */
type PendingSteer = { readonly images: PromptImages; readonly sent: Deferred.Deferred<boolean>; readonly text: string };

/**
 * The prompts of one turn's running stretch: the prompt that opened it and any prompts steered into it (an agent that takes a second prompt as a message into the running one).
 * `readAcpPrompt` runs it; `steerAcpPrompt` asks it for another prompt from outside.
 * All its fields are read and written only by those two, each step without a pause in between, so a prompt asked for is either sent or refused and never lost.
 */
export type AcpPromptFlight = {
  /** Whether the flight's last prompt has been answered: no prompt can be steered in any more. */
  closed: boolean;
  /** Prompts asked for and not yet sent. */
  readonly outbox: Array<PendingSteer>;
  /** How many prompts the flight has sent. */
  sent: number;
  /** Answers received and not yet read. */
  readonly settled: Array<PromptAnswer>;
  /** Signals the flight that an answer or a steered prompt is waiting; replaced each time the flight reads them. */
  wake: Deferred.Deferred<void>;
};

/** An empty flight for one turn's running stretch. */
export const openAcpPromptFlight = (): AcpPromptFlight => ({
  closed: false,
  outbox: [],
  sent: 0,
  settled: [],
  wake: Deferred.makeUnsafe<void>(),
});

/**
 * Asks the running flight to send one more prompt, and returns once it is on its way to the agent (so a cancel sent after it comes after it):
 * true when it was sent; false when the flight has ended, so the prompt must wait for the next turn.
 */
export const steerAcpPrompt = (flight: AcpPromptFlight, text: string, images: PromptImages): Effect.Effect<boolean> =>
  Effect.suspend(() => {
    if (flight.closed) return Effect.succeed(false);
    const sent = Deferred.makeUnsafe<boolean>();
    flight.outbox.push({ images, sent, text });
    return Deferred.succeed(flight.wake, undefined).pipe(Effect.andThen(Deferred.await(sent)));
  });

/** What a flight ended with: the last prompt's answer, and the answers of the prompts it superseded, in the order they came. */
export type AcpPromptEnd = {
  readonly answer: Result.Result<unknown, HarnessFailure>;
  readonly superseded: ReadonlyArray<unknown>;
};

/**
 * Sends one ACP prompt and drains updates before returning the response to its harness.
 * An agent that takes a second prompt as a message into the running one (`steerAcpPrompt`) answers the first `end_turn` and carries on under the second,
 * so the flight ends with its last prompt's answer; `onSuperseded` is told of each earlier answer as it comes.
 * An earlier prompt that fails is not the turn's failure: the later prompt carries the turn.
 */
export const readAcpPrompt = Effect.fnUntraced(function* (
  rpc: RpcProcess,
  sessionId: string,
  text: string,
  images: PromptImages,
  read: (incoming: RpcIncoming) => Effect.Effect<void, HarnessFailure>,
  options: {
    readonly flight?: AcpPromptFlight;
    readonly onSuperseded?: (answer: unknown) => Effect.Effect<void, HarnessFailure>;
  } = {},
) {
  const flight = options.flight ?? openAcpPromptFlight();
  const superseded: Array<unknown> = [];
  /** Sends one prompt; `onSending` is told once the request is written to the process, so a later cancel follows it on the wire. */
  const send = (promptText: string, promptImages: PromptImages, onSending?: Deferred.Deferred<boolean>) => {
    flight.sent += 1;
    const number = flight.sent;
    return Effect.forkChild(
      rpc
        .request("session/prompt", {
          prompt: [
            { text: promptText, type: "text" },
            ...promptImages.map((image) => ({ data: image.data, mimeType: image.mediaType, type: "image" })),
          ],
          sessionId,
        })
        .pipe(
          Effect.result,
          Effect.flatMap((result) =>
            Effect.suspend(() => {
              flight.settled.push({ number, result });
              return Deferred.succeed(flight.wake, undefined);
            }),
          ),
        ),
      // Start synchronously so `rpc.request` writes the JSON-RPC line before `onSending` wakes `steerAcpPrompt`.
      { startImmediately: true },
    ).pipe(Effect.andThen(onSending === undefined ? Effect.void : Deferred.succeed(onSending, true)));
  };
  return yield* Effect.gen(function* () {
    yield* send(text, images);
    for (;;) {
      const next = yield* Effect.raceFirst(
        Queue.take(rpc.incoming).pipe(Effect.map(Option.some)),
        Deferred.await(flight.wake).pipe(Effect.as(Option.none<RpcIncoming>())),
      );
      if (Option.isSome(next)) {
        yield* read(next.value);
        continue;
      }
      // Renewed before anything is read, so what arrives from here on wakes the flight again.
      flight.wake = Deferred.makeUnsafe<void>();
      // ACP sends the updates before the response, but the reader may still have them queued.
      for (const incoming of yield* Queue.clear(rpc.incoming)) yield* read(incoming);
      for (const steer of flight.outbox.splice(0)) {
        yield* send(steer.text, steer.images, steer.sent);
      }
      for (const settled of flight.settled.splice(0)) {
        // The last prompt sent, with none waiting to be sent, ends the flight; the flag is set in the same step, before any prompt can be steered in behind it.
        if (settled.number === flight.sent && flight.outbox.length === 0) {
          flight.closed = true;
          for (const incoming of yield* Queue.clear(rpc.incoming)) yield* read(incoming);
          return { answer: settled.result, superseded } satisfies AcpPromptEnd;
        }
        if (Result.isSuccess(settled.result)) {
          superseded.push(settled.result.success);
          yield* options.onSuperseded?.(settled.result.success) ?? Effect.void;
        }
      }
    }
  }).pipe(
    Effect.ensuring(
      Effect.suspend(() => {
        flight.closed = true;
        // A prompt asked for that was never sent is refused, so its message waits for the next turn.
        return Effect.forEach(flight.outbox.splice(0), (steer) => Deferred.succeed(steer.sent, false), {
          discard: true,
        });
      }),
    ),
  );
});
