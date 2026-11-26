import { tmpdir } from "node:os";
import { Effect } from "effect";
import type { TurnRequest } from "../../src/core/index.ts";

/** A turn request for driving one harness adapter directly; the owner allows every prompt unless replaced. */
export const turnRequestOf = (fields: Partial<TurnRequest> = {}): TurnRequest => ({
  access: {
    approvalLevel: "RiskyOnly",
    areEditsUnasked: false,
    canWorkOutsideSandbox: false,
    connectorTools: [],
    containment: "Sandboxed",
    isEverythingUnasked: false,
    isInWorkspace: false,
    isUsingCodeMode: false,
    mcpUrl: "http://127.0.0.1:9/mcp/none",
    permissionKinds: [],
    unaskedTools: [],
  },
  askOwner: () => Effect.succeed({ isAllowed: true, text: "" }),
  configDirectory: null,
  context: "Starting context.",
  conversationSoFar: Effect.succeed(null),
  cwd: tmpdir(),
  effort: "default",
  folderRoot: tmpdir(),
  harness: "claude",
  images: [],
  model: "default",
  note: null,
  onEvent: () => Effect.void,
  sessionId: null,
  text: "Hello",
  threadId: "thread-1",
  ...fields,
});
