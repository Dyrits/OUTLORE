import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const log = process.env.ACP_FAKE_LOG;
const mode = process.env.ACP_FAKE_MODE ?? "probe";
const write = (value) => appendFileSync(log, `${JSON.stringify(value)}\n`);
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const answer = (id, result) => send({ id, jsonrpc: "2.0", result });
process.on("SIGTERM", () => {
  write({ exit: true });
  process.exit(0);
});

/** The stand-in's own requests, by id, waiting for the client's response. */
const waiting = new Map();
/** The slow mode's running prompt, ended by a cancel. */
let cancellable = null;

const sessionUpdate = (sessionId, update) =>
  send({ jsonrpc: "2.0", method: "session/update", params: { sessionId, update } });

const promptResult = (sessionId, id, stopReason) => {
  sessionUpdate(sessionId, {
    cachedReadTokens: 2,
    inputTokens: 10,
    outputTokens: 5,
    sessionUpdate: "usage_update",
  });
  return answer(id, { stopReason });
};

const runPrompt = (request) => {
  const sessionId = request.params.sessionId;
  sessionUpdate(sessionId, {
    content: { text: "Working", type: "text" },
    sessionUpdate: "agent_message_chunk",
  });
  if (process.env.ACP_FAKE_SLOW === "1") {
    cancellable = { settle: () => promptResult(sessionId, request.id, "cancelled") };
    return;
  }
  sessionUpdate(sessionId, {
    kind: "command",
    rawInput: { command: "git push origin main" },
    sessionUpdate: "tool_call",
    title: "git push",
    toolCallId: "call-1",
  });
  waiting.set(`p${request.id}`, (message) => {
    const optionId = message.result?.outcome?.optionId ?? "unanswered";
    sessionUpdate(sessionId, {
      content: { text: `tool was ${optionId}`, type: "text" },
      sessionUpdate: "agent_message_chunk",
    });
    promptResult(sessionId, request.id, "end_turn");
  });
  send({
    id: `p${request.id}`,
    jsonrpc: "2.0",
    method: "session/request_permission",
    params: {
      options: [
        { kind: "allow_once", optionId: "allow_once" },
        { kind: "reject_once", optionId: "reject_once" },
      ],
      sessionId,
      toolCall: { title: "git push", toolCallId: "call-1" },
    },
  });
};

const onRequest = (request) => {
  write({
    cwd: process.cwd(),
    hermesHome: process.env.HERMES_HOME ?? null,
    kimiCodeHome: process.env.KIMI_CODE_HOME ?? null,
    method: request.method,
    params: request.params,
  });
  if (request.method === "initialize")
    return answer(
      request.id,
      mode === "turn"
        ? {
            agentCapabilities: {
              ...(process.env.ACP_FAKE_MCP_HTTP === "1" ? { mcpCapabilities: { http: true } } : {}),
              promptCapabilities: { image: true },
            },
          }
        : {},
    );
  if (request.method === "session/new")
    return answer(
      request.id,
      mode === "turn"
        ? {
            configOptions: [
              { id: "model", options: [{ name: "Model A", value: "model-a" }] },
              { id: "thinking", options: [{ name: "High", value: "high" }] },
            ],
            modes: { availableModes: [{ id: "ask" }, { id: "default" }] },
            sessionId: "acp-1",
          }
        : process.env.ACP_FAKE_FORM === "config"
          ? { configOptions: [{ id: "model", options: [{ name: "Model A", value: "model-a" }] }], sessionId: "probe" }
          : { models: { availableModels: [{ modelId: "model-a", name: "Model A" }] }, sessionId: "probe" },
    );
  if (request.method === "session/load") {
    if (process.env.ACP_FAKE_MISSING_SESSION === request.params.sessionId)
      return send({ error: { code: -32602, message: "session not found" }, id: request.id, jsonrpc: "2.0" });
    return answer(request.id, { sessionId: request.params.sessionId });
  }
  if (request.method === "session/prompt") return runPrompt(request);
  if (request.method === "session/cancel") {
    if (cancellable !== null) {
      const pending = cancellable;
      cancellable = null;
      pending.settle();
    }
    return;
  }
  answer(request.id, {});
};

createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method !== undefined) return onRequest(message);
  const settled = waiting.get(message.id);
  if (settled !== undefined) {
    waiting.delete(message.id);
    settled(message);
  }
});
