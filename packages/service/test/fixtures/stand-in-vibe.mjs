// A scripted stand-in for `vibe-acp`, shaped after the Agent Client Protocol as mistral-vibe 3.1.3 spoke it
// (agent-client-protocol 0.11.0). STAND_IN_LOG receives one JSON line per process start ({ args, cwd, env }) and
// one per request ({ method, params }). `session/new` answers with modes and config options (`mode`, `model`,
// `thinking`), `model` listing two models, `mistral-large-4` carrying its thinking levels in `_meta`.
// A prompt's text decides what it does: "run <command>" or "edit <path>" first sends a `tool_call` update, then asks
// permission naming only the tool call's id, and ends the turn saying which option was chosen (a denial lets the
// turn carry on, as Vibe does); "slow <millis>" keeps the turn running; anything else is echoed. Usage answers are
// cumulative for the session, as Vibe's are. `session/load` fails for ids listed in STAND_IN_VIBE_MISSING_SESSIONS.
// `_account/read` answers a ready account with a plan and a monthly budget unless STAND_IN_VIBE_BUDGET is "none";
// `_identity/read` answers an email unless STAND_IN_VIBE_EMAIL is "none".
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const log = (entry) => {
  if (process.env.STAND_IN_LOG) appendFileSync(process.env.STAND_IN_LOG, `${JSON.stringify(entry)}\n`);
};
log({ args: process.argv.slice(2), cwd: process.cwd(), env: { VIBE_HOME: process.env.VIBE_HOME } });

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const update = (sessionId, body) => send({ method: "session/update", params: { sessionId, update: body } });

const configOptions = {
  mode: {
    category: "mode",
    currentValue: "accept-edits",
    id: "mode",
    name: "Session Mode",
    options: [
      { name: "Ask", value: "ask" },
      { name: "Accept Edits", value: "accept-edits" },
    ],
    type: "select",
  },
  model: {
    category: "model",
    currentValue: "mistral-large-4",
    id: "model",
    name: "Model",
    options: [
      {
        _meta: { "mistral.ai/thinking": { default: "high", levels: ["off", "low", "medium", "high", "xhigh", "max"] } },
        name: "Mistral Large 4",
        value: "mistral-large-4",
      },
      { name: "Mistral Medium 3.5", value: "mistral-medium-3.5" },
    ],
    type: "select",
  },
  thinking: {
    category: "thinking",
    currentValue: "high",
    id: "thinking",
    name: "Thinking",
    options: ["off", "low", "medium", "high", "xhigh", "max"].map((value) => ({ name: value, value })),
    type: "select",
  },
};

let current = null;
// Cumulative for the session, as Vibe's usage answers are, starting at zero like a new session's.
let usage = { cachedReadTokens: 0, inputTokens: 0, outputTokens: 0, thoughtTokens: 0 };

const finish = (stopReason, text) => {
  const prompt = current;
  if (prompt === null) return;
  current = null;
  clearTimeout(prompt.timer);
  if (text !== null)
    for (const word of text.split(" "))
      update(prompt.sessionId, { content: { text: `${word} `, type: "text" }, sessionUpdate: "agent_message_chunk" });
  usage = {
    cachedReadTokens: usage.cachedReadTokens + 40,
    inputTokens: usage.inputTokens + 90,
    outputTokens: usage.outputTokens + 6,
    thoughtTokens: usage.thoughtTokens + 2,
  };
  send({
    id: prompt.id,
    result: { stopReason, usage: { ...usage, totalTokens: usage.inputTokens + usage.outputTokens } },
  });
};

const askPermission = async (prompt, subject, toolCall) => {
  update(prompt.sessionId, {
    kind: toolCall.kind,
    rawInput: toolCall.rawInput,
    sessionUpdate: "tool_call",
    status: "pending",
    title: subject,
    toolCallId: "call-1",
  });
  const answer = await ask("session/request_permission", {
    options: [
      { kind: "allow_once", name: "Allow once", optionId: "allow_once" },
      { kind: "reject_once", name: "Deny", optionId: "reject_once" },
    ],
    sessionId: prompt.sessionId,
    toolCall: { toolCallId: "call-1" },
  });
  if (answer.outcome?.optionId === "reject_once")
    update(prompt.sessionId, { sessionUpdate: "tool_call_update", status: "failed", toolCallId: "call-1" });
  return finish("end_turn", `${subject}: ${answer.outcome?.optionId ?? answer.outcome?.outcome}`);
};

const waiting = new Map();
const ask = (method, params) =>
  new Promise((resolve) => {
    const id = `ask-${waiting.size + 1}`;
    waiting.set(id, resolve);
    // Logged like a received request, so checks can read what the stand-in asked the client.
    log({ method, params });
    send({ id, method, params });
  });

const modes = [
  { id: "ask", name: "Ask" },
  { id: "accept-edits", name: "Accept Edits" },
];

const runPrompt = async (prompt, text) => {
  const run = /(?:^|\n)run (.+)$/.exec(text);
  if (run !== null) return askPermission(prompt, run[1], { kind: "execute", rawInput: { command: run[1] } });
  const edit = /(?:^|\n)edit (.+)$/.exec(text);
  if (edit !== null)
    return askPermission(prompt, edit[1], {
      kind: "edit",
      rawInput: { newString: "new", oldString: "old", path: edit[1] },
    });
  const slow = /(?:^|\n---\n\n)slow (\d+)$/.exec(text);
  prompt.timer = setTimeout(() => finish("end_turn", `Echo: ${text}`), slow === null ? 10 : Number(slow[1]));
};

createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === undefined) {
    waiting.get(message.id)?.(message.result ?? message.error);
    waiting.delete(message.id);
    return;
  }
  log({ method: message.method, params: message.params });
  const { id, method, params } = message;
  if (method === "initialize")
    return send({
      id,
      result: {
        agentCapabilities: {
          loadSession: true,
          ...(process.env.STAND_IN_VIBE_IMAGES === undefined
            ? {}
            : { promptCapabilities: { image: process.env.STAND_IN_VIBE_IMAGES === "true" } }),
        },
        authMethods: [],
        protocolVersion: 1,
      },
    });
  if (method === "session/new")
    return send({
      id,
      result: {
        configOptions: [configOptions.mode, configOptions.model, configOptions.thinking],
        modes: { availableModes: modes, currentModeId: "accept-edits" },
        sessionId: `vibe-${process.pid}`,
      },
    });
  if (method === "session/load") {
    if ((process.env.STAND_IN_VIBE_MISSING_SESSIONS ?? "").split(",").includes(params.sessionId))
      return send({ error: { code: -32603, message: `Session not found: ${params.sessionId}` }, id });
    update(params.sessionId, { content: { text: "old reply", type: "text" }, sessionUpdate: "agent_message_chunk" });
    return send({
      id,
      result: {
        configOptions: [configOptions.mode, configOptions.model, configOptions.thinking],
        modes: { availableModes: modes, currentModeId: "accept-edits" },
      },
    });
  }
  if (method === "session/set_config_option")
    return send({ id, result: { configOptions: [configOptions.mode, configOptions.model, configOptions.thinking] } });
  if (method === "session/prompt") {
    current = { id, sessionId: params.sessionId, timer: null };
    update(params.sessionId, { sessionUpdate: "usage_update", size: 200_000, used: 1234 });
    return void runPrompt(
      current,
      params.prompt
        .map((part) => part.text ?? "")
        .join("")
        .split("\n\n")
        .at(-1),
    );
  }
  if (method === "session/cancel") return finish("cancelled", null);
  if (method === "_account/read")
    return send({
      id,
      result: {
        budget:
          process.env.STAND_IN_VIBE_BUDGET === "none"
            ? null
            : { resetAt: "2026-12-01T00:00:00.000Z", usagePercentage: 40 },
        plan: { kind: process.env.STAND_IN_VIBE_PLAN ?? "chat", name: "Pro", title: "Pro plan" },
        status: "ready",
      },
    });
  if (method === "_identity/read")
    return send({
      id,
      result: process.env.STAND_IN_VIBE_EMAIL === "none" ? {} : { email: "owner@example.com", id: "id-1" },
    });
  if (id !== undefined) send({ error: { code: -32601, message: `unknown method ${method}` }, id });
});
