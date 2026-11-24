import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { createInterface } from "node:readline";

// Bridges newline-delimited JSON-RPC over stdio to Outlore's local HTTP MCP tool server for ACP agents that do not advertise `mcpCapabilities.http` (ADR 0005).
// Uses `node:http` directly so long-held approval calls streaming SSE keepalives never hit fetch body timeouts and abort cleanly when the ACP agent closes stdin.

const target = process.argv[2];
if (target === undefined || target === "") {
  process.stderr.write("Usage: acpMcpBridge.mjs <mcp-url>\n");
  process.exit(1);
}

const endpoint = new URL(target);
const openRequest = endpoint.protocol === "https:" ? httpsRequest : httpRequest;

/** Active outbound HTTP requests, destroyed when stdin closes so held approval calls withdraw promptly. */
const activeRequests = new Set();
let isClosing = false;
let negotiatedProtocolVersion = null;

const send = (payload) => {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
};

const emitRawJson = (raw) => {
  const trimmed = raw.trim();
  if (trimmed === "") return;
  try {
    const parsed = JSON.parse(trimmed);
    const serverVersion = parsed?.result?.protocolVersion;
    if (typeof serverVersion === "string" && serverVersion !== "") negotiatedProtocolVersion = serverVersion;
    send(parsed);
  } catch {
    // Ignore malformed trailing frames rather than corrupting the JSON-RPC stream.
  }
};

const sendError = (id, code, message) => {
  send({ error: { code, message }, id, jsonrpc: "2.0" });
};

const readSseResponse = (response) => {
  let buffer = "";
  let dataLines = [];
  const flushEvent = () => {
    if (dataLines.length === 0) return;
    const payload = dataLines.join("\n");
    dataLines = [];
    emitRawJson(payload);
  };
  response.setEncoding("utf8");
  response.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line === "") {
        flushEvent();
      } else if (line.startsWith("data:")) {
        const value = line.slice(5);
        dataLines.push(value.startsWith(" ") ? value.slice(1) : value);
      }
    }
  });
  response.on("end", () => {
    if (buffer.startsWith("data:")) {
      const value = buffer.slice(5);
      dataLines.push(value.startsWith(" ") ? value.slice(1) : value);
    }
    flushEvent();
  });
};

const forward = (rawLine) => {
  let message;
  try {
    message = JSON.parse(rawLine);
  } catch {
    sendError(null, -32700, "Parse error");
    return;
  }
  const hasId =
    message !== null && typeof message === "object" && Object.hasOwn(message, "id") && message.id !== void 0;
  const requestedVersion =
    message?.method === "initialize" && typeof message?.params?.protocolVersion === "string"
      ? message.params.protocolVersion
      : null;
  if (requestedVersion !== null) negotiatedProtocolVersion = requestedVersion;
  const protocolVersionHeader = requestedVersion ?? negotiatedProtocolVersion;
  const body = JSON.stringify(message);
  const headers = {
    accept: "application/json, text/event-stream",
    "content-length": String(Buffer.byteLength(body)),
    "content-type": "application/json",
    ...(protocolVersionHeader === null ? {} : { "mcp-protocol-version": protocolVersionHeader }),
  };

  const outbound = openRequest(endpoint, { headers, method: "POST" }, (response) => {
    const status = response.statusCode ?? 0;
    if (status === 202) {
      response.resume();
      return;
    }
    if (status < 200 || status >= 300) {
      response.resume();
      if (hasId && !isClosing) sendError(message.id, -32000, `MCP bridge HTTP ${status}`);
      return;
    }
    const contentType = String(response.headers["content-type"] ?? "");
    if (contentType.includes("text/event-stream")) {
      readSseResponse(response);
      return;
    }
    let responseBody = "";
    response.setEncoding("utf8");
    response.on("data", (chunk) => {
      responseBody += chunk;
    });
    response.on("end", () => {
      emitRawJson(responseBody);
    });
  });

  activeRequests.add(outbound);
  outbound.on("close", () => {
    activeRequests.delete(outbound);
  });
  outbound.on("error", (error) => {
    activeRequests.delete(outbound);
    if (hasId && !isClosing) sendError(message.id, -32000, error.message);
  });
  outbound.end(body);
};

const reader = createInterface({ crlfDelay: Number.POSITIVE_INFINITY, input: process.stdin });
reader.on("line", (line) => {
  if (line.trim() === "") return;
  forward(line);
});
reader.on("close", () => {
  isClosing = true;
  for (const outbound of activeRequests) outbound.destroy();
  activeRequests.clear();
});
