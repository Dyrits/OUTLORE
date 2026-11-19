import { createServer, type IncomingHttpHeaders } from "node:http";
import type { Socket } from "node:net";
import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail } from "@outlore/contracts";
import { Effect, Fiber } from "effect";
import { connectorBackendsLayer } from "../../../src/connectors/backends/defaultBackends.ts";
import { httpMcpBackend } from "../../../src/connectors/backends/httpMcp.ts";
import type { CatalogEntry } from "../../../src/connectors/index.ts";
import { fieldOf, numberFieldOf, textFieldOf } from "../../../src/core/index.ts";
import { install, inWorld, openQuestionOf, replyOf, untilAsked, untilIdle } from "../../fixtures/connectorWorld.ts";
import { listTools } from "../../fixtures/mcp.ts";
import { call, startMission } from "../../fixtures/service.ts";

// The Streamable-HTTP adapter over a real HTTP server: every test spins up a fake of Composio's Connect endpoint
// (JSON-RPC over one POST per request) on loopback — never the real service, never a real key (connectors
// blueprint, Backends; research note of 2026-11-19; CHG-0535).

const testKey = "ck-live-b7d51e09af/the-key==";
const use = (name: string, args: object = {}) => `call ${name} ${JSON.stringify(args)}`;
const answerOpen = (detail: MissionDetail, answer: "Allow" | "Deny") => {
  const question = openQuestionOf(detail);
  if (question === null) return Effect.die("no open question");
  return call({ _tag: "AnswerQuestion", answer, message: null, questionId: question.id });
};

/** One request the fake server took, as a test reads it. */
interface TakenRequest {
  readonly headers: IncomingHttpHeaders;
  readonly message: unknown;
}

/** How the fake answers a JSON-RPC request: a reply, or holding it as a server that has not answered yet. */
type FakeReply =
  | { readonly _tag: "Answer"; readonly body: string; readonly contentType?: string; readonly status?: number }
  | { readonly _tag: "Stream"; readonly body: string }
  | { readonly _tag: "Hold" };

/** What the fake of Composio's Connect endpoint offers a test: its address, what it took, and how it answers. */
interface FakeConnect {
  /** Empties what the server took, so a test can count the requests of one step alone. */
  readonly forgetTaken: () => void;
  /** How many held requests the client gave up on, as a stopped call does when it stops waiting. */
  readonly isAbandoned: () => number;
  /** What to answer one message with; the test sets this before the request that needs it. */
  readonly reply: { current: (message: unknown) => FakeReply };
  /** What the server took, with the headers of each request. */
  readonly taken: ReadonlyArray<TakenRequest>;
  readonly url: string;
}

/** How many requests of one JSON-RPC method the fake has taken. */
const takenByMethod = (fake: FakeConnect, method: string) =>
  fake.taken.filter((taken) => textFieldOf(taken.message, "method") === method).length;

/** Waits until the fake has taken this many requests of the method, as a test sees a call underway. */
const untilTaken = (fake: FakeConnect, method: string, count: number) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 400 && takenByMethod(fake, method) < count; attempt++)
      yield* Effect.sleep("10 millis");
    expect(takenByMethod(fake, method)).toBeGreaterThanOrEqual(count);
  });

/** Waits until the fake has seen this many held requests given up on, as the event reaches the server. */
const untilAbandoned = (fake: FakeConnect, count: number) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 400 && fake.isAbandoned() < count; attempt++) yield* Effect.sleep("10 millis");
    expect(fake.isAbandoned()).toBeGreaterThanOrEqual(count);
  });

/** The JSON-RPC answer a fake sends for a `result`. */
const resultAnswer = (result: unknown, message: unknown) =>
  JSON.stringify({ id: numberFieldOf(message, "id"), jsonrpc: "2.0", result });
/** The JSON-RPC error answer a fake sends. */
const errorAnswer = (code: number, message: unknown) =>
  JSON.stringify({ error: { code, message: "your rejected input" }, id: numberFieldOf(message, "id"), jsonrpc: "2.0" });

/** A fake of Composio's Connect endpoint on loopback: one POST per JSON-RPC request, recorded, answered as set. */
const fakeConnect = () =>
  Effect.acquireRelease(
    Effect.callback<FakeConnect, Error>((resume) => {
      const taken: Array<TakenRequest> = [];
      let abandoned = 0;
      let counter = 0;
      let address = "not-listening";
      const sockets: Array<Socket> = [];
      const fake: FakeConnect = {
        forgetTaken: () => {
          taken.length = 0;
        },
        isAbandoned: () => abandoned,
        reply: {
          current: () => ({
            _tag: "Answer" as const,
            body: resultAnswer({ content: [{ text: "nothing", type: "text" }] }, { id: counter }),
          }),
        },
        taken,
        get url() {
          return address;
        },
      };
      const server = createServer((request, response) => {
        const chunks: Buffer[] = [];
        request.on("data", (chunk: Buffer) => chunks.push(chunk));
        request.on("end", () => {
          counter += 1;
          const message: unknown = JSON.parse(Buffer.concat(chunks).toString());
          taken.push({ headers: request.headers, message });
          const reply = fake.reply.current(message);
          if (reply._tag === "Hold") {
            // The answer stays unsent: the connection closes only when the client gives up on it.
            response.on("close", () => {
              if (!response.writableEnded) abandoned += 1;
            });
            return;
          }
          if (reply._tag === "Stream") {
            response.writeHead(200, { "content-type": "text/event-stream" });
            const middle = Math.floor(reply.body.length / 2);
            response.write(reply.body.slice(0, middle));
            setTimeout(() => {
              if (!response.destroyed) response.write(reply.body.slice(middle));
            }, 10);
            return;
          }
          response
            .writeHead(reply.status ?? 200, { "content-type": reply.contentType ?? "application/json" })
            .end(reply.body);
        });
      });
      server.on("connection", (socket) => {
        sockets.push(socket);
        socket.on("close", () => {
          const at = sockets.indexOf(socket);
          if (at >= 0) sockets.splice(at, 1);
        });
      });
      server.once("error", (error) => resume(Effect.fail(error)));
      server.listen(0, "127.0.0.1", () => {
        const listening = server.address();
        if (listening === null || typeof listening === "string") {
          resume(Effect.fail(new Error("the fake server has no listening address")));
          return;
        }
        address = `http://127.0.0.1:${listening.port}/mcp`;
        resume(Effect.succeed(fake));
      });
      fakeConnectShutdown.set(fake, () => {
        for (const socket of sockets) socket.destroy();
        server.close();
      });
    }),
    (fake) => Effect.sync(() => fakeConnectShutdown.get(fake)?.()),
  );

/** The fake's sockets and their close, kept apart from what a test reads of the fake. */
const fakeConnectShutdown = new Map<FakeConnect, () => void>();

/** A Composio-like catalog entry whose HTTP backend is the fake server's address. */
const httpServiceEntryOf = (url: string): CatalogEntry => ({
  apps: [],
  backend: { _tag: "Http", header: "x-consumer-api-key", url },
  description: "A hosted service over HTTP for the tests.",
  id: "http_service",
  licence: "MIT",
  name: "HTTP service",
  notice: null,
  platform: "Any",
  secretKind: "API key",
  tools: {
    "fetch-events": { app: null, class: "Read", summary: "Read the service's events." },
    "hold-read": { app: null, class: "Read", summary: "Read that waits on the server's answer." },
    "make-event": { app: null, class: "Write", summary: "Make an event on the service." },
  },
});

describe("the Streamable-HTTP MCP backend", () => {
  it.live("returns the matching SSE reply without waiting for the stream to close", () =>
    fakeConnect().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          fake.reply.current = (message) => ({
            _tag: "Stream",
            body: `data: ${JSON.stringify({ jsonrpc: "2.0", method: "progress" })}\r\n\r\ndata: ${JSON.stringify({ id: numberFieldOf(message, "id"), jsonrpc: "2.0", method: "server/request" })}\r\n\r\ndata: ${resultAnswer({ tools: [{ description: "Read", inputSchema: {}, name: "read" }] }, message)}\r\n\r\n`,
          });
          const backend = httpMcpBackend({ _tag: "Http", header: "x-key", url: fake.url });
          const listed = yield* backend.listTools(testKey).pipe(Effect.timeoutOption("500 millis"));
          expect(listed._tag).toBe("Some");
        }),
      ),
    ),
  );

  it.live("does not expose the credential in tool listing metadata", () =>
    fakeConnect().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          const encoded = Buffer.from(testKey).toString("base64");
          const encodedUrl = encodeURIComponent(testKey);
          const encodedUrlBase64 = Buffer.from(testKey).toString("base64url");
          fake.reply.current = (message) => ({
            _tag: "Answer",
            body: resultAnswer(
              {
                tools: [
                  {
                    description: `key ${testKey}`,
                    inputSchema: {
                      properties: {
                        token: { default: encoded, examples: [encodedUrl, { nested: encodedUrlBase64 }] },
                        [testKey]: { description: testKey },
                      },
                    },
                    name: "read",
                  },
                  { description: "unsafe name", inputSchema: {}, name: encodedUrlBase64 },
                ],
              },
              message,
            ),
          });
          yield* inWorld(
            { backends: connectorBackendsLayer, entries: [httpServiceEntryOf(fake.url)], hasKey: false },
            (world) =>
              Effect.gen(function* () {
                world.vault.put("http_service", "API key", testKey);
                yield* install("http_service");
                const quest = yield* startMission({ harness: "claude", text: "Hello" });
                yield* untilIdle(quest.missionId);
                const tools = yield* listTools(quest.threadId);
                expect(tools.some((tool) => tool.name === "http_service__read")).toBe(true);
                expect(JSON.stringify(tools)).toContain("[redacted]");
                expect(JSON.stringify(tools)).not.toContain(testKey);
                expect(JSON.stringify(tools)).not.toContain(encoded);
                expect(JSON.stringify(tools)).not.toContain(encodedUrl);
                expect(JSON.stringify(tools)).not.toContain(encodedUrlBase64);
              }),
          );
        }),
      ),
    ),
  );

  it.live("times out a stream that never gives the matching answer", () =>
    fakeConnect().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          fake.reply.current = () => ({
            _tag: "Stream",
            body: `data: ${JSON.stringify({ id: 999, jsonrpc: "2.0", result: { tools: [] } })}\n\n`,
          });
          const backend = httpMcpBackend(
            { _tag: "Http", header: "x-key", url: fake.url },
            { requestTimeoutMillis: 100 },
          );
          const failure = yield* Effect.flip(backend.listTools(testKey));
          expect(failure.class).toBe("Unreachable");
        }),
      ),
    ),
  );
  it.live("lists a real server's tools in one request, with the key in the entry's header", () =>
    fakeConnect().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          const tools = [
            { description: "Searches the catalog.", inputSchema: { type: "object" }, name: "COMPOSIO_SEARCH_TOOLS" },
            { description: "A tool with no schema.", inputSchema: {}, name: "BARE_TOOL" },
          ];
          fake.reply.current = (message) => ({ _tag: "Answer", body: resultAnswer({ tools }, message) });
          const backend = httpMcpBackend({ _tag: "Http", header: "x-consumer-api-key", url: fake.url });
          const listed = yield* backend.listTools(testKey);
          expect(listed).toEqual(tools);
          expect(fake.taken).toHaveLength(1);
          expect(fake.taken.at(0)?.headers["x-consumer-api-key"]).toBe(testKey);
          // One request, and it is the listing: the adapter holds no session to open first.
          const first: unknown = fake.taken.at(0);
          expect(textFieldOf(fieldOf(first, "message"), "method")).toBe("tools/list");
        }),
      ),
    ),
  );

  it.live("calls a tool with the given arguments and returns its content's text, in JSON and in an event stream", () =>
    fakeConnect().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          const backend = httpMcpBackend({ _tag: "Http", header: "x-consumer-api-key", url: fake.url });
          fake.reply.current = (message) => ({
            _tag: "Answer",
            body: resultAnswer(
              {
                content: [
                  { text: "One. ", type: "text" },
                  { data: "image-bytes", type: "image" },
                  { text: "Two.", type: "text" },
                ],
              },
              message,
            ),
          });
          expect(yield* backend.call("COMPOSIO_MULTI_EXECUTE_TOOL", { limit: 2 }, testKey)).toBe("One. Two.");
          expect(fake.taken.at(0)?.message).toMatchObject({
            jsonrpc: "2.0",
            method: "tools/call",
            params: { arguments: { limit: 2 }, name: "COMPOSIO_MULTI_EXECUTE_TOOL" },
          });
          // Outlore's own tool server answers its calls as a text event stream; the adapter reads that spelling too.
          fake.reply.current = (message) => ({
            _tag: "Answer",
            body: `: keep-alive\n\nevent: message\ndata: ${resultAnswer({ content: [{ text: "Streamed.", type: "text" }] }, message)}\n\n`,
            contentType: "text/event-stream",
          });
          expect(yield* backend.call("COMPOSIO_MULTI_EXECUTE_TOOL", {}, testKey)).toBe("Streamed.");
          expect(fake.taken).toHaveLength(2);
        }),
      ),
    ),
  );

  it.live("redacts the key the server echoes back, raw and base64", () =>
    fakeConnect().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          fake.reply.current = (message) => ({
            _tag: "Answer",
            body: resultAnswer(
              {
                content: [
                  { text: `Your ${testKey} and your ${Buffer.from(testKey).toString("base64")} too.`, type: "text" },
                ],
              },
              message,
            ),
          });
          const backend = httpMcpBackend({ _tag: "Http", header: "x-consumer-api-key", url: fake.url });
          const text = yield* backend.call("COMPOSIO_MULTI_EXECUTE_TOOL", {}, testKey);
          expect(text).toBe("Your [redacted] and your [redacted] too.");
        }),
      ),
    ),
  );

  it.live("maps each kind of refusal to its class, with no word of the server's answer anywhere", () =>
    fakeConnect().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          const backend = httpMcpBackend({ _tag: "Http", header: "x-consumer-api-key", url: fake.url });
          fake.reply.current = () => ({ _tag: "Answer", body: `the server's own words ${testKey}`, status: 401 });
          const refused = yield* Effect.flip(backend.listTools(testKey));
          expect(refused._tag).toBe("BackendFailure");
          expect(refused).toMatchObject({ class: "Disconnected" });
          expect(refused.upstream).toBe("The server rejected the connector's sign-in.");
          fake.reply.current = (message) => ({ _tag: "Answer", body: errorAnswer(-32602, message), status: 200 });
          const invalid = yield* Effect.flip(backend.call("COMPOSIO_MULTI_EXECUTE_TOOL", {}, testKey));
          expect(invalid).toMatchObject({ class: "InvalidArguments" });
          fake.reply.current = () => ({ _tag: "Answer", body: "", status: 500 });
          const down = yield* Effect.flip(backend.call("COMPOSIO_MULTI_EXECUTE_TOOL", {}, testKey));
          expect(down).toMatchObject({ class: "Unreachable" });
          fake.reply.current = () => ({ _tag: "Answer", body: "", status: 200 });
          const empty = yield* Effect.flip(backend.call("COMPOSIO_MULTI_EXECUTE_TOOL", {}, testKey));
          expect(empty).toMatchObject({ class: "Failed" });
          fake.reply.current = (message) => ({
            _tag: "Answer",
            body: resultAnswer(
              { content: [{ text: `it failed with ${testKey}`, type: "text" }], isError: true },
              message,
            ),
          });
          const errored = yield* Effect.flip(backend.call("COMPOSIO_MULTI_EXECUTE_TOOL", {}, testKey));
          expect(errored).toMatchObject({ class: "Failed" });
          for (const failure of [refused, invalid, down, empty])
            for (const spelling of [testKey, Buffer.from(testKey).toString("base64")])
              expect(`${failure.class} ${failure.upstream}`).not.toContain(spelling);
          // A listing the caller gives no key for still asks the server, without a header it does not name.
          fake.forgetTaken();
          fake.reply.current = () => ({ _tag: "Answer", body: "", status: 401 });
          const keyless = yield* Effect.flip(backend.listTools(null));
          expect(keyless).toMatchObject({ class: "Disconnected" });
          expect(fake.taken).toHaveLength(1);
          expect(fake.taken.at(0)?.headers["x-consumer-api-key"]).toBeUndefined();
        }),
      ),
    ),
  );

  it.live("stops waiting on a call the thread no longer wants, and the server sees the client give up", () =>
    fakeConnect().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          fake.reply.current = () => ({ _tag: "Hold" });
          const backend = httpMcpBackend({ _tag: "Http", header: "x-consumer-api-key", url: fake.url });
          const underway = yield* Effect.forkChild(backend.call("COMPOSIO_MULTI_EXECUTE_TOOL", {}, testKey));
          yield* untilTaken(fake, "tools/call", 1);
          // The call went out and the server still holds its answer: nothing has given up yet.
          expect(fake.isAbandoned()).toBe(0);
          yield* Fiber.interrupt(underway);
          yield* untilAbandoned(fake, 1);
        }),
      ),
    ),
  );
});

describe("the connector gateway over the Streamable-HTTP backend and a real local MCP server", () => {
  it.live("lists and runs the connector's tools over the real server, with the Vault's key alone in the header", () =>
    fakeConnect().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          fake.reply.current = (message) =>
            textFieldOf(message, "method") === "tools/list"
              ? {
                  _tag: "Answer",
                  body: resultAnswer(
                    {
                      tools: [
                        { description: "Reads events.", inputSchema: { type: "object" }, name: "fetch-events" },
                        { description: "Waits.", inputSchema: { type: "object" }, name: "hold-read" },
                        { description: "Makes an event.", inputSchema: { type: "object" }, name: "make-event" },
                      ],
                    },
                    message,
                  ),
                }
              : {
                  _tag: "Answer",
                  body: resultAnswer({ content: [{ text: "the events: morning standup", type: "text" }] }, message),
                };
          yield* inWorld(
            { backends: connectorBackendsLayer, entries: [httpServiceEntryOf(fake.url)], hasKey: false },
            (world) =>
              Effect.gen(function* () {
                world.vault.put("http_service", "API key", testKey);
                yield* install("http_service");
                const mission = yield* startMission({ harness: "claude", text: use("http_service__fetch-events") });
                const detail = yield* untilIdle(mission.missionId);
                expect(replyOf(detail)).toContain("the events: morning standup");
              }),
          );
          // Every request carried the Vault's key in the entry's header, and the call went out once.
          expect(takenByMethod(fake, "tools/list")).toBeGreaterThanOrEqual(1);
          expect(takenByMethod(fake, "tools/call")).toBe(1);
          for (const taken of fake.taken) expect(taken.headers["x-consumer-api-key"]).toBe(testKey);
        }),
      ),
    ),
  );

  it.live("retries a read the real server could not take once, and both requests carry the key", () =>
    fakeConnect().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          let callsTaken = 0;
          fake.reply.current = (message) => {
            if (textFieldOf(message, "method") !== "tools/call") {
              return {
                _tag: "Answer" as const,
                body: resultAnswer(
                  { tools: [{ description: "Reads events.", inputSchema: {}, name: "fetch-events" }] },
                  message,
                ),
              };
            }
            callsTaken += 1;
            return callsTaken === 1
              ? { _tag: "Answer" as const, body: "", status: 500 }
              : {
                  _tag: "Answer" as const,
                  body: resultAnswer({ content: [{ text: "the events: retried and taken", type: "text" }] }, message),
                };
          };
          yield* inWorld(
            { backends: connectorBackendsLayer, entries: [httpServiceEntryOf(fake.url)], hasKey: false },
            (world) =>
              Effect.gen(function* () {
                world.vault.put("http_service", "API key", testKey);
                yield* install("http_service");
                const mission = yield* startMission({ harness: "claude", text: use("http_service__fetch-events") });
                const detail = yield* untilIdle(mission.missionId);
                expect(replyOf(detail)).toContain("the events: retried and taken");
              }),
          );
          expect(takenByMethod(fake, "tools/call")).toBe(2);
          for (const taken of fake.taken) expect(taken.headers["x-consumer-api-key"]).toBe(testKey);
        }),
      ),
    ),
  );

  it.live("never retries a write the real server could not take", () =>
    fakeConnect().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          fake.reply.current = (message) =>
            textFieldOf(message, "method") === "tools/call"
              ? { _tag: "Answer", body: "", status: 500 }
              : {
                  _tag: "Answer",
                  body: resultAnswer(
                    { tools: [{ description: "Makes an event.", inputSchema: {}, name: "make-event" }] },
                    message,
                  ),
                };
          yield* inWorld(
            { backends: connectorBackendsLayer, entries: [httpServiceEntryOf(fake.url)], hasKey: false },
            (world) =>
              Effect.gen(function* () {
                world.vault.put("http_service", "API key", testKey);
                yield* install("http_service");
                const mission = yield* startMission({
                  harness: "claude",
                  text: use("http_service__make-event", { id: "e1" }),
                });
                const asked = yield* untilAsked(mission.missionId);
                yield* answerOpen(asked, "Allow");
                const done = yield* untilIdle(mission.missionId);
                expect(replyOf(done)).toContain("The connector could not be reached. Carry on without it.");
              }),
          );
          expect(takenByMethod(fake, "tools/call")).toBe(1);
        }),
      ),
    ),
  );

  it.live("stops a read underway on a real HTTP request when a switch turns the connector off", () =>
    fakeConnect().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          const tools = {
            tools: [{ description: "Reads.", inputSchema: {}, name: "hold-read" }],
          };
          fake.reply.current = (message) =>
            textFieldOf(message, "method") === "tools/call"
              ? { _tag: "Hold" }
              : { _tag: "Answer", body: resultAnswer(tools, message) };
          yield* inWorld(
            { backends: connectorBackendsLayer, entries: [httpServiceEntryOf(fake.url)], hasKey: false },
            (world) =>
              Effect.gen(function* () {
                world.vault.put("http_service", "API key", testKey);
                yield* install("http_service");
                const mission = yield* startMission({ harness: "claude", text: use("http_service__hold-read") });
                yield* untilTaken(fake, "tools/call", 1);
                yield* call({
                  _tag: "SetConnectorSwitch",
                  choice: "Off",
                  connectorId: "http_service",
                  level: { _tag: "Global" },
                });
                const done = yield* untilIdle(mission.missionId);
                expect(replyOf(done)).toContain("This connector is off for this thread.");
                expect(replyOf(done)).not.toContain("the events");
              }),
          );
          // A stopped call cancels the real HTTP request: the server sees the client give up on the answer it held.
          yield* untilAbandoned(fake, 1);
        }),
      ),
    ),
  );
});
