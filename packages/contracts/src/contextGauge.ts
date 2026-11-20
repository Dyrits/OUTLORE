import { Schema } from "effect";

/** What fills a thread's context window (thread-panel, The context gauge). */
export const ContextPartKind = Schema.Literals(["Instructions", "Lore", "Journal", "Messages", "ToolsAndResults"]);
export type ContextPartKind = typeof ContextPartKind.Type;

/** One part of a thread's context and its tokens. */
export const ContextPart = Schema.Struct({ kind: ContextPartKind, tokens: Schema.Number });
export type ContextPart = typeof ContextPart.Type;

/** How full a thread's context window is and what fills it (thread-panel, The context gauge). */
export const ContextGauge = Schema.Struct({
  /**
   * Whether the limit is the soft limit all models are held to rather than the model's own window: the model reports
   * a larger window, and the thread keeps working past the limit. Absent from a service older than the soft limit.
   */
  isSoftLimit: Schema.optionalKey(Schema.Boolean),
  /** What fills the context, in the order the gauge draws it; the tokens add up to `tokens`. */
  parts: Schema.Array(ContextPart),
  /** What the harness reported for the thread's latest model call: its input, cached input, and output. */
  tokens: Schema.Number,
  /** The context limit in tokens: the chosen model's reported window, or the soft limit when that is smaller. */
  windowTokens: Schema.Number,
});
export type ContextGauge = typeof ContextGauge.Type;
