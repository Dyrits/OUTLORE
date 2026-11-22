import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const log = process.env.CURSOR_FAKE_LOG;
const mode = process.env.CURSOR_FAKE_MODE ?? "turn";
const write = (value) => appendFileSync(log, `${JSON.stringify(value)}\n`);
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const answer = (id, result) => send({ id, jsonrpc: "2.0", result });
process.on("SIGTERM", () => process.exit(0));

// A stand-in for the Cursor CLI's ACP server as the audited profile launches it (`cursor-agent acp`): its
// session opens with model configOptions, a prompt sends an agent message, a tool call, and a mediated
// `session/request_permission`, and it prints Cursor's own "WritableIterable is closed" noise line on stdout
// before anything — a line the transport skips because it is not JSON. The strict mode sends one reverse
// request Outlore does not know (`session/set_mode`), to prove the answer fails closed.

/** The stand-in's own requests, by id, waiting for the client's response. */
const waiting = new Map();

const sessionUpdate = (sessionId, update) =>
  send({ jsonrpc: "2.0", method: "session/update", params: { sessionId, update } });

const runPrompt = (request) => {
  const sessionId = request.params.sessionId;
  sessionUpdate(sessionId, {
    content: { text: "Working", type: "text" },
    sessionUpdate: "agent_message_chunk",
  });
  if (process.env.CURSOR_FAKE_STRICT === "1") {
    send({ id: `strict${request.id}`, jsonrpc: "2.0", method: "session/set_mode", params: { mode: "yolo" } });
    waiting.set(`strict${request.id}`, (message) => {
      write({ strictAnswer: message.error?.message ?? "answered" });
      answer(request.id, { stopReason: "end_turn" });
    });
    return;
  }
  sessionUpdate(sessionId, {
    kind: "command",
    rawInput: { command: "git push origin main" },
    sessionUpdate: "tool_call",
    title: "git push origin main",
    toolCallId: "cursor-call-1",
  });
  waiting.set(`p${request.id}`, (message) => {
    const optionId = message.result?.outcome?.optionId ?? "unanswered";
    sessionUpdate(sessionId, {
      content: { text: `tool was ${optionId}`, type: "text" },
      sessionUpdate: "agent_message_chunk",
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
      toolCall: { title: "git push origin main", toolCallId: "cursor-call-1" },
    },
  });
};

const onRequest = (request) => {
  write({ method: request.method, params: request.params });
  if (request.method === "initialize")
    return answer(request.id, { agentCapabilities: { promptCapabilities: { image: true } } });
  if (request.method === "session/new") {
    if (mode === "probe")
      return answer(request.id, {
        configOptions: [
          {
            id: "model",
            options: [
              { name: "Cursor Composer", value: "cursor/composer-1" },
              { name: "GPT-5.2", value: "gpt-5.2" },
            ],
          },
        ],
        sessionId: "cursor-probe-1",
      });
    return answer(request.id, {
      configOptions: [
        {
          id: "model",
          options: [
            { name: "Cursor Composer", value: "cursor/composer-1" },
            { name: "GPT-5.2", value: "gpt-5.2" },
          ],
        },
        { id: "thinking", options: [{ name: "High", value: "high" }] },
      ],
      sessionId: "cursor-1",
    });
  }
  if (request.method === "session/set_config_option") {
    write({ configId: request.params.configId, setConfigOption: true, value: request.params.value });
    return answer(request.id, {});
  }
  if (request.method === "session/load") return answer(request.id, { sessionId: request.params.sessionId });
  if (request.method === "session/prompt") return runPrompt(request);
  answer(request.id, {});
};

// The audited noise first, then the log entries the checks read.
process.stdout.write("Error: AgentKernel: WritableIterable is closed\n");
write({ args: process.argv.slice(2) });
createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method !== undefined) return onRequest(message);
  const settled = waiting.get(message.id);
  if (settled !== undefined) {
    waiting.delete(message.id);
    settled(message);
  }
});
