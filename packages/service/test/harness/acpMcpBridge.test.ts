import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { afterEach, describe, expect, it } from "vitest";

// Exercises the stdio-to-HTTP MCP bridge (`acpMcpBridge.mjs`) as an ACP agent spawns it: newline-delimited JSON-RPC on stdio forwarded to an HTTP MCP server speaking Outlore's JSON and SSE responses.

const bridgePath = join(import.meta.dirname, "../../src/harness/acpMcpBridge.mjs");

const readBody = (request: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });

type RunningBridge = {
  readonly close: () => void;
  readonly send: (message: Record<string, unknown>) => void;
  readonly nextReply: () => Promise<Record<string, unknown>>;
};

const startBridge = (url: string): RunningBridge => {
  const child = spawn(process.execPath, [bridgePath, url], { stdio: ["pipe", "pipe", "pipe"] });
  const lines: Array<Record<string, unknown>> = [];
  const waiters: Array<(message: Record<string, unknown>) => void> = [];
  createInterface({ input: child.stdout }).on("line", (line) => {
    if (line.trim() === "") return;
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const waiter = waiters.shift();
    if (waiter !== undefined) waiter(parsed);
    else lines.push(parsed);
  });
  return {
    close: () => {
      child.stdin.end();
      child.kill();
    },
    nextReply: () =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const queued = lines.shift();
        if (queued !== undefined) return resolve(queued);
        const timer = setTimeout(() => reject(new Error("Timed out waiting for bridge reply")), 5000);
        waiters.push((message) => {
          clearTimeout(timer);
          resolve(message);
        });
      }),
    send: (message) => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    },
  };
};

describe("bridging stdio MCP to Outlore's HTTP MCP server", () => {
  const cleanups: Array<() => Promise<void> | void> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const cleanup = cleanups.pop();
      if (cleanup !== undefined) await cleanup();
    }
  });

  it("forwards initialize with 2026-07-28, notifications, tools/list, and SSE tools/call cleanly", async () => {
    const receivedHeaders: Array<string | undefined> = [];
    const server = createServer((request: IncomingMessage, response: ServerResponse) => {
      void readBody(request).then((raw) => {
        receivedHeaders.push(request.headers["mcp-protocol-version"] as string | undefined);
        const message = JSON.parse(raw) as { id?: number | string; method: string; params?: Record<string, unknown> };
        if (message.id === undefined) {
          response.writeHead(202).end();
          return;
        }
        if (message.method === "initialize") {
          const version =
            typeof message.params?.protocolVersion === "string" ? message.params.protocolVersion : "2025-06-18";
          response.writeHead(200, { "content-type": "application/json" });
          response.end(
            JSON.stringify({
              id: message.id,
              jsonrpc: "2.0",
              result: {
                capabilities: { tools: {} },
                protocolVersion: version,
                serverInfo: { name: "outlore", version: "0.1.0" },
              },
            }),
          );
          return;
        }
        if (message.method === "tools/list") {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(
            JSON.stringify({
              id: message.id,
              jsonrpc: "2.0",
              result: { tools: [{ description: "Report result", name: "report_result" }] },
            }),
          );
          return;
        }
        if (message.method === "tools/call") {
          response.writeHead(200, { "cache-control": "no-cache", "content-type": "text/event-stream" });
          response.write(": waiting\n\n");
          const payload = {
            id: message.id,
            jsonrpc: "2.0",
            result: { content: [{ text: "recorded", type: "text" }], isError: false },
          };
          response.end(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;

    const bridge = startBridge(`http://127.0.0.1:${port}/mcp/test-token`);
    cleanups.push(() => bridge.close());

    bridge.send({
      id: 1,
      jsonrpc: "2.0",
      method: "initialize",
      params: { protocolVersion: "2026-07-28" },
    });
    const initReply = await bridge.nextReply();
    expect(initReply).toEqual({
      id: 1,
      jsonrpc: "2.0",
      result: {
        capabilities: { tools: {} },
        protocolVersion: "2026-07-28",
        serverInfo: { name: "outlore", version: "0.1.0" },
      },
    });

    // A notification receives HTTP 202 and writes nothing to stdout.
    bridge.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    bridge.send({ id: 2, jsonrpc: "2.0", method: "tools/list", params: {} });
    const listReply = await bridge.nextReply();
    expect(listReply).toEqual({
      id: 2,
      jsonrpc: "2.0",
      result: { tools: [{ description: "Report result", name: "report_result" }] },
    });

    bridge.send({
      id: 3,
      jsonrpc: "2.0",
      method: "tools/call",
      params: { arguments: { summary: "done" }, name: "report_result" },
    });
    const callReply = await bridge.nextReply();
    expect(callReply).toEqual({
      id: 3,
      jsonrpc: "2.0",
      result: { content: [{ text: "recorded", type: "text" }], isError: false },
    });
    expect(receivedHeaders).toEqual(["2026-07-28", "2026-07-28", "2026-07-28", "2026-07-28"]);
  });

  it("answers with a JSON-RPC error instead of hanging when the HTTP endpoint fails", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;

    const bridge = startBridge(`http://127.0.0.1:${port}/mcp/missing`);
    cleanups.push(() => bridge.close());

    bridge.send({ id: 9, jsonrpc: "2.0", method: "tools/list", params: {} });
    const reply = await bridge.nextReply();
    expect(reply.id).toBe(9);
    expect(reply.jsonrpc).toBe("2.0");
    expect((reply.error as { code?: number } | undefined)?.code).toBe(-32000);
  });

  it("aborts an in-flight SSE tool call when stdin closes", async () => {
    let wasAborted = false;
    let resolveAborted: () => void = () => undefined;
    const aborted = new Promise<void>((resolve) => {
      resolveAborted = resolve;
    });
    let resolveStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const server = createServer((_request, response) => {
      response.writeHead(200, { "cache-control": "no-cache", "content-type": "text/event-stream" });
      response.write(": waiting\n\n");
      response.on("close", () => {
        if (!response.writableFinished) {
          wasAborted = true;
          resolveAborted();
        }
      });
      resolveStarted();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;

    const bridge = startBridge(`http://127.0.0.1:${port}/mcp/aborted`);
    cleanups.push(() => bridge.close());

    bridge.send({ id: 4, jsonrpc: "2.0", method: "tools/call", params: { arguments: {}, name: "request_approval" } });
    await started;
    bridge.close();
    await Promise.race([
      aborted,
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("SSE call was not aborted")), 3000)),
    ]);
    expect(wasAborted).toBe(true);
  });
});
