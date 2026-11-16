import {
  type ClientFrame,
  ClientFrameJson,
  type RequestSource,
  Results,
  type ServerFrame,
  ServerFrameJson,
  sourceRulesOf,
} from "@outlore/contracts";
import { Effect, Exit, Schema } from "effect";
import { type ServiceFailure, textFieldOf } from "../core/index.ts";

const decodeClientFrame = Schema.decodeUnknownExit(ClientFrameJson);
/** Encodes one server frame as the text the wire carries. */
export const encodeServerFrame = Schema.encodeSync(ServerFrameJson);

/** Best effort: answers a malformed frame on its identifier when one can be read. */
const frameIdOf = (raw: string) => {
  try {
    return textFieldOf(JSON.parse(raw), "id");
  } catch {
    return null;
  }
};

/** The first typed failure of an exit's cause, when its first reason is one. */
const firstFailureOf = (exit: Exit.Exit<unknown, ServiceFailure>) => {
  if (Exit.isSuccess(exit)) return null;
  const reason = exit.cause.reasons[0];
  return reason !== undefined && reason._tag === "Fail" ? reason.error : null;
};

/** A Failure frame on the frame's identifier, carrying the error's kind and message. */
const failureFrame = (id: string, kind: ServiceFailure["kind"], message: string): ServerFrame => ({
  _tag: "Failure",
  error: { kind, message },
  id,
});

/** What serves requests: the service's `handle`, told whether a paired device asks. */
export type Handle = (request: ClientFrame["request"], source: RequestSource) => Effect.Effect<unknown, ServiceFailure>;

/** Runs one request frame and sends its answer, as a Success or a Failure carrying the frame's identifier. */
const answerFrame = (handle: Handle, frame: ClientFrame, send: (frame: ServerFrame) => void, source: RequestSource) =>
  handle(frame.request, source).pipe(
    Effect.map((value) =>
      Schema.encodeUnknownSync(Results[frame.request._tag] as unknown as Schema.Codec<unknown>)(value),
    ),
    Effect.exit,
    Effect.map((exit) => {
      if (Exit.isSuccess(exit)) {
        send({ _tag: "Success", id: frame.id, value: exit.value });
        return;
      }
      const failure = firstFailureOf(exit);
      send(
        failureFrame(
          frame.id,
          failure?.kind ?? "ExecutionFailure",
          failure?.message ?? "The service failed unexpectedly.",
        ),
      );
    }),
  );

/**
 * Decodes one client text frame and answers it through `send`. A malformed frame is answered as InvalidInput when
 * its identifier can be read; a request only the host may make is refused when it comes from a paired device.
 */
export const answerText = (
  handle: Handle,
  raw: string,
  send: (frame: ServerFrame) => void,
  source: RequestSource,
): Effect.Effect<void> => {
  const decoded = decodeClientFrame(raw);
  if (Exit.isSuccess(decoded)) {
    const frame = decoded.value;
    if (source.isPairedDevice && sourceRulesOf(frame.request).isHostOnly) {
      return Effect.sync(() => send(failureFrame(frame.id, "AccessRefused", "Only the host itself can do this.")));
    }
    return answerFrame(handle, frame, send, source);
  }
  const id = frameIdOf(raw);
  return Effect.sync(() => {
    if (id !== null) send(failureFrame(id, "InvalidInput", "Invalid request."));
  });
};
