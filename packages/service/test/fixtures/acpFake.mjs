import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

// One configurable stand-in for an ACP agent, standing in for every provider of the generic adapter (Antigravity, Cline,
// Copilot, Cursor, Devin, Hermes, Kimi) so that a protocol check is written once and each provider's own fact is a knob.
// ACP_FAKE_LOG receives one JSON line per process start ({ launch }) and per request ({ launch, method, params }), where
// `launch` is the argv and the environment variables named in `logEnv` as this process saw them, and {"exit":true} when
// it is ended. ACP_FAKE holds the knobs as JSON; every one is optional (see `defaults`).
//
// A prompt sends an agent message, a tool call, and a `session/request_permission` naming the tool call; the answer
// becomes the next agent message, then the prompt ends (a denial lets the turn carry on, as the providers do).

const defaults = {
  // The context the `usage_update` reports as used, when one is sent.
  contextUsed: 1234,
  // `diff`: a completed update carrying an ACP diff block follows an allowed tool call (the standard file-edit shape).
  diff: false,
  // Whether a probe's models come as `models.availableModels` ("models") or as a `model` config option ("config").
  form: "config",
  // The agent's capability answers.
  images: true,
  // `interaction`: the permission request is a question whose tool call id starts with `interaction_` (Antigravity).
  interaction: false,
  // Environment variable names whose values the log records, as the launch surface a check reads.
  logEnv: [],
  mcpHttp: false,
  // A session id this process answers `session/load` and `session/resume` with an error for.
  missingSession: null,
  // "probe" opens a session that only lists models; "turn" opens one with `options` and `modes`.
  mode: "turn",
  // The models a session offers, as [name, value].
  models: [["Model A", "model-a"]],
  // The modes a turn session lists, by id; none by default.
  modes: [],
  // Prints the noise line Cursor's own CLI prints on stdout before anything.
  noise: false,
  // The config options a turn session offers, by id.
  options: ["model"],
  // Options of the permission request, as ACP `PermissionOption`s; the allow and reject once by default.
  permissionOptions: null,
  // The turn's own failure, a JSON-RPC error answered to `session/prompt`.
  planUsedUp: false,
  // The session ids a probe and a turn open.
  probeSessionId: "probe",
  // `session/resume`, advertised as `sessionCapabilities.resume`; `resumeFails` answers it with an error while `session/load` works.
  resume: false,
  resumeFails: false,
  sessionId: "acp-1",
  // The signed-out answer to `session/new`: { code, message }.
  signedOut: null,
  slow: false,
  // Sends one reverse request Outlore does not know (`session/set_mode`) to prove the answer fails closed.
  strict: false,
  // The tool call the prompt makes, and the word the reply uses for what the owner chose.
  tool: {
    answerPrefix: "tool",
    id: "call-1",
    kind: "command",
    rawInput: { command: "git push origin main" },
    title: "git push",
  },
  // "none" reports no usage; "update" reports token fields in a `usage_update`; "response" reports them in the prompt's
  // own answer and the context window in a `usage_update` (the ACP shapes).
  usage: "none",
};
const config = { ...defaults, ...JSON.parse(process.env.ACP_FAKE ?? "{}") };
const tool = { ...defaults.tool, ...config.tool };

const log = process.env.ACP_FAKE_LOG;
const launch = {
  argv: process.argv.slice(2),
  env: Object.fromEntries(config.logEnv.map((name) => [name, process.env[name] ?? null])),
};
const write = (value) => appendFileSync(log, `${JSON.stringify(value)}\n`);
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const answer = (id, result) => send({ id, jsonrpc: "2.0", result });
const fail = (id, code, message) => send({ error: { code, message }, id, jsonrpc: "2.0" });
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

const endPrompt = (sessionId, id, stopReason) => {
  if (config.usage === "update")
    sessionUpdate(sessionId, {
      cachedReadTokens: 2,
      inputTokens: 10,
      outputTokens: 5,
      sessionUpdate: "usage_update",
      ...(config.contextUsed === null ? {} : { size: 200_000, used: config.contextUsed }),
    });
  if (config.usage === "response") {
    sessionUpdate(sessionId, { sessionUpdate: "usage_update", size: 200_000, used: config.contextUsed });
    return answer(id, {
      stopReason,
      usage: { cachedReadTokens: 2, inputTokens: 10, outputTokens: 5, thoughtTokens: 1, totalTokens: 18 },
    });
  }
  return answer(id, { stopReason });
};

const runPrompt = (request) => {
  const sessionId = request.params.sessionId;
  if (config.planUsedUp) return fail(request.id, -32603, "Add a payment method to continue.");
  sessionUpdate(sessionId, { content: { text: "Working", type: "text" }, sessionUpdate: "agent_message_chunk" });
  if (config.slow) {
    cancellable = { settle: () => endPrompt(sessionId, request.id, "cancelled") };
    return;
  }
  if (config.strict) {
    send({ id: `strict${request.id}`, jsonrpc: "2.0", method: "session/set_mode", params: { mode: "yolo" } });
    waiting.set(`strict${request.id}`, (message) => {
      write({ strictAnswer: message.error?.message ?? "answered" });
      answer(request.id, { stopReason: "end_turn" });
    });
    return;
  }
  const toolCallId = config.interaction ? "interaction_1" : tool.id;
  sessionUpdate(sessionId, {
    kind: tool.kind,
    rawInput: tool.rawInput,
    sessionUpdate: "tool_call",
    title: tool.title,
    toolCallId,
  });
  waiting.set(`p${request.id}`, (message) => {
    const outcome = message.result?.outcome;
    sessionUpdate(sessionId, {
      content: {
        text: `${tool.answerPrefix} was ${outcome?.optionId ?? outcome?.outcome ?? "unanswered"}`,
        type: "text",
      },
      sessionUpdate: "agent_message_chunk",
    });
    if (config.diff && outcome?.optionId === "allow_once")
      sessionUpdate(sessionId, {
        content: [{ newText: "new\n", oldText: "old\n", path: "notes.txt", type: "diff" }],
        sessionUpdate: "tool_call_update",
        status: "completed",
        toolCallId,
      });
    endPrompt(sessionId, request.id, "end_turn");
  });
  send({
    id: `p${request.id}`,
    jsonrpc: "2.0",
    method: "session/request_permission",
    params: {
      options: config.permissionOptions ?? [
        { kind: "allow_once", name: "Allow once", optionId: "allow_once" },
        { kind: "reject_once", name: "Reject", optionId: "reject_once" },
      ],
      sessionId,
      toolCall: { title: tool.title, toolCallId },
    },
  });
};

const modelOptions = () => config.models.map(([name, value]) => ({ name, value }));

const turnConfigOptions = () =>
  config.options.map((id) => ({
    id,
    options: id === "model" ? modelOptions() : [{ name: "High", value: "high" }],
  }));

const sessionNew = (request) => {
  if (config.signedOut !== null) return fail(request.id, config.signedOut.code, config.signedOut.message);
  if (config.mode === "turn")
    return answer(request.id, {
      configOptions: turnConfigOptions(),
      ...(config.modes.length === 0 ? {} : { modes: { availableModes: config.modes.map((id) => ({ id })) } }),
      sessionId: config.sessionId,
    });
  return answer(
    request.id,
    config.form === "models"
      ? {
          models: { availableModels: config.models.map(([name, modelId]) => ({ modelId, name })) },
          sessionId: config.probeSessionId,
        }
      : { configOptions: [{ id: "model", options: modelOptions() }], sessionId: config.probeSessionId },
  );
};

const onRequest = (request) => {
  write({ launch, method: request.method, params: request.params });
  if (request.method === "initialize")
    return answer(request.id, {
      agentCapabilities: {
        ...(config.mcpHttp ? { mcpCapabilities: { http: true } } : {}),
        promptCapabilities: { image: config.images },
        sessionCapabilities: config.resume ? { resume: {} } : {},
      },
    });
  if (request.method === "session/new") return sessionNew(request);
  if (request.method === "session/load" || request.method === "session/resume") {
    if (request.method === "session/resume" && config.resumeFails) return fail(request.id, -32601, "resume failed");
    if (config.missingSession === request.params.sessionId) return fail(request.id, -32602, "session not found");
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

if (config.noise) process.stdout.write("Error: AgentKernel: WritableIterable is closed\n");
write({ launch });
createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method !== undefined) return onRequest(message);
  const settled = waiting.get(message.id);
  if (settled !== undefined) {
    waiting.delete(message.id);
    settled(message);
  }
});
