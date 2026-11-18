import { codeToolName } from "../connectors/index.ts";
import { qualifiedToolNameOf } from "../harness/index.ts";
import { threadTools } from "./threadTools.ts";

/** The qualified tool names Claude Code can run without asking; Code Mode's tool only while Code Mode is on. */
export const unaskedToolNamesOf = (serverName: string, usesCodeMode: boolean) =>
  [
    ...Object.entries(threadTools)
      .filter(([, tool]) => tool.isUnasked)
      .map(([name]) => name),
    // The tools its code calls ask the owner themselves, as a direct call does.
    ...(usesCodeMode ? [codeToolName] : []),
  ].map((name) => qualifiedToolNameOf(serverName, name));
