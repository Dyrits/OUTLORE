import { codeToolName } from "../connectors/index.ts";
import { qualifiedToolNameOf } from "../harness/index.ts";
import { threadTools } from "./threadTools.ts";

/** The qualified tool names Claude Code can run without asking. */
export const unaskedToolNamesOf = (serverName: string) =>
  [
    ...Object.entries(threadTools)
      .filter(([, tool]) => tool.isUnasked)
      .map(([name]) => name),
    // The gateway handles approvals for the connector calls made by the code.
    codeToolName,
  ].map((name) => qualifiedToolNameOf(serverName, name));
