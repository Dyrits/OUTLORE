import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const log = process.env.COPILOT_FAKE_LOG;
const mode = process.env.COPILOT_FAKE_MODE ?? "turn";
const write = (value) => appendFileSync(log, `${JSON.stringify(value)}\n`);
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const answer = (id, result) => send({ id, jsonrpc: "2.0", result });
process.on("SIGTERM", () => process.exit(0));

// A stand-in for the Copilot CLI's ACP server as the audited profile launches it (`copilot --acp
// --no-auto-update`): a signed-out process answers `session/new` with -32000 (the shape the survey pinned),
// a signed-in session opens with model configOptions, a prompt sends an agent message, an edit tool call, and
// a mediated `session/request_permission`, and the plan-used-up mode answers the prompt with the "Add a
// payment method to continue." error the CLI itself reports.

/** The stand-in's own requests, by id, waiting for the client's response. */
const waiting = new Map();

const sessionUpdate = (sessionId, update) =>
  send({ jsonrpc: "2.0", method: "session/update", params: { sessionId, update } });

const runPrompt = (request) => {
  const sessionId = request.params.sessionId;
  if (process.env.COPILOT_FAKE_PLAN_USED_UP === "1")
    return send({
      error: { code: -32603, message: "Add a payment method to continue." },
      id: request.id,
      jsonrpc: "2.0",
    });
  sessionUpdate(sessionId, {
    content: { text: "Working", type: "text" },
    sessionUpdate: "agent_message_chunk",
  });
  sessionUpdate(sessionId, {
    kind: "edit",
    rawInput: { path: "src/index.ts" },
    sessionUpdate: "tool_call",
    title: "Edit src/index.ts",
    toolCallId: "copilot-call-1",
  });
  waiting.set(`p${request.id}`, (message) => {
    const optionId = message.result?.outcome?.optionId ?? "unanswered";
    sessionUpdate(sessionId, {
      content: { text: `edit was ${optionId}`, type: "text" },
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
      toolCall: { title: "Edit src/index.ts", toolCallId: "copilot-call-1" },
    },
  });
};

const onRequest = (request) => {
  write({ method: request.method, params: request.params });
  if (request.method === "initialize")
    return answer(request.id, { agentCapabilities: { promptCapabilities: { image: true } } });
  if (request.method === "session/new") {
    if (process.env.COPILOT_FAKE_SIGNED_OUT === "1")
      return send({
        error: { code: -32000, message: "You are not signed in to GitHub Copilot." },
        id: request.id,
        jsonrpc: "2.0",
      });
    return answer(
      request.id,
      mode === "probe"
        ? {
            configOptions: [
              {
                id: "model",
                options: [
                  { name: "GPT-5.2", value: "gpt-5.2" },
                  { name: "Claude Opus 4.6", value: "claude-opus-4.6" },
                ],
              },
            ],
            sessionId: "copilot-probe-1",
          }
        : {
            configOptions: [
              {
                id: "model",
                options: [
                  { name: "GPT-5.2", value: "gpt-5.2" },
                  { name: "Claude Opus 4.6", value: "claude-opus-4.6" },
                ],
              },
            ],
            sessionId: "copilot-1",
          },
    );
  }
  if (request.method === "session/set_config_option") {
    write({ configId: request.params.configId, setConfigOption: true, value: request.params.value });
    return answer(request.id, {});
  }
  if (request.method === "session/load") return answer(request.id, { sessionId: request.params.sessionId });
  if (request.method === "session/prompt") return runPrompt(request);
  answer(request.id, {});
};

write({ args: process.argv.slice(2), autoUpdate: process.env.COPILOT_AUTO_UPDATE ?? null });
createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method !== undefined) return onRequest(message);
  const settled = waiting.get(message.id);
  if (settled !== undefined) {
    waiting.delete(message.id);
    settled(message);
  }
});
