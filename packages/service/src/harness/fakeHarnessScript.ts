import type { BillingKind, TokenUsage } from "@outlore/contracts";
import { type Deferred, Effect } from "effect";
import { fieldOf, HarnessFailure, type ImageAttachment, type TurnRequest, textFieldOf } from "../core/index.ts";
import { claudeChoicesOf } from "./claudeChoices.ts";
import { claudeToolCallOf } from "./claudeToolCalls.ts";

/** Calls one tool on a thread's MCP endpoint and returns its text, as a harness would; for the fake and checks. */
export const callThreadTool = (mcpUrl: string, name: string, args: unknown) =>
  Effect.promise(async () => {
    const response = await fetch(mcpUrl, {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/call", params: { arguments: args, name } }),
      headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
      method: "POST",
    });
    const body = await response.text();
    const data = body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice("data: ".length))
      .join("");
    const content = fieldOf(fieldOf(JSON.parse(data), "result"), "content");
    return Array.isArray(content) ? content.map((block) => String(fieldOf(block, "text") ?? "")).join("") : "";
  });

// The billing kinds the script's `billing` line names, narrowed from the line's capture.
const billingKinds: Readonly<Record<string, BillingKind>> = {
  ApiKey: "ApiKey",
  Subscription: "Subscription",
  Unknown: "Unknown",
};

// The four token counts a `usage` or `callusage` line carries, read in the same order.
const tokenUsageOf = (match: RegExpExecArray): TokenUsage => ({
  cacheCreation: Number(match[4]),
  cacheRead: Number(match[3]),
  input: Number(match[1]),
  output: Number(match[2]),
});

/** The reply a `write` line writes, up to `length` characters: the same text on every run, so a screen's copy can be compared. */
export const fakeDraftOf = (length: number) =>
  Array.from({ length }, (_, index) => String.fromCharCode(97 + (index % 26))).join("");

/** What the echo says of the images a message carries, so checks see that they reached the harness. */
export const imagesNoteOf = (images: ReadonlyArray<ImageAttachment>) =>
  images.length === 0 ? "" : ` [images: ${images.map((image) => image.name).join(", ")}]`;

/** A fake turn in progress: the messages steered into it, its spend state, and its interrupt signal. */
export type FakeTurn = {
  readonly interrupted: Deferred.Deferred<void>;
  readonly onEvent: TurnRequest["onEvent"];
  /** What the turn's `spend` lines reported. */
  readonly spent: {
    tokens: number;
    cost: number | null;
    isReported: boolean;
    billing: BillingKind | null;
    kinds: TokenUsage | null;
    callUsage: TokenUsage | null;
    /** The context window the turn's `window` line reported. */
    contextWindow: number | null;
  };
  readonly steered: Array<string>;
};

/** Counts the calls a `tooluse` line reports, so each has its own id. */
let reportedCalls = 0;

/** Interprets one scripted fake-harness command line into an Effect, or returns null for plain echo text. */
export const scriptedCall = (request: TurnRequest, line: string, turn: FakeTurn) => {
  const access = request.access;
  const spend = /^spend (\d+)(?: (\d+(?:\.\d+)?))?$/.exec(line);
  if (spend !== null) {
    return Effect.sync(() => {
      turn.spent.tokens += Number(spend[1]);
      if (spend[2] !== undefined) turn.spent.cost = (turn.spent.cost ?? 0) + Number(spend[2]);
      turn.spent.isReported = true;
      return `spent ${spend[1]}`;
    });
  }
  // `write <characters> <delta> [pause millis]` streams a reply of `fakeDraftOf(characters)` as drafts, `delta` characters at a time, each draft carrying the whole text so far.
  const write = /^write (\d+) (\d+)(?: (\d+))?$/.exec(line);
  if (write !== null) {
    return Effect.gen(function* () {
      const total = Number(write[1]);
      const delta = Math.max(1, Number(write[2]));
      const pause = Number(write[3] ?? 0);
      for (let length = delta; ; length += delta) {
        const written = Math.min(length, total);
        yield* request.onEvent({ _tag: "Draft", text: fakeDraftOf(written) });
        if (written >= total) break;
        if (pause > 0) yield* Effect.sleep(pause);
      }
      return `wrote ${total}`;
    });
  }
  const window = /^window (\d+)$/.exec(line);
  if (window !== null) {
    return Effect.sync(() => {
      turn.spent.contextWindow = Number(window[1]);
      return `window ${window[1]}`;
    });
  }
  const call = /^callusage (\d+) (\d+) (\d+) (\d+)$/.exec(line);
  if (call !== null) {
    return Effect.sync(() => {
      turn.spent.callUsage = tokenUsageOf(call);
      return "call used tokens";
    });
  }
  const kinds = /^usage (\d+) (\d+) (\d+) (\d+)$/.exec(line);
  if (kinds !== null) {
    return Effect.sync(() => {
      turn.spent.kinds = tokenUsageOf(kinds);
      turn.spent.isReported = true;
      return "used tokens";
    });
  }
  const billing = /^billing (Subscription|ApiKey|Unknown)$/.exec(line);
  if (billing !== null) {
    return Effect.sync(() => {
      turn.spent.billing = billingKinds[billing[1] ?? ""] ?? "Unknown";
      return `billed ${billing[1]}`;
    });
  }
  // `fail <harness> <reason>` ends the turn as a failure when it runs on that harness, as one that cannot run does.
  const failure = /^fail (\S+) (.*)$/.exec(line);
  if (failure !== null && failure[1] === request.harness)
    return Effect.fail(new HarnessFailure({ reason: failure[2] ?? "" }));
  if (line === "cwd") return Effect.succeed(request.cwd);
  // What the turn runs on, and whether it continues a harness session or starts one.
  if (line === "runner")
    return Effect.succeed(
      `${request.harness}/${request.model}/${request.effort}/${request.sessionId === null ? "session none" : `session ${request.sessionId}`}`,
    );
  if (line === "context")
    return Effect.succeed([request.context, request.note].filter((part) => part !== null).join("\n\n"));
  const wait = /^wait (\d+)$/.exec(line);
  if (wait !== null) return Effect.sleep(Number(wait[1])).pipe(Effect.as(`waited ${wait[1]}`));
  // `tooluse <tool> <json>` reports a harness tool call as it starts, as Claude Code's assistant message does, and runs nothing.
  const reported = /^tooluse (\S+) (.*)$/.exec(line);
  if (reported !== null) {
    const toolName = reported[1] ?? "";
    const call = { id: `toolu_fake_${++reportedCalls}`, input: JSON.parse(reported[2] ?? "{}"), toolName };
    return (
      request.harness === "claude"
        ? claudeToolCallOf(call, request.cwd)
        : Effect.succeed({ _tag: "ToolCall" as const, ...call })
    ).pipe(Effect.flatMap(request.onEvent), Effect.as(`reported ${toolName}`));
  }
  const tool = /^call (\S+) (.*)$/.exec(line);
  if (tool !== null) return callThreadTool(access.mcpUrl, tool[1] ?? "", JSON.parse(tool[2] ?? "{}"));
  if (line.startsWith("ask ")) return callThreadTool(access.mcpUrl, "request_approval", JSON.parse(line.slice(4)));
  const prompt = /^(prompt|escape) (\S+) (.*)$/.exec(line);
  if (prompt !== null) {
    const input: unknown = JSON.parse(prompt[3] ?? "{}");
    const choices = claudeChoicesOf(prompt[2] ?? "", input);
    return request
      .askOwner({
        input,
        ...(choices === null ? {} : { choices }),
        isOutsideSandbox: prompt[1] === "escape",
        toolName: prompt[2] ?? "",
      })
      .pipe(
        Effect.map((answer) =>
          answer.answers !== undefined
            ? `prompt answered: ${JSON.stringify(answer.answers)}`
            : answer.isAllowed
              ? "prompt allowed"
              : `prompt denied: ${answer.text}`,
        ),
      );
  }
  // `folder <tool> <json>` asks the one-time question a harness asks before starting in a linked thread folder.
  const folder = /^folder (\S+) (.*)$/.exec(line);
  if (folder !== null) {
    const input = JSON.parse(folder[2] ?? "{}");
    return request
      .askOwner({
        folderCheck: { pointsTo: textFieldOf(input, "startsIn") ?? "", startsIn: textFieldOf(input, "startsIn") },
        input,
        toolName: folder[1] ?? "",
      })
      .pipe(Effect.map((answer) => (answer.isAllowed ? "prompt allowed" : `prompt denied: ${answer.text}`)));
  }
  return null;
};
