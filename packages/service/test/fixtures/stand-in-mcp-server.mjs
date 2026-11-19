// A scripted stand-in for a stdio MCP server, shaped after the MCP opening exchange and `tools/list` / `tools/call`
// as the pinned Apple server (mcp-icloud 2.1.4 over @modelcontextprotocol/server 2.0.0) speaks them.
// STAND_IN_MCP_TOOLS is a JSON array of tools: { name, description?, mode?, text? } with mode one of "ok" (default),
// "isError" (a tool error answer), "rpcError" (a JSON-RPC error, code -32602), "notFound" (code -32601), "slow"
// (waits STAND_IN_MCP_SLOW_MILLIS, default 5000), "echoEnv" (answers with the child's environment), "echoArgs"
// (answers with the call's arguments) or "crash" (ends the process). STAND_IN_LOG receives one JSON line per start
// ({ start: { pid, args, cwd, env } }) and per request ({ request: { method, params } }); STAND_IN_MCP_PID_FILE
// receives the pid at each start, so a test can see a restart.
import { appendFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const tools = JSON.parse(
  process.env.STAND_IN_MCP_TOOLS ??
    JSON.stringify([
      { description: "List the events of a day", name: "list-events" },
      { mode: "echoArgs", name: "create-event" },
    ]),
);
const slowMillis = Number(process.env.STAND_IN_MCP_SLOW_MILLIS ?? 5000);

const log = (entry) => {
  if (process.env.STAND_IN_LOG) appendFileSync(process.env.STAND_IN_LOG, `${JSON.stringify(entry)}\n`);
};
log({
  start: {
    args: process.argv.slice(2),
    cwd: process.cwd(),
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("STAND_IN_MCP_"))),
    pid: process.pid,
  },
});
if (process.env.STAND_IN_MCP_PID_FILE) writeFileSync(process.env.STAND_IN_MCP_PID_FILE, String(process.pid));

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const sleep = (millis) => new Promise((resolve) => setTimeout(resolve, millis));

const handle = async (message) => {
  const { id, method, params } = message;
  log({ request: { method, params } });
  if (method === "initialize") {
    send({
      id,
      result: {
        capabilities: { tools: {} },
        protocolVersion: params?.protocolVersion ?? "2025-11-25",
        serverInfo: { name: "stand-in-mcp", version: "0.0.1" },
      },
    });
    return;
  }
  if (method === "notifications/initialized") return;
  if (method === "tools/list") {
    send({
      id,
      result: {
        tools: tools.map((tool) => ({
          description: tool.description ?? `Stand-in tool ${tool.name}.`,
          inputSchema: { properties: {}, type: "object" },
          name: tool.name,
        })),
      },
    });
    return;
  }
  if (method === "tools/call") {
    const tool = tools.find((candidate) => candidate.name === params?.name);
    if (tool === undefined) {
      send({ error: { code: -32602, message: `Unknown tool ${String(params?.name)}` }, id });
      return;
    }
    const mode = tool.mode ?? "ok";
    if (mode === "rpcError") {
      send({ error: { code: -32602, message: "Invalid params" }, id });
      return;
    }
    if (mode === "notFound") {
      send({ error: { code: -32601, message: "Method not found" }, id });
      return;
    }
    if (mode === "crash") process.exit(1);
    if (mode === "slow") await sleep(slowMillis);
    const text =
      mode === "echoEnv"
        ? JSON.stringify(process.env)
        : mode === "echoArgs"
          ? JSON.stringify(params?.arguments ?? null)
          : (tool.text ?? `done ${tool.name}`);
    send({ id, result: { content: [{ text, type: "text" }], ...(mode === "isError" ? { isError: true } : {}) } });
    return;
  }
  if (id !== undefined) send({ error: { code: -32601, message: `Method not found: ${String(method)}` }, id });
};

createInterface({ input: process.stdin }).on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  void handle(message);
});
process.stdin.on("end", () => process.exit(0));
