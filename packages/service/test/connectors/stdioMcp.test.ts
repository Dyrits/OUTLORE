import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { BackendFailure, ConnectorBackend } from "../../src/connectors/backend.ts";
import { type StdioMcpOptions, stdioMcpBackend } from "../../src/connectors/backends/stdioMcp.ts";
import { temporary } from "../fixtures/service.ts";
import { isAlive, waitFor } from "../fixtures/standIns.ts";

// The stdio MCP backend over a real stand-in server process (test/fixtures/stand-in-mcp-server.mjs), which speaks the
// MCP opening exchange and answers `tools/list` and `tools/call` as scripted.

const standIn = join(import.meta.dirname, "..", "fixtures", "stand-in-mcp-server.mjs");

/** One backend over the stand-in, with its script, pid file and log in a temporary folder. */
const standInBackend = (
  tools: ReadonlyArray<Record<string, unknown>>,
  extra?: Partial<Omit<StdioMcpOptions, "command" | "env" | "label">> & { initMode?: string },
) => {
  const folder = temporary("outlore-stdio-");
  const options: StdioMcpOptions = {
    command: [process.execPath, standIn],
    env: {
      STAND_IN_LOG: join(folder, "starts.jsonl"),
      STAND_IN_MCP_INIT_MODE: extra?.initMode ?? "normal",
      STAND_IN_MCP_LOG: join(folder, "log.jsonl"),
      STAND_IN_MCP_PID_FILE: join(folder, "pid"),
      STAND_IN_MCP_TOOLS: JSON.stringify(tools),
    },
    idleCloseMillis: 60_000,
    label: "Stand-in MCP",
    requestTimeoutMillis: 5_000,
    ...extra,
  };
  const backend = Effect.runPromise(stdioMcpBackend(options));
  return { backend, folder };
};

const pidOf = (folder: string) => Number(readFileSync(join(folder, "pid"), "utf8"));

/** The failure an effect ends with. */
const failureOf = <A>(effect: Effect.Effect<A, BackendFailure>) => Effect.runPromise(Effect.flip(effect));

describe("the stdio MCP backend", () => {
  it("starts only one child for concurrent first requests", async () => {
    const { backend, folder } = standInBackend([{ name: "one" }], { initMode: "slow" });
    const server = await backend;
    try {
      await Promise.all([Effect.runPromise(server.listTools(null)), Effect.runPromise(server.listTools(null))]);
      const lines = readFileSync(join(folder, "starts.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(lines.filter((line) => line.start !== undefined)).toHaveLength(1);
    } finally {
      await Effect.runPromise(server.close);
    }
  });

  it("ends a child when initialization fails", async () => {
    const { backend, folder } = standInBackend([], { initMode: "fail" });
    const server = await backend;
    try {
      expect((await failureOf(server.listTools(null))).class).toBe("Unreachable");
      const pid = pidOf(folder);
      await waitFor(() => !isAlive(pid), 3000);
      expect(isAlive(pid)).toBe(false);
    } finally {
      await Effect.runPromise(server.close);
    }
  });

  it("ends a child when initialization is interrupted", async () => {
    const { backend, folder } = standInBackend([], { initMode: "hang" });
    const server = await backend;
    try {
      const controller = new AbortController();
      const pending = Effect.runPromise(server.listTools(null), { signal: controller.signal }).catch(() => null);
      await waitFor(() => existsSync(join(folder, "pid")), 3000);
      const pid = pidOf(folder);
      controller.abort();
      await pending;
      await waitFor(() => !isAlive(pid), 3000);
      expect(isAlive(pid)).toBe(false);
    } finally {
      await Effect.runPromise(server.close);
    }
  });
  it("lists the server's tools after the opening exchange", async () => {
    const { backend, folder } = standInBackend([
      { description: "List the events of a day", name: "list-events" },
      { name: "create-event" },
    ]);
    const server: ConnectorBackend = await backend;
    try {
      const tools = await Effect.runPromise(server.listTools(null));
      expect(tools.map((tool) => tool.name)).toEqual(["list-events", "create-event"]);
      expect(tools[0]?.description).toBe("List the events of a day");
      expect(pidOf(folder)).toBeGreaterThan(0);
    } finally {
      await Effect.runPromise(server.close);
    }
  });

  it("calls a tool and returns its text, passing the arguments and no secret", async () => {
    const { backend } = standInBackend([{ mode: "echoArgs", name: "create-event" }]);
    const server = await backend;
    try {
      const answer = await Effect.runPromise(server.call("create-event", { title: "Standup" }, "sk-live-test-secret"));
      expect(JSON.parse(answer)).toEqual({ title: "Standup" });
      expect(answer).not.toContain("sk-live-test-secret");
    } finally {
      await Effect.runPromise(server.close);
    }
  });

  it("gives the child a reduced environment: no Outlore variable reaches it", async () => {
    process.env.OUTLORE_TOKEN = "owner-token-secret";
    try {
      const { backend } = standInBackend([{ mode: "echoEnv", name: "env" }]);
      const server = await backend;
      try {
        const answer = await Effect.runPromise(server.call("env", {}, null));
        const environment = JSON.parse(answer) as Record<string, string>;
        expect(Object.keys(environment).some((key) => key.startsWith("OUTLORE_"))).toBe(false);
        expect(environment.STAND_IN_MCP_TOOLS).toBeDefined();
      } finally {
        await Effect.runPromise(server.close);
      }
    } finally {
      delete process.env.OUTLORE_TOKEN;
    }
  });

  it("maps a tool error answer to Failed", async () => {
    const { backend } = standInBackend([{ mode: "isError", name: "break", text: "the tool broke" }]);
    const server = await backend;
    try {
      const failure = await failureOf(server.call("break", {}, null));
      expect(failure.class).toBe("Failed");
      // The server's own words stay in the failure's upstream, which the gateway never forwards.
      expect(failure.upstream).toContain("the tool broke");
    } finally {
      await Effect.runPromise(server.close);
    }
  });

  it("maps a JSON-RPC invalid-params answer and a missing method to InvalidArguments", async () => {
    const { backend } = standInBackend([
      { mode: "rpcError", name: "bad-params" },
      { mode: "notFound", name: "no-such-method" },
    ]);
    const server = await backend;
    try {
      expect((await failureOf(server.call("bad-params", {}, null))).class).toBe("InvalidArguments");
      expect((await failureOf(server.call("no-such-method", {}, null))).class).toBe("InvalidArguments");
      // A call of a tool the server does not list is the thread's own malformed call.
      expect((await failureOf(server.call("unlisted-tool", {}, null))).class).toBe("InvalidArguments");
    } finally {
      await Effect.runPromise(server.close);
    }
  });

  it("reports Unreachable when the command does not exist", async () => {
    const folder = temporary("outlore-stdio-");
    const server = await Effect.runPromise(
      stdioMcpBackend({ command: ["outlore-missing-binary-xyz"], label: "Missing server" }),
    );
    try {
      expect((await failureOf(server.listTools(null))).class).toBe("Unreachable");
    } finally {
      await Effect.runPromise(server.close);
      void folder;
    }
  });

  it("restarts the child after it dies mid-call, so the next call succeeds", async () => {
    const { backend, folder } = standInBackend([{ mode: "crash", name: "crash" }, { name: "list-events" }]);
    const server = await backend;
    try {
      await Effect.runPromise(server.listTools(null));
      const firstPid = pidOf(folder);
      expect((await failureOf(server.call("crash", {}, null))).class).toBe("Unreachable");
      await waitFor(() => !isAlive(firstPid));
      const answer = await Effect.runPromise(server.call("list-events", {}, null));
      expect(answer).toContain("done list-events");
      expect(pidOf(folder)).not.toBe(firstPid);
    } finally {
      await Effect.runPromise(server.close);
    }
  });

  it("closes an idle child and starts a new one on the next call", async () => {
    const { backend, folder } = standInBackend([{ name: "list-events" }], { idleCloseMillis: 120 });
    const server = await backend;
    try {
      await Effect.runPromise(server.listTools(null));
      const firstPid = pidOf(folder);
      await waitFor(() => !isAlive(firstPid), 3000);
      await Effect.runPromise(server.call("list-events", {}, null));
      expect(pidOf(folder)).not.toBe(firstPid);
    } finally {
      await Effect.runPromise(server.close);
    }
  });

  it("ends the child on close", async () => {
    const { backend, folder } = standInBackend([{ name: "list-events" }]);
    const server = await backend;
    await Effect.runPromise(server.listTools(null));
    const pid = pidOf(folder);
    await Effect.runPromise(server.close);
    await waitFor(() => !isAlive(pid), 3000);
    expect(isAlive(pid)).toBe(false);
  });

  it("times out a slow call, ends the child, and answers the next call on a fresh one", async () => {
    const { backend, folder } = standInBackend(
      [{ mode: "slow", name: "slow-read", text: "slow answer" }, { name: "list-events" }],
      { requestTimeoutMillis: 200 },
    );
    const server = await backend;
    try {
      await Effect.runPromise(server.listTools(null));
      const firstPid = pidOf(folder);
      expect((await failureOf(server.call("slow-read", {}, null))).class).toBe("Unreachable");
      const answer = await Effect.runPromise(server.call("list-events", {}, null));
      expect(answer).toContain("done list-events");
      expect(pidOf(folder)).not.toBe(firstPid);
    } finally {
      await Effect.runPromise(server.close);
    }
  });
});
