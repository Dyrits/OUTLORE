import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

// Stand-in antigravity ACP server for fixture checks of antigravityProvider.ts: answers initialize, session/new
// (models in probe mode, config options in turn mode), and a prompt whose tool call asks permission, logging the
// launch surface it was given so checks can assert the pinned argv and environment.

const log = process.env.ANTIGRAVITY_FAKE_LOG;
const mode = process.env.ANTIGRAVITY_FAKE_MODE ?? "probe";
const write = (value) => appendFileSync(log, `${JSON.stringify(value)}\n`);
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const answer = (id, result) => send({ id, jsonrpc: "2.0", result });
process.on("SIGTERM", () => {
  write({ exit: true });
  process.exit(0);
});

/** The stand-in's own requests, by id, waiting for the client's response. */
const waiting = new Map();

const sessionUpdate = (sessionId, update) =>
  send({ jsonrpc: "2.0", method: "session/update", params: { sessionId, update } });

const models = [{ name: "Gemini 2.5 Pro", value: "gemini-2.5-pro" }];

const runPrompt = (request) => {
  const sessionId = request.params.sessionId;
  sessionUpdate(sessionId, {
    content: { text: "Working", type: "text" },
    sessionUpdate: "agent_message_chunk",
  });
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
    sessionUpdate(sessionId, {
      cachedReadTokens: 2,
      inputTokens: 10,
      outputTokens: 5,
      sessionUpdate: "usage_update",
    });
    answer(request.id, { stopReason: "end_turn" });
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
    argv: process.argv.slice(2),
    autoUpdateDisabled: process.env.AGY_CLI_DISABLE_AUTO_UPDATE ?? null,
    geminiHome: process.env.GEMINI_HOME ?? null,
    method: request.method,
    params: request.params,
    wslDistroName: process.env.WSL_DISTRO_NAME ?? null,
  });
  if (request.method === "initialize")
    return answer(request.id, mode === "turn" ? { agentCapabilities: { promptCapabilities: { image: true } } } : {});
  if (request.method === "session/new")
    return answer(
      request.id,
      mode === "turn"
        ? {
            configOptions: [
              { id: "model", options: models },
              { id: "thinking", options: [{ name: "High", value: "high" }] },
            ],
            modes: { availableModes: [{ id: "ask" }, { id: "default" }] },
            sessionId: "acp-1",
          }
        : { configOptions: [{ id: "model", options: models }], sessionId: "probe" },
    );
  if (request.method === "session/prompt") return runPrompt(request);
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
