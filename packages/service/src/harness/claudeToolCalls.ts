import { Effect } from "effect";
import { fileChangeOf } from "../core/fileChanges.ts";
import type { HarnessEvent } from "../core/index.ts";

type ToolCall = Extract<HarnessEvent, { _tag: "ToolCall" }>;

/** Captures the edit when Claude Code reports a tool call, before a whole-file Write can lose its previous text. */
export const claudeToolCallOf = Effect.fnUntraced(function* (call: Omit<ToolCall, "_tag" | "fileEdit">, cwd: string) {
  const change = yield* fileChangeOf(call.toolName, call.input, cwd);
  return { _tag: "ToolCall", ...call, ...(change === null ? {} : { fileEdit: { change } }) } satisfies ToolCall;
});
