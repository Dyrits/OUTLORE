import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { Socket } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import type { CatalogEntry } from "../../src/connectors/index.ts";
import { fieldOf, numberFieldOf, textFieldOf, vaultFolderOf } from "../../src/core/index.ts";
import { fakeHarnessLayer, serviceLayer } from "../../src/index.ts";
import { replyOf, untilIdle } from "../fixtures/connectorWorld.ts";
import { listToolNames } from "../fixtures/mcp.ts";
import { call, startMission, temporary } from "../fixtures/service.ts";
import { distinctiveSecret, fakeCustody } from "../fixtures/vault.ts";

// The four connector pieces through the service's own default wiring, with nothing handed in but a key holder: the real
// Vault (on a temporary folder, its key held by an in-memory holder so the owner's Keychain is never touched, and a
// disposable secret), and the one `connectorBackendsLayer` opening the Streamable-HTTP adapter against a real local
// fake of a Connect endpoint and the stdio adapter against the stand-in MCP server process. One connector of each kind.

const standIn = join(import.meta.dirname, "..", "fixtures", "stand-in-mcp-server.mjs");

/** What the fake Connect endpoint took: the headers of each request and its JSON-RPC message. */
interface Taken {
  readonly headers: IncomingHttpHeaders;
  readonly message: unknown;
}

/** A fake of a Connect endpoint on loopback: `tools/list` names one read tool, `tools/call` answers with a fixed text. */
const fakeConnect = () =>
  Effect.acquireRelease(
    Effect.callback<{ readonly stop: () => void; readonly taken: Array<Taken>; readonly url: string }, Error>(
      (resume) => {
        const taken: Array<Taken> = [];
        const sockets = new Set<Socket>();
        const server = createServer((request, response) => {
          const chunks: Buffer[] = [];
          request.on("data", (chunk: Buffer) => chunks.push(chunk));
          request.on("end", () => {
            const message: unknown = JSON.parse(Buffer.concat(chunks).toString());
            taken.push({ headers: request.headers, message });
            const result =
              textFieldOf(message, "method") === "tools/list"
                ? { tools: [{ description: "Reads events.", inputSchema: { type: "object" }, name: "fetch-events" }] }
                : { content: [{ text: "http events: morning standup", type: "text" }] };
            response
              .writeHead(200, { "content-type": "application/json" })
              .end(JSON.stringify({ id: numberFieldOf(message, "id"), jsonrpc: "2.0", result }));
          });
        });
        server.on("connection", (socket) => {
          sockets.add(socket);
          socket.on("close", () => sockets.delete(socket));
        });
        server.once("error", (error) => resume(Effect.fail(error)));
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          if (address === null || typeof address === "string") {
            resume(Effect.fail(new Error("the fake server has no listening address")));
            return;
          }
          resume(
            Effect.succeed({
              stop: () => {
                for (const socket of sockets) socket.destroy();
                server.close();
              },
              taken,
              url: `http://127.0.0.1:${address.port}/mcp`,
            }),
          );
        });
      },
    ),
    (fake) => Effect.sync(fake.stop),
  );

/** Every file under a folder, with its bytes. */
const filesUnder = (folder: string): ReadonlyArray<{ readonly bytes: Buffer; readonly name: string }> =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [{ bytes: readFileSync(path), name: path }];
  });

describe("the whole connector wiring, as the service builds it by default", () => {
  it.live(
    "lists an HTTP connector and a stdio connector in one turn and reaches each, the key going only to the HTTP one",
    () =>
      fakeConnect().pipe(
        Effect.flatMap((fake) =>
          Effect.gen(function* () {
            // The stdio catalog entry names a vendored server by package; a temporary vendor folder holds a wrapper that
            // runs the stand-in MCP server, as the packaged app's vendor folder holds the real pinned one.
            const vendor = temporary("outlore-vendor-");
            writeFileSync(
              join(vendor, "stand-in-server.cjs"),
              `import(${JSON.stringify(pathToFileURL(standIn).href)});\n`,
            );
            const stdioLog = join(vendor, "stand-in.log");
            const httpEntry: CatalogEntry = {
              apps: [],
              backend: { _tag: "Http", header: "x-consumer-api-key", url: fake.url },
              description: "A hosted connector over HTTP.",
              id: "http_service",
              licence: "MIT",
              name: "HTTP service",
              notice: null,
              platform: "Any",
              secretKind: "API key",
              tools: { "fetch-events": { app: null, class: "Read", summary: "Read the service's events." } },
            };
            const stdioEntry: CatalogEntry = {
              apps: [],
              backend: {
                _tag: "Stdio",
                env: {
                  STAND_IN_LOG: stdioLog,
                  STAND_IN_MCP_TOOLS: JSON.stringify([{ name: "list-events", text: "stdio events: lunch" }]),
                },
                server: "stand-in-server",
                version: "0.0.1",
              },
              description: "A local connector over stdio.",
              id: "stdio_service",
              licence: "MIT",
              name: "Stdio service",
              notice: null,
              platform: "Any",
              secretKind: null,
              tools: { "list-events": { app: null, class: "Read", summary: "List the local events." } },
            };
            const directory = temporary("outlore-wiring-");
            // No `connectorVault` and no `connectorBackends`: the service builds the real Vault and the default backends.
            const layer = serviceLayer({
              connectorCatalog: [httpEntry, stdioEntry],
              connectorPlatform: "darwin",
              filename: join(directory, "store.sqlite"),
              harness: fakeHarnessLayer("10 millis"),
              homeFolder: directory,
              keyCustodies: [fakeCustody()],
              scratchRoot: join(directory, "missions"),
            });
            const previousVendor = process.env.OUTLORE_VENDOR_DIR;
            process.env.OUTLORE_VENDOR_DIR = vendor;
            const secret = distinctiveSecret();
            yield* Effect.gen(function* () {
              yield* call({
                _tag: "PutSecret",
                connectorId: "http_service",
                kind: "API key",
                secret: Redacted.make(secret),
              });
              for (const connectorId of ["http_service", "stdio_service"]) {
                expect(yield* call({ _tag: "InstallConnector", connectorId, hasConfirmedNotice: true })).toMatchObject({
                  state: "Ready",
                });
              }
              const quest = yield* startMission({
                text: "call http_service__fetch-events {}\ncall stdio_service__list-events {}",
              });
              const detail = yield* untilIdle(quest.missionId);
              // The thread is offered both connectors' tools, and each call reached its own server.
              const offered = yield* listToolNames(quest.threadId);
              expect(offered).toContain("http_service__fetch-events");
              expect(offered).toContain("stdio_service__list-events");
              expect(replyOf(detail)).toContain("http events: morning standup");
              expect(replyOf(detail)).toContain("stdio events: lunch");
              expect(detail.questions).toEqual([]);
              // The HTTP server took the Vault's key in the entry's header on every request, a call among them.
              expect(fake.taken.some((taken) => textFieldOf(taken.message, "method") === "tools/call")).toBe(true);
              for (const taken of fake.taken) expect(taken.headers["x-consumer-api-key"]).toBe(secret);
              // The stdio child was started by the host and answered a listing and a call, and never saw the key.
              const log = readFileSync(stdioLog, "utf8");
              const methods = log
                .split("\n")
                .filter((line) => line.length > 0)
                .map((line): unknown => JSON.parse(line))
                .map((entry) => textFieldOf(fieldOf(entry, "request"), "method"));
              expect(methods).toContain("tools/list");
              expect(methods).toContain("tools/call");
              expect(log).not.toContain(secret);
              // The secret is in no file of the service: the Vault holds it sealed, in its own folder.
              for (const file of filesUnder(directory))
                expect(file.bytes.includes(Buffer.from(secret)), file.name).toBe(false);
              expect(readdirSync(vaultFolderOf(directory)).length).toBeGreaterThan(0);
            }).pipe(
              Effect.provide(layer),
              Effect.ensuring(
                Effect.sync(() => {
                  if (previousVendor === undefined) delete process.env.OUTLORE_VENDOR_DIR;
                  else process.env.OUTLORE_VENDOR_DIR = previousVendor;
                }),
              ),
            );
          }),
        ),
      ),
    30_000,
  );
});
