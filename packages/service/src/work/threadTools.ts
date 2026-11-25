import { Effect, Exit, Schema } from "effect";
import type { ToolAnswer } from "../core/index.ts";
import { chroniclerToolDefinitions } from "./chroniclerToolDefinitions.ts";
import { errandToolDefinitions } from "./errandToolDefinitions.ts";
import { loreToolDefinitions } from "./loreToolDefinitions.ts";
import { ritualToolDefinitions } from "./ritualToolDefinitions.ts";

export { scopeHelp, searchInvalid } from "./loreToolDefinitions.ts";

// The thread tool catalogue (ADR 0005; thread-tree, thread-messaging, mission-journal, mission-tracking,
// action-approval External contracts): each tool is defined once, by its name, description, and argument
// schema, in the file for its kind of tool. Its MCP listing, its argument decoding, and the list Claude Code runs
// without asking all come from that one definition; the tool server carries the calls, and domain modules answer
// them typed.

/** Every thread tool, by name. */
export const threadTools = {
  ...chroniclerToolDefinitions,
  ...errandToolDefinitions,
  ...loreToolDefinitions,
  ...ritualToolDefinitions,
};

/** A thread tool's name. */
export type ThreadToolName = keyof typeof threadTools;

/** The decoded arguments of a thread tool. */
export type ArgumentsOf<Name extends ThreadToolName> = (typeof threadTools)[Name]["schema"]["Type"];

/** Answers one thread tool with its decoded arguments. */
export type ToolHandlers = {
  readonly [Name in ThreadToolName]: (threadId: string, args: ArgumentsOf<Name>) => Effect.Effect<ToolAnswer>;
};

/** The tools as MCP's `tools/list` gives them. */
export const toolListing = Object.entries(threadTools).map(([name, tool]) => ({
  description: tool.description,
  inputSchema: tool.inputSchema,
  name,
}));

/**
 * The tools a thread's harness lists: `answer_prompt` only for a harness that asks its permission prompts
 * through it, Claude Code; the others ask the owner in-process.
 */
export const toolListingOf = (hasPromptTool: boolean) =>
  hasPromptTool ? toolListing : toolListing.filter((tool) => tool.name !== "answer_prompt");

/**
 * The tools Code Mode never covers, which stay listed and are called directly (connectors specification, Code Mode):
 * the two that put a question to the owner, whose approval must be seen and never run from code (`answer_prompt` is how
 * Claude Code asks its own permission prompts), the one that ends the thread's turn, and the one that stops the thread
 * until the owner chooses where a message goes.
 */
const directToolNames: ReadonlySet<string> = new Set([
  "answer_prompt",
  "report_result",
  "request_approval",
  "suggest_mission",
] satisfies ReadonlyArray<ThreadToolName>);

/** Whether Code Mode covers a thread tool: it is called from code, not listed, while Code Mode is on. */
export const isCoveredByCodeMode = (name: string) => Object.hasOwn(threadTools, name) && !directToolNames.has(name);

/** The tools that start or redirect other threads' work, which one run of code may call only so many times. */
const workStartingToolNames: ReadonlySet<string> = new Set([
  "interrupt_thread",
  "open_thread",
  "send_thread_message",
] satisfies ReadonlyArray<ThreadToolName>);

/** Whether a thread tool starts or redirects other threads' work. */
export const startsWork = (name: string) => workStartingToolNames.has(name);

/** Whether a name is one of the thread tools. */
export const isThreadToolName = (name: string): name is ThreadToolName => Object.hasOwn(threadTools, name);

/** Decodes a call's arguments and answers it, or answers that the arguments are invalid. */
export const answerToolCall = <Name extends ThreadToolName>(
  handlers: ToolHandlers,
  name: Name,
  threadId: string,
  args: unknown,
): Effect.Effect<ToolAnswer> => {
  const tool = threadTools[name];
  const decoded = Schema.decodeUnknownExit<(typeof threadTools)[Name]["schema"]>(tool.schema)(args);
  if (Exit.isFailure(decoded)) return Effect.succeed(tool.invalid);
  const handler: ToolHandlers[Name] = handlers[name];
  return handler(threadId, decoded.value);
};
