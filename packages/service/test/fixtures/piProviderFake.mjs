import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

// A stand-in for the Pi CLI in `--mode rpc`: probe mode answers one `get_available_models` request; turn mode
// walks the whole turn protocol (`get_state` → `prompt` → streaming → `agent_settled`), refuses a prompt it could
// not take (prompt-accepts-only), settles after `clear_queue` + `abort`, asks one extension UI question it
// expects to have refused, and can run a tool in breach of the denial flags. Everything it receives is logged
// as JSON lines to $PI_FAKE_LOG.

const args = process.argv.slice(2);
const env = process.env;
const mode = env.PI_FAKE_MODE ?? "probe";
const log = env.PI_FAKE_LOG;

// Pi's own answer shape: one JSON record a line, correlated by the id its request carried.
const write = (record) => process.stdout.write(`${JSON.stringify(record)}\n`);
const answer = (request, data) =>
  write({ command: request.type, data, id: request.id, success: true, type: "response" });
const refuse = (request, error) =>
  write({ command: request.type, error, id: request.id, success: false, type: "response" });
const entry = (fields) => {
  if (log === undefined) return;
  appendFileSync(log, `${JSON.stringify(fields)}\n`);
};

const sessionArgument = args.includes("--session") ? args[args.indexOf("--session") + 1] : null;

if (mode === "probe") {
  for (const flag of ["--mode", "rpc", "--no-session", "--no-extensions", "--no-mcp", "--no-approve"])
    if (!args.includes(flag)) process.exit(2);
} else {
  // A turn process runs with every tool source denied (fail-closed, piTools.ts).
  for (const flag of ["--mode", "rpc", "--no-tools", "--no-extensions", "--no-mcp", "--no-approve"])
    if (!args.includes(flag)) process.exit(2);
  entry({
    configDirectory: env.PI_CODING_AGENT_DIR ?? null,
    method: "start",
    session: sessionArgument,
  });
}

createInterface({ input: process.stdin }).on("line", (line) => {
  if (args.includes("hang")) return;
  const request = JSON.parse(line);
  if (mode === "probe") {
    if (request.type !== "get_available_models") process.exit(3);
    answer(request, {
      models: [
        { id: "same", provider: "deepseek" },
        { id: "same", provider: "openrouter" },
      ],
    });
    return;
  }
  handleTurn(request);
});

// --- Turn mode state -------------------------------------------------------------

const replyText = "Hello from the Pi stand-in.";
let isRunning = false;
let isAborted = false;
let isSettled = false;
let uiAnswered = false;

const sleep = (millis) => new Promise((resolve) => setTimeout(resolve, millis));

/** The session the turn process continues, or a fresh one when the continued one is missing. */
const sessionFileOf = () =>
  sessionArgument !== null && env.PI_FAKE_MISSING_SESSION !== sessionArgument
    ? sessionArgument
    : (env.PI_FAKE_SESSION ?? "pi-1");

/** Ends the running turn: an aborted message when it was aborted, reply and settle otherwise. */
const settle = () => {
  if (isSettled) return;
  isSettled = true;
  isRunning = false;
  if (isAborted) {
    write({ message: { content: [], role: "assistant", stopReason: "aborted" }, type: "message_end" });
  } else {
    write({ assistantMessageEvent: { delta: replyText, type: "text_delta" }, type: "message_update" });
    write({
      message: { content: [{ text: replyText, type: "text" }], role: "assistant", stopReason: "end_turn" },
      type: "message_end",
    });
  }
  write({ type: "agent_settled" });
};

/** The scripted turn after a prompt was taken in. */
const run = async () => {
  await sleep(50);
  if (isAborted) return settle();
  if (env.PI_FAKE_UI_QUESTION === "1" && !isAborted) {
    write({ id: "ui-1", prompt: "Allow file access?", type: "extension_ui_request" });
    entry({ id: "ui-1", method: "ui_question" });
    for (let attempt = 0; attempt < 100 && !uiAnswered && !isAborted; attempt += 1) await sleep(20);
  }
  if (isAborted) return settle();
  if (env.PI_FAKE_TOOL_BREACH === "1") {
    entry({ method: "tool_breach", toolName: "shell" });
    write({ id: "tool-1", toolName: "shell", type: "tool_execution_start" });
    return;
  }
  if (env.PI_FAKE_SLOW !== undefined) await sleep(Number(env.PI_FAKE_SLOW));
  settle();
};

const handleTurn = (request) => {
  switch (request.type) {
    case "get_available_models": {
      entry({ method: "get_available_models" });
      return answer(request, { models: [{ id: "same", provider: "deepseek" }] });
    }
    case "get_state": {
      entry({ method: "get_state", sessionFile: sessionFileOf() });
      return answer(request, { sessionFile: sessionFileOf() });
    }
    case "set_model": {
      entry({ method: "set_model", modelId: request.modelId, provider: request.provider });
      return answer(request, {});
    }
    case "set_thinking_level": {
      entry({ level: request.level, method: "set_thinking_level" });
      return answer(request, {});
    }
    case "prompt": {
      if (isRunning || env.PI_FAKE_REFUSE_PROMPT === "1") {
        entry({ method: "prompt", refused: true });
        return refuse(request, "A turn is already running.");
      }
      isRunning = true;
      isSettled = false;
      entry({ message: request.message, method: "prompt" });
      answer(request, { disposition: "started" });
      run();
      return;
    }
    case "clear_queue": {
      entry({ method: "clear_queue" });
      return answer(request, {});
    }
    case "abort": {
      entry({ method: "abort" });
      if (isRunning && !isAborted) {
        isAborted = true;
        settle();
      }
      return answer(request, {});
    }
    case "get_session_stats": {
      return answer(request, { tokens: { cacheRead: 2, cacheWrite: 1, input: 10, output: 5 } });
    }
    case "extension_ui_response": {
      uiAnswered = true;
      entry({ cancelled: request.cancelled === true, method: "extension_ui_response" });
      return;
    }
    default: {
      entry({ method: request.type === undefined ? "unknown" : request.type });
      return answer(request, {});
    }
  }
};
