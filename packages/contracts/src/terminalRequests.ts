import { Schema } from "effect";

/** One open conversation shell, as its conversation sees it: where it starts, whether it runs, and its retained output. */
export const TerminalSession = Schema.Struct({
  /** The folder the shell started in, as the server resolved it. */
  cwd: Schema.String,
  /** The process exit code once the shell or command has ended; absent or null while running or unknown. */
  exitCode: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  isRunning: Schema.Boolean,
  /** The replay buffer the conversation reopens with; at most the latest 200,000 characters. */
  output: Schema.String,
  /** The sequence of its last output chunk, so reordered frames are dropped. */
  sequence: Schema.Number,
});
export type TerminalSession = typeof TerminalSession.Type;

/**
 * A conversation's shell identifier, as the app names it: the thread and its starting folder, with the scope the
 * asking screen runs in (`host:` or `remote:`) added by the client, since the host's window and paired devices keep
 * separate shells.
 */
export const TerminalId = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(4096));
export type TerminalId = typeof TerminalId.Type;

/**
 * Starts the conversation's shell in the given folder, or the owner's home when null, and returns the shell already
 * open there instead of restarting it (conversation-terminal).
 */
export const OpenTerminal = Schema.TaggedStruct("OpenTerminal", {
  /** The absolute folder the shell starts in; the owner's home when null. */
  cwd: Schema.NullOr(Schema.String),
  id: TerminalId,
});
/** Sends the owner's input to the open shell, control characters included. */
export const WriteTerminalInput = Schema.TaggedStruct("WriteTerminalInput", {
  data: Schema.String.check(Schema.isMaxLength(1000000)),
  id: TerminalId,
});
/** Keeps the pseudo-terminal's dimensions aligned with its visible surface. */
export const ResizeTerminal = Schema.TaggedStruct("ResizeTerminal", {
  cols: Schema.Number,
  id: TerminalId,
  rows: Schema.Number,
});
/** Ends the open shell and discards its replay buffer. */
export const CloseTerminal = Schema.TaggedStruct("CloseTerminal", { id: TerminalId });
