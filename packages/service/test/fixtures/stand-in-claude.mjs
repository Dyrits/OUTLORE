// A scripted stand-in for `claude -p` in stream-json mode, shaped after
// transcripts captured from Claude Code 2.1.302. Behavior is set by environment:
// STAND_IN_LOG: file that receives one JSON line per process start ({ pid, args, cwd, env, pwd }); `cwd` is the folder
// the system reports, a link's target, and `pwd` the folder the adapter said it started in.
// STAND_IN_INPUT: file that receives each line written to the stand-in's stdin.
// STAND_IN_COST: set to report a running total_cost_usd of 0.01 per turn.
// STAND_IN_API_KEY_SOURCE: set to report that `apiKeySource` in the init event ("none" for a subscription sign-in).
// STAND_IN_MCP_STATUS: set to report that status for the "outlore" server in the init event's `mcp_servers` ("failed", as
// probed on Claude Code 2.1.325 with a server that cannot start: `[{ name, status: "failed", source: "dynamic" }]`).
// STAND_IN_MODE: "ok" (default), "fail-start" (exit 1 before answering), "error-result".
// A message "slow <millis>" keeps its turn running that long. A message written during a turn joins it
// and is echoed with its uuid (--replay-user-messages), unless its text contains "unseen": that one is
// held, as when it arrives just after the turn ends, and runs as a turn of its own 200 ms after the
// result, as Claude Code does. An `interrupt` control request ends the running turn.
// A message "background <millis>" ends its turn at once, with a background command still running, as Claude Code does
// (`background_tasks_changed`; probe of 2026-11-20, 2.1.328); that many ms later the command ends and Claude Code wakes
// itself: a `task_notification`, then a turn of its own with no message written to it.
// A message "ask-net <host>" makes the turn send a `can_use_tool` control request for the blocked host, as Claude Code 2.1.322
// does for a host outside `allowedDomains` (live probe of 2026-11-12), and reply with the answer it got; "ask-bash-escape"
// does the same for a Bash call outside the sandbox. A turn waits 300 ms for an answer and reports "unanswered" otherwise.
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const sessionId = option("--session-id") ?? option("--resume");
const mode = process.env.STAND_IN_MODE ?? "ok";
if (process.env.STAND_IN_LOG) {
  const env = Object.keys(process.env).filter((key) => key.startsWith("OUTLORE_"));
  const home = process.env.CLAUDE_CONFIG_DIR ?? null;
  appendFileSync(
    process.env.STAND_IN_LOG,
    `${JSON.stringify({ args, cwd: process.cwd(), env, home, pid: process.pid, pwd: process.env.PWD ?? null })}\n`,
  );
}
if (mode === "fail-start") {
  process.stderr.write("stand-in: cannot start\n");
  process.exit(1);
}

const emit = (event) => process.stdout.write(`${JSON.stringify({ ...event, session_id: sessionId })}\n`);
emit({
  ...(process.env.STAND_IN_API_KEY_SOURCE === undefined ? {} : { apiKeySource: process.env.STAND_IN_API_KEY_SOURCE }),
  ...(process.env.STAND_IN_MCP_STATUS === undefined
    ? {}
    : { mcp_servers: [{ name: "outlore", source: "dynamic", status: process.env.STAND_IN_MCP_STATUS }] }),
  model: option("--model") ?? "default",
  subtype: "init",
  tools: [],
  type: "system",
});

let turn = 0;
/** The answers a control request of the stand-in waits for, by request id. */
const answers = new Map();
/** The running turn: its first message, messages joined to it, held messages, and its timer. */
let current = null;

const reply = (text) => {
  emit({ event: { type: "message_start" }, type: "stream_event" });
  for (const word of text.split(" ")) {
    emit({
      event: { delta: { text: `${word} `, type: "text_delta" }, type: "content_block_delta" },
      type: "stream_event",
    });
  }
  // STAND_IN_COMPACT: Claude Code compacted the conversation before this call (its `compact_boundary` system event).
  if (process.env.STAND_IN_COMPACT !== undefined)
    emit({
      compact_metadata: { post_tokens: 12000, pre_tokens: Number(process.env.STAND_IN_COMPACT), trigger: "auto" },
      subtype: "compact_boundary",
      type: "system",
    });
  // The latest call's own usage, smaller than the result's sum over the turn's calls.
  emit({
    message: {
      content: [{ text, type: "text" }],
      model: process.env.STAND_IN_MODEL ?? "claude-sonnet-5-5",
      role: "assistant",
      usage: { cache_creation_input_tokens: 5, cache_read_input_tokens: 60, input_tokens: 3, output_tokens: 7 },
    },
    type: "assistant",
  });
  emit({
    is_error: false,
    result: text,
    subtype: "success",
    ...(process.env.STAND_IN_COST === undefined ? {} : { total_cost_usd: turn / 100 }),
    // STAND_IN_CONTEXT_WINDOW: the result names each model the turn used with its context window, as Claude Code's
    // does, the thread's own model beside a helper model with another window.
    ...(process.env.STAND_IN_CONTEXT_WINDOW === undefined
      ? {}
      : {
          modelUsage: {
            "claude-haiku-5-5": { contextWindow: 150000, inputTokens: 1, maxOutputTokens: 32000, outputTokens: 1 },
            [process.env.STAND_IN_MODEL ?? "claude-sonnet-5-5"]: {
              contextWindow: Number(process.env.STAND_IN_CONTEXT_WINDOW),
              inputTokens: 2,
              maxOutputTokens: 64000,
              outputTokens: 10,
            },
          },
        }),
    type: "result",
    usage: { cache_creation_input_tokens: 50, cache_read_input_tokens: 100, input_tokens: 2, output_tokens: 10 },
  });
};

const finish = (isInterrupted) => {
  const ended = current;
  current = null;
  clearTimeout(ended.timer);
  if (isInterrupted) {
    emit({
      message: { content: [{ text: "[Request interrupted by user]", type: "text" }], role: "user" },
      type: "user",
    });
    emit({ is_error: true, subtype: "error_during_execution", type: "result" });
  } else {
    const joined = ended.joined.length === 0 ? "" : ` + ${ended.joined.join(" + ")}`;
    reply(`Reply ${ended.turn} (pid ${process.pid}) to: ${ended.text}${joined}`);
  }
  if (ended.held.length > 0) setTimeout(() => ended.held.forEach(startTurn), 200);
};

/** The command ends: the stand-in is woken and works on its own, with no user message, as Claude Code does. */
const wake = () => {
  turn += 1;
  emit({
    status: "completed",
    subtype: "task_notification",
    summary: 'Background command "Sleep" completed (exit code 0)',
    task_id: "bg1",
    type: "system",
  });
  emit({ subtype: "background_tasks_changed", tasks: [], type: "system" });
  emit({ model: option("--model") ?? "default", subtype: "init", tools: [], type: "system" });
  emit({
    message: {
      content: [
        {
          id: `toolu_wake_${turn}`,
          input: { command: "git status", description: "Check" },
          name: "Bash",
          type: "tool_use",
        },
      ],
      role: "assistant",
    },
    type: "assistant",
  });
  reply(`Woken ${turn} (pid ${process.pid}) after the background command`);
};

let shouldWakeBeforePrompt = false;

const startTurn = (input) => {
  if (shouldWakeBeforePrompt) {
    shouldWakeBeforePrompt = false;
    wake();
  }
  // A message with images carries a list of blocks: the text, then one image block each.
  const content = input.message.content;
  const text = typeof content === "string" ? content : (content.find((block) => block.type === "text")?.text ?? "");
  turn += 1;
  emit({ message: input.message, type: "user", uuid: input.uuid ?? "stand-in" });
  if (mode === "error-result") {
    emit({
      error: "model_not_found",
      message: { content: [{ text: "There's an issue with the selected model.", type: "text" }], role: "assistant" },
      type: "assistant",
    });
    emit({ is_error: true, result: "There's an issue with the selected model.", subtype: "success", type: "result" });
    return;
  }
  // The turn's note, when there is one, precedes the messages after a "---" line.
  const ask = /(?:^|\n---\n\n)(ask-net (\S+)|ask-bash-escape)$/.exec(text);
  if (ask !== null) {
    const requestId = `ask-${turn}`;
    const isNetwork = ask[2] !== undefined;
    emit({
      request: {
        input: isNetwork ? { host: ask[2] } : { command: "echo hi", dangerouslyDisableSandbox: true },
        subtype: "can_use_tool",
        tool_name: isNetwork ? "SandboxNetworkAccess" : "Bash",
        tool_use_id: `toolu_${turn}`,
      },
      request_id: requestId,
      type: "control_request",
    });
    current = { held: [], joined: [], text, timer: null, turn };
    current.timer = setTimeout(() => {
      answers.delete(requestId);
      current.joined.push("unanswered");
      finish(false);
    }, 300);
    answers.set(requestId, (behavior) => {
      clearTimeout(current.timer);
      current.joined.push(`answered ${behavior}`);
      finish(false);
    });
    return;
  }
  // A turn that reads a file, runs a read-only command, and calls an Outlore tool before it replies.
  if (/(?:^|\n---\n\n)use-tools$/.test(text)) {
    emit({
      message: {
        content: [
          { id: `toolu_read_${turn}`, input: { file_path: "/work/entries.ts" }, name: "Read", type: "tool_use" },
          {
            id: `toolu_bash_${turn}`,
            input: { command: "ls -la\nwc -l", description: "List the folder" },
            name: "Bash",
            type: "tool_use",
          },
          { id: `toolu_note_${turn}`, input: {}, name: "mcp__outlore__update_journal", type: "tool_use" },
          { id: `toolu_ask_${turn}`, input: {}, name: "mcp__outlore__request_approval", type: "tool_use" },
        ],
        role: "assistant",
      },
      type: "assistant",
    });
  }
  const background = /(?:^|\n---\n\n)background (\d+|overlap)$/.exec(text);
  if (background !== null) {
    emit({
      subtype: "background_tasks_changed",
      tasks: [{ description: "Sleep", task_id: "bg1", task_type: "local_bash" }],
      type: "system",
    });
    current = { held: [], joined: [], text, timer: null, turn };
    finish(false);
    if (background[1] === "overlap") shouldWakeBeforePrompt = true;
    else setTimeout(wake, Number(background[1]));
    return;
  }
  const slow = /(?:^|\n---\n\n)slow (\d+)$/.exec(text);
  current = { held: [], joined: [], text, timer: null, turn };
  if (slow === null) finish(false);
  else current.timer = setTimeout(() => finish(false), Number(slow[1]));
};

createInterface({ input: process.stdin }).on("line", (line) => {
  if (process.env.STAND_IN_INPUT) appendFileSync(process.env.STAND_IN_INPUT, `${line}\n`);
  const input = JSON.parse(line);
  if (input.type === "control_response") {
    const respond = answers.get(input.response?.request_id);
    answers.delete(input.response?.request_id);
    respond?.(input.response?.response?.behavior ?? "none");
    return;
  }
  if (input.type === "control_request") {
    const stillQueued = current === null ? [] : current.held.map((held) => held.uuid);
    emit({
      response: { request_id: input.request_id, response: { still_queued: stillQueued }, subtype: "success" },
      type: "control_response",
    });
    if (input.request?.subtype === "interrupt" && current !== null) finish(true);
    return;
  }
  if (current === null) return startTurn(input);
  if (input.message.content.includes("unseen")) return current.held.push(input);
  emit({ message: input.message, type: "user", uuid: input.uuid });
  current.joined.push(input.message.content);
});
