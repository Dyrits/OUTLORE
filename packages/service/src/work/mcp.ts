import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Effect, Exit, FiberSet, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import {
  answerCodeModeCall,
  CodeExecutor,
  ConnectorGateway,
  type OwnTools,
  offeredToolsOf,
} from "../connectors/index.ts";
import { Endpoints, readSettings, unknownToolAnswer } from "../core/index.ts";
import { harnessFacts, toolServerName } from "../harness/index.ts";
import { Approvals } from "./approvals.ts";
import { readCallerRefusal } from "./askOwner.ts";
import { Commands } from "./commands.ts";
import { PhoneLink } from "./phoneLink.ts";
import { Suggestions } from "./suggestions.ts";
import { Threads } from "./threads.ts";
import { makeToolHandlers } from "./threadToolHandlers.ts";
import { answerToolCall, isCoveredByCodeMode, isThreadToolName, startsWork, toolListingOf } from "./threadTools.ts";
import { readAuthorityHarness } from "./turnAdmission.ts";

const RpcMessage = Schema.Struct({
  id: Schema.optional(Schema.Union([Schema.String, Schema.Number])),
  method: Schema.String,
  params: Schema.optional(Schema.Unknown),
});

const CallParams = Schema.Struct({ arguments: Schema.optional(Schema.Unknown), name: Schema.String });
const InitializeParams = Schema.Struct({ protocolVersion: Schema.optional(Schema.String) });

const decodeMessage = Schema.decodeUnknownExit(Schema.fromJsonString(RpcMessage));
const decodeCall = Schema.decodeUnknownExit(CallParams);
const decodeInitialize = Schema.decodeUnknownExit(InitializeParams);
const textResult = (text: string, isError = false) => ({ content: [{ text, type: "text" }], isError });

// SSE comments keep a long-held call alive through client body timeouts while
// the owner takes their time (action-approval, Waiting: no time limit).
const keepAliveMillis = 20_000;

const readBody = (request: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });

/**
 * Serves the thread tools over MCP on loopback (ADR 0005), at the endpoints `Endpoints` issues; no tool
 * argument can name another thread. Built after Threads and the command runner, which it calls directly.
 */
export const toolServerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const approvals = yield* Approvals;
    const suggestions = yield* Suggestions;
    const sql = yield* SqlClient.SqlClient;
    const commands = yield* Commands;
    const threads = yield* Threads;
    const endpoints = yield* Endpoints;
    const gateway = yield* ConnectorGateway;
    const phone = yield* PhoneLink;
    const executor = yield* CodeExecutor;
    const handlers = makeToolHandlers({ approvals, commands, phone, suggestions, threads });
    const run = yield* FiberSet.makeRuntimePromise();

    const readShouldUseCodeMode = readSettings.pipe(
      Effect.map((settings) => settings.shouldUseCodeMode),
      Effect.provideService(SqlClient.SqlClient, sql),
    );

    // The setting the thread's turn started with, which its harness listed its tools under, holds for the whole turn
    // (connectors specification, Code Mode); before any turn has held one, the setting as it is now.
    const codeModeOf = (threadId: string) =>
      Effect.suspend(() => {
        const held = endpoints.heldCodeMode(threadId);
        return held === null ? readShouldUseCodeMode : Effect.succeed(held);
      });

    // The running turn's admitted harness decides, not a harness the owner picked during it (thread-handover).
    const hasPromptToolOf = (threadId: string) =>
      readAuthorityHarness(threadId).pipe(
        Effect.map((harness) => harness !== null && harnessFacts[harness].hasPromptTool),
        Effect.provideService(SqlClient.SqlClient, sql),
      );

    /** The caller checks every call to the tool server has, or null when the thread may make this call now. */
    const readRefusalOf = Effect.fnUntraced(function* (threadId: string, name: string) {
      const refusal = yield* readCallerRefusal(threadId, name);
      if (refusal !== null) return refusal;
      // Only a harness that asks its permission prompts through `answer_prompt` may call it (audit SA-14): the
      // others ask in-process, and a call by one would draw an allow decision of its own choosing.
      if (name === "answer_prompt" && !(yield* hasPromptToolOf(threadId)))
        return "This tool is not available to this thread.";
      return null;
    });

    /** Answers a thread tool, or an unknown name, once the caller's checks have passed. */
    const answerOwnTool = (threadId: string, name: string, args: unknown) =>
      isThreadToolName(name) ? answerToolCall(handlers, name, threadId, args) : Effect.succeed(unknownToolAnswer(name));

    /**
     * Outlore's own tools as one thread's code calls them: each call has the caller checks and the answer a direct
     * call has, so a call from code is never easier than a call made directly.
     */
    const ownToolsFor = (threadId: string): OwnTools => ({
      call: Effect.fnUntraced(
        function* (name, args) {
          const refusal = yield* readRefusalOf(threadId, name);
          return refusal === null
            ? yield* answerOwnTool(threadId, name, args)
            : ({ isError: true, text: refusal } as const);
        },
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.orDie,
      ),
      isCovered: isCoveredByCodeMode,
      startsWork,
    });

    const dispatchTool = Effect.fnUntraced(
      function* (threadId: string, name: string, args: unknown) {
        const answer = yield* answerCodeModeCall(executor, gateway, ownToolsFor(threadId), {
          args,
          name,
          ownListed: toolListingOf(yield* hasPromptToolOf(threadId), yield* phone.offeredTools),
          shouldUseCodeMode: yield* codeModeOf(threadId),
          threadId,
        });
        return answer ?? (yield* answerOwnTool(threadId, name, args));
      },
      Effect.map(({ isError, text }) => textResult(text, isError)),
    );

    const callTool = Effect.fnUntraced(
      function* (threadId: string, name: string, args: unknown) {
        const refusal = yield* readRefusalOf(threadId, name);
        return refusal === null ? yield* dispatchTool(threadId, name, args) : textResult(refusal, true);
      },
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.orDie,
    );

    /** The tools the thread's harness lists: `answer_prompt` only for Claude Code, then its connectors' tools. */
    const listTools = Effect.fnUntraced(function* (threadId: string) {
      const ownListed = toolListingOf(yield* hasPromptToolOf(threadId), yield* phone.offeredTools);
      return offeredToolsOf(
        ownListed,
        yield* gateway.listingFor(threadId),
        ownToolsFor(threadId),
        yield* codeModeOf(threadId),
      );
    }, Effect.orDie);

    const respondJson = (response: ServerResponse, body: unknown) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };

    const handle = async (request: IncomingMessage, response: ServerResponse) => {
      const token = (request.url ?? "").replace(/^\/mcp\//, "");
      const threadId = endpoints.threadOf(token);
      if (threadId === null || !(request.url ?? "").startsWith("/mcp/")) {
        response.writeHead(404).end();
        return;
      }
      if (request.method !== "POST") {
        response.writeHead(405, { allow: "POST" }).end();
        return;
      }
      const decoded = decodeMessage(await readBody(request));
      if (Exit.isFailure(decoded)) {
        respondJson(response, { error: { code: -32700, message: "Parse error" }, id: null, jsonrpc: "2.0" });
        return;
      }
      const message = decoded.value;
      if (message.id === undefined) {
        response.writeHead(202).end();
        return;
      }
      const reply = (result: unknown) => ({ id: message.id, jsonrpc: "2.0", result });
      if (message.method === "initialize") {
        const params = decodeInitialize(message.params ?? {});
        const version = Exit.isSuccess(params) ? params.value.protocolVersion : void 0;
        respondJson(
          response,
          reply({
            capabilities: { tools: {} },
            protocolVersion: version ?? "2025-06-18",
            serverInfo: { name: toolServerName, version: "0.1.0" },
          }),
        );
        return;
      }
      if (message.method === "tools/list") {
        respondJson(response, reply({ tools: await run(listTools(threadId)) }));
        return;
      }
      if (message.method !== "tools/call") {
        respondJson(response, reply({}));
        return;
      }
      const call = decodeCall(message.params);
      if (Exit.isFailure(call)) {
        respondJson(response, { error: { code: -32602, message: "Invalid params" }, id: message.id, jsonrpc: "2.0" });
        return;
      }
      response.writeHead(200, { "cache-control": "no-cache", "content-type": "text/event-stream" });
      const timer = setInterval(() => response.write(": waiting\n\n"), keepAliveMillis);
      // A caller that closes the connection has given up; its open question is withdrawn.
      const abandoned = new AbortController();
      response.on("close", () => {
        if (!response.writableFinished) abandoned.abort();
      });
      try {
        const result = await run(callTool(threadId, call.value.name, call.value.arguments), {
          signal: abandoned.signal,
        });
        response.end(`event: message\ndata: ${JSON.stringify(reply(result))}\n\n`);
      } finally {
        clearInterval(timer);
      }
    };

    const server = yield* Effect.acquireRelease(
      Effect.callback<ReturnType<typeof createServer>, Error>((resume) => {
        const created = createServer((request, response) => {
          handle(request, response).catch(() => {
            if (!response.headersSent) response.writeHead(500);
            response.end();
          });
        });
        created.once("error", (error) => resume(Effect.fail(error)));
        created.listen(0, "127.0.0.1", () => resume(Effect.succeed(created)));
      }),
      (created) =>
        Effect.callback<void>((resume) => {
          created.closeAllConnections();
          created.close(() => resume(Effect.void));
        }),
    ).pipe(Effect.orDie);
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;

    yield* endpoints.open(port);
  }),
);
