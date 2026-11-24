import { existsSync } from "node:fs";
import { join } from "node:path";
import { toolServerName } from "./toolNames.ts";

/** The Node executable that runs the stdio-to-HTTP MCP bridge: `process.execPath` outside Electron, and a system Node inside Electron where the `RunAsNode` fuse is off (ST-H-09). */
export const bridgeNodePathOf = (): string => {
  if (process.versions.electron === undefined) return process.execPath;
  for (const candidate of ["/usr/bin/node", "/usr/local/bin/node", "/opt/homebrew/bin/node"]) {
    if (existsSync(candidate)) return candidate;
  }
  return "node";
};

/** The bridge script path: the unpacked resource the desktop app passes in `OUTLORE_ACP_MCP_BRIDGE` (in both dev and packaged builds), or the sibling script beside this module when running from source. */
export const acpMcpBridgePathOf = (): string =>
  process.env.OUTLORE_ACP_MCP_BRIDGE ?? join(import.meta.dirname, "acpMcpBridge.mjs");

/** An ACP `McpServerStdio` entry bridging stdio JSON-RPC to the thread's local HTTP MCP tool server. */
export const acpStdioMcpServerOf = (mcpUrl: string) => ({
  args: [acpMcpBridgePathOf(), mcpUrl],
  command: bridgeNodePathOf(),
  env: [] as ReadonlyArray<never>,
  name: toolServerName,
});
