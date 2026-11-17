import { type Effect, Schema } from "effect";

// What a Code Mode run is given and gives back (ADR 0023).

/** A connector call that failed or was refused; its message is thrown into the code as an `Error`. */
export class CodeCallFailure extends Schema.TaggedError<CodeCallFailure>()("CodeCallFailure", {
  message: Schema.String,
}) {}

/** One function the code may call, given the code's single argument as plain data. */
export type CodeFunction = (input: unknown) => Effect.Effect<unknown, CodeCallFailure>;

/** The functions the code reaches as `connectors.<namespace>.<name>(input)`. */
export type CodeFunctions = Readonly<Record<string, Readonly<Record<string, CodeFunction>>>>;

/** What one run may use. */
export type CodeLimits = {
  /** Time spent running the code, not waiting for calls. */
  readonly cpuMillis: number;
  readonly maxCalls: number;
  /** Characters kept of what the code logs. */
  readonly maxLogCharacters: number;
  readonly memoryBytes: number;
  readonly stackBytes: number;
};

/** The limits of a thread's run (ADR 0023): short glue between connector calls, not computation. */
export const defaultCodeLimits: CodeLimits = {
  cpuMillis: 5_000,
  maxCalls: 200,
  maxLogCharacters: 8_000,
  memoryBytes: 64 * 1024 * 1024,
  stackBytes: 1024 * 1024,
};

/** How a run ended: the value it returned, as plain data, or the error it ended with, in plain words. */
export type CodeOutcome =
  | { readonly _tag: "Returned"; readonly value: unknown }
  | { readonly _tag: "Failed"; readonly message: string };

/** A finished run. */
export type CodeRun = {
  readonly callCount: number;
  readonly logs: ReadonlyArray<string>;
  readonly outcome: CodeOutcome;
};
