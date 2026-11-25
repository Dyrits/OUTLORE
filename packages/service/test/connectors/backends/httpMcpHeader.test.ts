import { createServer, type IncomingHttpHeaders } from "node:http";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { httpMcpBackend } from "../../../src/connectors/backends/httpMcp.ts";

// The header the Streamable-HTTP adapter sends: the secret behind the entry's prefix, or nothing for a keyless entry
// (connectors specification, Wave 1; research note connector-catalogs-2026-11-25). A loopback fake takes the requests.

const secret = "lin_api_1f3c9a07d2/the-token==";

/** A loopback server that answers every request with an empty tool list and records the headers it took. */
const fakeServer = () =>
  Effect.acquireRelease(
    Effect.callback<
      { readonly headers: Array<IncomingHttpHeaders>; readonly url: string; readonly close: () => void },
      Error
    >((resume) => {
      const headers: Array<IncomingHttpHeaders> = [];
      const server = createServer((request, response) => {
        headers.push(request.headers);
        request.resume();
        request.on("end", () => {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ id: 1, jsonrpc: "2.0", result: { tools: [] } }));
        });
      });
      server.on("error", (problem) => resume(Effect.fail(problem)));
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (address === null || typeof address === "string") return resume(Effect.fail(new Error("no address")));
        resume(Effect.succeed({ close: () => server.close(), headers, url: `http://127.0.0.1:${address.port}/mcp` }));
      });
    }),
    (fake) => Effect.sync(fake.close),
  );

describe("the Streamable-HTTP MCP backend's header", () => {
  it.live("puts the secret alone in the header when the entry has no prefix", () =>
    fakeServer().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          yield* httpMcpBackend({ _tag: "Http", header: "x-consumer-api-key", url: fake.url }).listTools(secret);
          expect(fake.headers[0]?.["x-consumer-api-key"]).toBe(secret);
        }),
      ),
    ),
  );

  it.live("puts the prefix before the secret in the header's value", () =>
    fakeServer().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          yield* httpMcpBackend({
            _tag: "Http",
            header: "authorization",
            prefix: "Bearer ",
            url: fake.url,
          }).listTools(secret);
          expect(fake.headers[0]?.authorization).toBe(`Bearer ${secret}`);
        }),
      ),
    ),
  );

  it.live("sends no credential header for a keyless entry", () =>
    fakeServer().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          yield* httpMcpBackend({ _tag: "Http", header: null, url: fake.url }).listTools(null);
          expect(fake.headers[0]?.authorization).toBeUndefined();
          expect(Object.keys(fake.headers[0] ?? {}).filter((name) => name.startsWith("x-"))).toEqual([]);
        }),
      ),
    ),
  );

  it.live("sends nothing from a keyless entry even when a secret is passed", () =>
    fakeServer().pipe(
      Effect.flatMap((fake) =>
        Effect.gen(function* () {
          yield* httpMcpBackend({ _tag: "Http", header: null, url: fake.url }).listTools(secret);
          expect(JSON.stringify(fake.headers[0])).not.toContain(secret);
        }),
      ),
    ),
  );
});
