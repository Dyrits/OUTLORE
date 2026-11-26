import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { stdioCommandOf, stdioMcpBackend } from "../../src/connectors/backends/stdioMcp.ts";
import { catalogToolOf, unnamedToolsOf } from "../../src/connectors/catalog.ts";
import { appleEntry } from "../../src/connectors/catalogEntries.ts";
import { startRpcProcess } from "../../src/core/index.ts";
import {
  recordedAppleProtocolVersion,
  recordedAppleServer,
  recordedAppleToolNames,
} from "../fixtures/appleServerListing.ts";

// The Apple apps catalog entry against the pinned server's recorded listing: a version bump that lists a tool the
// catalog does not name fails here, so a new tool asks instead of running, and a new write cannot slip in unasked.
// The live test at the end is opt-in (OUTLORE_LIVE_APPLE_SERVER=1) and runs the vendored server itself.

describe("the Apple apps entry against the pinned server's recorded listing", () => {
  it("names every tool the pinned version lists, and only tools it lists", () => {
    expect(unnamedToolsOf(appleEntry, recordedAppleToolNames)).toEqual([]);
    for (const name of Object.keys(appleEntry.tools)) expect(recordedAppleToolNames).toContain(name);
    expect(Object.keys(appleEntry.tools).length).toBe(recordedAppleToolNames.length);
  });

  it("gives every tool an app the entry offers, or no app at all, and a Read or Write class", () => {
    const appIds = new Set(appleEntry.apps.map((app) => app.id));
    for (const [name, tool] of Object.entries(appleEntry.tools)) {
      expect(["Read", "Write"]).toContain(tool.class);
      if (tool.app !== null) expect(appIds.has(tool.app)).toBe(true);
      expect(catalogToolOf(appleEntry, name)).toEqual(tool);
    }
  });

  it("class as Write the tools whose names read as reads but write, after reading their handlers", () => {
    for (const name of [
      "mark-as-read",
      "set-mode",
      "complete-reminder",
      "react-message",
      "open-safari-url",
      "close-safari-tab",
    ])
      expect(catalogToolOf(appleEntry, name)?.class).toBe("Write");
  });

  it("class as Read the tools whose handlers only query, including the mildest names", () => {
    for (const name of ["about", "check-auth-status", "list-folders", "list-calendars", "read-email", "read-note"])
      expect(catalogToolOf(appleEntry, name)?.class).toBe("Read");
  });

  it("pins the server and version the recorded listing came from", () => {
    expect(appleEntry.backend._tag).toBe("Stdio");
    if (appleEntry.backend._tag === "Stdio") {
      expect(appleEntry.backend.server).toBe("mcp-icloud");
      expect(appleEntry.backend.version).toBe(recordedAppleServer.version);
      expect(appleEntry.backend.version).toBe("2.1.4");
    }
    expect(appleEntry.licence).toBe("MIT");
  });
});

// Opt-in: OUTLORE_LIVE_APPLE_SERVER=1 runs the vendored pinned server over stdio (its listing needs no Apple access)
// and fails when it lists anything the recorded fixture does not, or names another version.
describe.runIf(process.env.OUTLORE_LIVE_APPLE_SERVER === "1")("the vendored Apple server, run live", () => {
  it("answers the opening exchange as the recorded server and lists exactly the recorded tools", async () => {
    const command = await Effect.runPromise(stdioCommandOf("mcp-icloud"));
    const server = await Effect.runPromise(
      stdioMcpBackend({
        command,
        env: { USE_LOCAL_MODE: "true" },
        label: "icloud-mcp",
        requestTimeoutMillis: 20_000,
      }),
    );
    try {
      const tools = await Effect.runPromise(server.listTools(null));
      expect(tools.map((tool) => tool.name)).toEqual([...recordedAppleToolNames]);
    } finally {
      await Effect.runPromise(server.close);
    }
    const rpc = await Effect.runPromise(
      startRpcProcess({
        args: [...command.slice(1)],
        command: command[0] ?? "node",
        cwd: process.cwd(),
        env: { USE_LOCAL_MODE: "true" },
        isJsonRpc2: true,
        label: "icloud-mcp",
      }),
    );
    try {
      const opened = (await Effect.runPromise(
        rpc.request("initialize", {
          capabilities: {},
          clientInfo: { name: "Outlore", version: "test" },
          protocolVersion: recordedAppleProtocolVersion,
        }),
      )) as { protocolVersion?: string; serverInfo?: { name?: string; version?: string } };
      expect(opened.serverInfo?.name).toBe(recordedAppleServer.name);
      expect(opened.serverInfo?.version).toBe(appleEntry.backend._tag === "Stdio" ? appleEntry.backend.version : null);
      expect(opened.protocolVersion).toBe(recordedAppleProtocolVersion);
    } finally {
      rpc.close();
    }
  });
});
