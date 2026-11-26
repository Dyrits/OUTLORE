import { existsSync } from "node:fs";
import { join } from "node:path";
import { Config, Effect, Option } from "effect";
import { fieldOf, type HarnessFailure, isRecord, textFieldOf } from "../../core/index.ts";
import { BackendFailure, type BackendTool } from "../backend.ts";

// Command resolution and MCP message decoding helpers for stdio connector servers.

/** Options for one stdio MCP server. */
export type StdioMcpOptions = {
  readonly hasAppleAutomation?: boolean;
  /** The command that runs the server, such as a system Node and the vendored server file. */
  readonly command: ReadonlyArray<string>;
  /** Extra environment for the child, on top of the reduced environment. */
  readonly env?: Record<string, string>;
  /** How long without a request the child is closed; the default is a minute. */
  readonly idleCloseMillis?: number;
  /** The server's name as the owner reads it, for failures. */
  readonly label: string;
  /** How long one request may take before the child is closed and the call fails; the default is a minute. */
  readonly requestTimeoutMillis?: number;
};

/** The system Node that runs a vendored server: the first of the usual locations that exists, else `node` on the PATH. */
export const systemNodePathOf = (): string => {
  for (const candidate of ["/usr/bin/node", "/usr/local/bin/node", "/opt/homebrew/bin/node"]) {
    if (existsSync(candidate)) return candidate;
  }
  return "node";
};

/** The file a vendored server package runs from: the packaged app's vendor folder or `packages/service/vendor/`. */
export const vendoredServerFileOf = Effect.fnUntraced(function* (server: string) {
  const packaged = yield* Config.String("OUTLORE_VENDOR_DIR").pipe(Config.option, Effect.orDie);
  if (Option.isSome(packaged)) return join(packaged.value, `${server}.cjs`);
  return join(import.meta.dirname, "..", "..", "..", "vendor", `${server}.cjs`);
});

/** The command a catalog entry's stdio server runs as: a system Node and the vendored file. */
export const stdioCommandOf = Effect.fnUntraced(function* (server: string) {
  return [systemNodePathOf(), yield* vendoredServerFileOf(server)];
});

/** The JSON-RPC error codes of a malformed call: the method does not exist, or the params do not fit the schema. */
const isInvalidArgumentsCode = (code: number | undefined) => code === -32601 || code === -32602;

/** Maps a transport failure to the backend's public class; the server's own words stay in `upstream`, for no one. */
export const stdioFailureOf = (failure: HarnessFailure, label: string): BackendFailure =>
  new BackendFailure({
    class: isInvalidArgumentsCode(failure.code) ? "InvalidArguments" : "Unreachable",
    upstream: failure.reason || `${label} could not be reached.`,
  });

/** The text of a `tools/call` answer: its content blocks joined, which is the tool's answer as the catalog reads it. */
export const answerTextOf = (result: unknown): string => {
  const content = fieldOf(result, "content");
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => textFieldOf(block, "text") ?? "")
    .filter((text) => text.length > 0)
    .join("\n");
};

/** Whether a `tools/call` answer is the tool's own error rather than its answer. */
export const isErrorAnswerOf = (result: unknown) => fieldOf(result, "isError") === true;

/** Decodes the `tools/list` result of a stdio MCP server into backend tools. */
export const stdioToolsOf = (result: unknown): ReadonlyArray<BackendTool> => {
  const tools = fieldOf(result, "tools");
  if (!Array.isArray(tools)) return [];
  return tools.map((tool): BackendTool => {
    const schema = fieldOf(tool, "inputSchema");
    return {
      description: textFieldOf(tool, "description") ?? "",
      inputSchema: isRecord(schema) ? schema : {},
      name: String(fieldOf(tool, "name") ?? ""),
    };
  });
};
