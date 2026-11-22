import { Schema } from "effect";
import { ThreadId } from "./ids.ts";
import { Request, ServiceError } from "./requests.ts";

// Frames on the loopback WebSocket

/** A request from the app, with the identifier its answer carries back. */
export const ClientFrame = Schema.Struct({ id: Schema.String, request: Request });
export type ClientFrame = typeof ClientFrame.Type;

/** A request's answer. */
export const Success = Schema.TaggedStruct("Success", { id: Schema.String, value: Schema.Unknown });
/** A request's failure, as the app shows it. */
export const Failure = Schema.TaggedStruct("Failure", { error: ServiceError, id: Schema.String });
/** Sent after each committed change; clients refetch what they show. */
export const Changed = Schema.TaggedStruct("Changed", { sequence: Schema.Number });

/** The reply a thread is writing, sent only while "Show replies as they're written" is on; never saved. */
export const Draft = Schema.TaggedStruct("Draft", { text: Schema.String, threadId: ThreadId });

/** One chunk of output from a conversation's open shell, sent to every connected screen. */
export const TerminalData = Schema.TaggedStruct("TerminalData", {
  data: Schema.String,
  /** The shell's full session key, scope included, as each screen names it. */
  id: Schema.String,
  /** The session's sequence this chunk carries, so reordered frames are dropped. */
  sequence: Schema.Number,
});
export type TerminalData = typeof TerminalData.Type;
/** An open conversation shell ended; its screen keeps the output it already has. */
export const TerminalExit = Schema.TaggedStruct("TerminalExit", { id: Schema.String });
export type TerminalExit = typeof TerminalExit.Type;

/** What the service sends the app: an answer, a failure, a committed change, a reply being written, or a shell's output. */
export const ServerFrame = Schema.Union([Success, Failure, Changed, Draft, TerminalData, TerminalExit]);
export type ServerFrame = typeof ServerFrame.Type;

/** A client frame as JSON text on the WebSocket. */
export const ClientFrameJson = Schema.fromJsonString(ClientFrame);
/** A server frame as JSON text on the WebSocket. */
export const ServerFrameJson = Schema.fromJsonString(ServerFrame);
